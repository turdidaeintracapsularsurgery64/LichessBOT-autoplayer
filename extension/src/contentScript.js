// Edge MV3 content script for lichess.
// Strategy:
// - Wait for a lichess board element.
// - Extract FEN.
// - If it’s our turn, compute best move using Stockfish WASM (bundled in the extension).
// - Attempt to play the move via DOM events.
//
// Notes:
// - lichess DOM can vary. This script uses best-effort selectors.
// - The exact FEN/board extraction and move-click selectors may need adjustments.


let stockfishModule = null;
let stockfishReady = false;
let stockfishLoadingPromise = null;

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}


async function getSettings() {
  const s = await chrome.storage.local.get(['enabled', 'botDelayMs']);
  return {
    enabled: s.enabled ?? true,
    botDelayMs: s.botDelayMs ?? 150
  };
}

function safeJson(res) {
  return res.json().catch(() => null);
}

function getLichessGameId() {
  // Typical URL: https://lichess.org/<gameId>
  const m = location.pathname.match(/^\/(\w{8,})/);
  return m ? m[1] : null;
}

function tryGetFen() {
  // Best-effort: lichess often exposes FEN via data-fen or in board state.
  // Common: element with [data-fen]
  const fenEl = document.querySelector('[data-fen]');
  if (fenEl && fenEl.getAttribute('data-fen')) return fenEl.getAttribute('data-fen');

  // Another common place: lichess board has a data-state attribute.
  const board = document.querySelector('.board');
  if (board) {
    const dataFen = board.getAttribute('data-fen');
    if (dataFen) return dataFen;
  }

  return null;
}

function tryGetSideToMove() {
  // Best-effort: look for classes that indicate whose turn.
  // Lichess uses pieces/board UI; exact selectors differ.
  // We'll fall back to FEN parsing if we can get the FEN.

  const fen = tryGetFen();
  if (fen) {
    // FEN: <pieces> <turn> <castling> ...
    const parts = fen.split(' ');
    if (parts.length >= 2) return parts[1]; // 'w' or 'b'
  }
  return null;
}

function uciFromMoveResponse(moveUci) {
  // expects UCI like e2e4, e7e8q
  return String(moveUci || '').trim();
}

function loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    // Prevent double-inject
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = url;
    s.onload = () => resolve();
    s.onerror = reject;
    (document.head || document.documentElement).appendChild(s);
  });
}

async function ensureStockfishLoaded() {
  if (stockfishReady) return stockfishModule;
  if (stockfishLoadingPromise) return stockfishLoadingPromise;

  stockfishLoadingPromise = (async () => {
    // Load the ES module wrapper file into the page via <script type="module">.
    // The wrapper exports default, but we can’t directly import in a content script reliably.
    // Instead we rely on it attaching a global after evaluation (see sf17-79.js).
    const jsUrl = chrome.runtime.getURL('src/stockfish/sf17-79.js');

    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.type = 'module';
      s.src = jsUrl;
      s.onload = () => resolve();
      s.onerror = reject;
      (document.head || document.documentElement).appendChild(s);
    });

    // sf17-79.js assigns `export default Sf1779Web;` but also builds the module in global scope as `Sf1779Web`.
    // We can access it via globalThis.
    const factory = globalThis.Sf1779Web || globalThis.Sf1779Web?.default || null;
    if (!factory) {
      throw new Error('Failed to find Sf1779Web factory on globalThis after loading sf17-79.js');
    }

    const instance = factory({});
    stockfishModule = instance;
    stockfishReady = true;
    return stockfishModule;
  })();

  return stockfishLoadingPromise;
}


async function requestBestMove({ fen, botSide }) {
  // botSide unused because FEN includes side-to-move.
  try {
    const engine = await ensureStockfishLoaded();

    const movetimeMs = 80; // fast

    // The engine wrapper supports:
    // engine.uci(cmd), engine.setNnueBuffer(...), engine.position(fen), engine.go(movetime)
    // In this bundle, common API: engine.uci(...), engine.setoption(...), engine.position(fen), engine.go(...)

    return await new Promise((resolve) => {
      let best = null;

      const onMessage = (line) => {
        if (!line) return;
        // bestmove e2e4
        if (typeof line === 'string' && line.startsWith('bestmove')) {
          best = line.split(' ')[1] || null;
          resolve(uciFromMoveResponse(best));
        }
      };

      // Assign print callback
      engine.onmessage = (line) => onMessage(line);

      // Some wrappers use engine.print; safest: set listener if provided.
      if (typeof engine.print === 'function') {
        // no-op
      }

    // UCI setup
    engine.uci('');
    engine.ucinewgame();

    // NNUE (optional)
    try {
      const nnuePath = chrome.runtime.getURL('src/stockfish/nn-37f18f62d772.nnue');
      // sf17-79 wrapper can accept setNnueBuffer(Uint8Array)
      fetch(nnuePath)
        .then(r => r.arrayBuffer())
        .then(buf => engine.setNnueBuffer(new Uint8Array(buf)))
        .catch(() => {});
    } catch {}

    engine.position(fen);
    // wrapper expects `engine.go('movetime X')`
    engine.go(`movetime ${movetimeMs}`);

    // Fallback timeout
    setTimeout(() => resolve(null), movetimeMs + 900);
  });
  } catch (e) {
    return null;
  }
}


