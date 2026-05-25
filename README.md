# Lichess Edge Stockfish Bot (Local)

This repository contains a **Microsoft Edge (MV3) extension** that can play automatically on **lichess.org** using **Stockfish**.

## What’s included
- `extension/` — Edge extension (content script + popup)
- `extension/src/stockfish/` — Stockfish WASM build files (`sf17-79.js`, `sf17-79.wasm`, and NNUE weights)
- `server/` — (optional) local Stockfish bridge server using a local `.exe` (not required if running Stockfish WASM in-browser)

## Extension
### Load in Edge
1. Go to: `edge://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder:
   - `.../extension/`

### Usage
1. Open a game on `https://lichess.org/...`
2. Click the extension icon and ensure it’s **Enabled**.
3. Bot will act **only on the side-to-move in the current FEN**.

## Notes / Limitations
- The bot makes moves as fast as it can when a position is available.
- Lichess UI/DOM selectors may change; if clicking doesn’t work, the move-application logic may need updates.
- Make sure to restart after every lichess game or it wont work nad also you need to make the first move if white and sometimes it doesnt work all the time but its pretty close to maia ai auto mover

## Your local paths / executables
- Configure your Stockfish executable path outside of the code (example: via an environment variable for the optional local bridge server).


## Project status
- Edge extension scaffolding + Stockfish WASM integration scaffolding are present.
- Local `server/` bridge can be used when you want to run your native `stockfish.exe`.






## License
TheSystemCoder
