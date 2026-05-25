# Quick test checklist

## 1) Start local Stockfish bridge
In `server/`:
- `SET STOCKFISH_EXE="C:\Users\Showplace Customer\Downloads\stockfish-windows-x86-64-avx2\stockfish\stockfish-windows-x86-64-avx2.exe"`
- `npm start`

(Or keep the default path already set in `server/server.js`.)

## 2) Load unpacked Edge extension
- Open `edge://extensions`
- Turn on **Developer mode**
- **Load unpacked** → select `extension/`

## 3) Test on lichess
- Open a lichess game page
- Click the extension icon and ensure it is **Enabled**

If the bot does not move, the FEN extraction (`[data-fen]`) or move clicking selectors (`[data-square="e2"]`) likely need adjustment for your specific lichess UI.