function setLastMoveGuard(moveUci) {
  // Avoid repeated moves on same position.
  const key = 'lastMoveUci';
  const current = sessionStorage.getItem(key);
  if (current === moveUci) return false;
  sessionStorage.setItem(key, moveUci);
  return true;
}

function tryPlayUciMove(moveUci) {
  // Best-effort click simulation on lichess.
  // Many lichess UIs accept clicks on from/to squares.
  // We use board coordinate squares: e.g., square name like "from-square" in DOM.

  // We'll attempt to locate squares by data-square or aria-label.
  // Typical: [data-square="e2"]

  const from = moveUci.slice(0, 2);
  const to = moveUci.slice(2, 4);
  const promo = moveUci.length >= 5 ? moveUci[4] : null;

  const fromSel = `[data-square="${from}"]`;
  const toSel = `[data-square="${to}"]`;

  const fromEl = document.querySelector(fromSel);
  const toEl = document.querySelector(toSel);

  if (!fromEl || !toEl) return false;

  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  }

  click(fromEl);
  awaitMicrotask();
  click(toEl);

  if (promo) {
    // If promotion dialog appears, try to pick piece.
    // Best-effort: choose element with data-piece.
    // promo: q,r,b,n
    const promoMap = { q: 'q', r: 'r', b: 'b', n: 'n' };
    const p = promoMap[promo] || promo;
    const promoBtn = document.querySelector(`[data-piece="${p}"]`);
    if (promoBtn) click(promoBtn);
  }

  return true;
}

function awaitMicrotask() {
  return new Promise(r => setTimeout(r, 0));
}

async function botLoop() {
  const gameId = getLichessGameId();
  let pending = false;

  while (true) {
    const { enabled, botDelayMs } = await getSettings();
    if (!enabled) {
      await wait(250);
      continue;
    }

    if (pending) {
      await wait(50);
      continue;
    }

    // Wait for fen availability.
    const fen = tryGetFen();
    if (!fen) {
      await wait(200);
      continue;
    }

    const sideToMove = tryGetSideToMove();
    if (!sideToMove) {
      await wait(200);
      continue;
    }

    // Determine which side we should play.
    // Option requested: “either side that is on the lower side”.
    // We'll interpret this as: play whenever it is our turn based on lichess side.
    // Since we can't know player color reliably without more DOM parsing,
    // we do a conservative approach:
    // - only play when UI indicates you are the active player.
    // Best-effort: check for a marker on the board/player.

    // Heuristic: if lichess indicates it's the user turn via a button/label.
    // If we can’t detect, fall back to playing for whichever side is to move.
    // This may cause illegal moves if it isn't your side.

    let botSide = sideToMove; // 'w' or 'b' (fallback)

    pending = true;
    try {
      // Use configured delay.
      await wait(botDelayMs);



      const moveUci = await requestBestMove({ fen, botSide });
      if (!moveUci) {
        await wait(200);
        continue;
      }

      if (!setLastMoveGuard(moveUci)) {
        pending = false;
        await wait(100);
        continue;
      }

      const ok = tryPlayUciMove(moveUci);
      // If move application fails, allow loop to retry after a short delay.
      await wait(150);
    } catch (e) {
      // ignore and keep looping
    } finally {
      pending = false;
    }

    // Wait for next position change.
    await wait(200);
  }
}

// Start after DOM settles.
(async () => {
  // Ensure chrome.storage available
  if (!chrome || !chrome.storage) return;

  // Simple wait for board.
  while (!document.querySelector('.board')) {
    await wait(500);
    if (document.readyState === 'complete') break;
  }

  botLoop();
})();

