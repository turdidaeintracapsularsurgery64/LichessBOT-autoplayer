# Edge Extension: Lichess Stockfish Bot (Local Stockfish EXE)

## What it does
- Runs as a **content script** on `https://lichess.org/*`.
- Extracts FEN and requests the best move from a **local helper server**.
- The helper server runs your **Stockfish EXE** and returns the best move (UCI).

## Setup
1. Install and run the local server (see `../server/README.md`).
2. Load the extension in Edge:
   - Go to `edge://extensions`
   - Enable **Developer mode**
   - Click **Load unpacked**
   - Select the `extension/` folder
3. Open a lichess game page and click the extension icon to ensure it’s **Enabled**.

## Notes
- “every 1 microsecond” isn’t possible in-browser. This bot acts **as fast as possible** when a move is needed.
- lichess DOM selectors can change; if the move clicking fails, we’ll adjust the selectors.

