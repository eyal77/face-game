# Face Runner

An endless runner you control with your face. It uses MediaPipe Face Landmarker in the browser, and the video never leaves your device.

## Run

Double-click **`start.cmd`**. It starts the server and opens http://127.0.0.1:5173. Allow camera access when the browser asks.
Double-click **`stop.cmd`** to stop the server.

From a terminal, `npm start` does the same as `start.cmd`. You need [Node.js](https://nodejs.org/) installed. Use Chrome or Edge.

> Don't open `index.html` directly. Browsers block the game's scripts and the camera when a page is opened as a file.

## How to play

1. Click **Enable camera**, then hold a neutral face for a moment while the game calibrates.
2. Open your mouth to start.
3. Jump over crates, shoot drones, and shoot or jump the robots. You have 3 lives, and the game speeds up as you go.

| Action | Face | Keyboard |
|---|---|---|
| Jump / start | Open mouth | `Space` |
| Shoot | Raise eyebrows (hold for auto-fire) | `F` |
| Mute | | `M` or the 🔊 button |

Blinking does nothing, on purpose, because everyone blinks without noticing.
The game pauses if your face leaves the camera view.
**Play with keyboard** skips the camera entirely.

### High scores

The top 10 scores are saved in your browser. If your score makes the board, enter your initials arcade-style:

- **Face:** raise your eyebrows to cycle through letters, and open your mouth to lock one in.
- **Keyboard:** type letters, or use ↑/↓. `Enter` saves and `Esc` skips.

## Project files

- `js/face.js`: webcam, MediaPipe, calibration and gesture detection
- `js/game.js`: the game (physics, spawning, collisions, drawing)
- `js/main.js`: screens and input; connects face, keyboard, game, scores and sound
- `js/scores.js`: the high score board (browser storage)
- `js/sound.js`: sound effects, generated in code with the Web Audio API
- `server.js`: a small static file server with no dependencies

## Tuning

- **Gesture sensitivity:** `onDelta` / `offDelta` in `js/face.js`. Lower values trigger more easily.
- **Name length:** `NAME_LENGTH` in `js/scores.js` (default 3).
- **Sounds:** the `effects` list in `js/sound.js`.
