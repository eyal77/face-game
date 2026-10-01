# Site brief: Face Runner

This brief is for an AI assistant or developer building a public website around the existing **Face Runner** game in this folder. Read all of it before changing any files.

## Goal

Build a small static website that introduces the game and lets visitors play it in the browser:

1. **Landing page** (`/`): what the game is, how the face controls work, a privacy note, and a clear **Play** button.
2. **Play page** (`/play/`): the existing game, working exactly as it does now.
3. Optional **How to play** section or page: the controls table and the obstacle guide below.

The game already works. The job is to build a site around it, not to rewrite it.

## What the game is

Face Runner is an endless side-scrolling runner controlled with face gestures through the webcam. It runs entirely in the browser: no backend, no accounts, and the video never leaves the device.

| Action | Face | Keyboard |
|---|---|---|
| Jump / start | Open mouth | `Space` or `↑` |
| Shoot | Raise eyebrows (hold for auto-fire) | `F` or `J` |
| Mute | | `M` or the 🔊 button |

- **Obstacles:** crates (jump over), red robots (shoot or jump), purple drones (shoot). 3 lives; the game speeds up over time.
- **Flow:** start screen → camera permission → 2.5-second neutral-face calibration → Ready (open mouth to start) → play → game over.
- **High scores:** top 10 saved in the browser; arcade-style 3-letter initials, entered with the face (eyebrows = next letter, mouth = confirm) or the keyboard.
- **Other behavior:** pauses when the face leaves the camera view; blinking is deliberately ignored; a "Play with keyboard" mode skips the camera.
- **Sound:** retro effects generated in code with the Web Audio API.

## Current files

```
index.html     The game page: canvas, overlay screens, webcam panel
style.css      All styles (dark theme, color tokens on :root)
js/main.js     Screens, input, wiring between modules (entry point, ES module)
js/game.js     Canvas game engine: logical size 960x540, scaled to fit
js/face.js     Webcam + MediaPipe Face Landmarker + calibration + gestures
js/scores.js   High score board (localStorage)
js/sound.js    Synthesized sound effects
server.js      Local dev server only (Node, no dependencies). Not needed in production.
start.cmd / stop.cmd   Windows helpers for the local dev server. Not part of the site.
```

## Hard requirements (do not break)

1. **HTTPS is required.** Browsers only allow camera access on HTTPS or `localhost`. Deploy to an HTTPS static host (GitHub Pages, Netlify, Vercel, Cloudflare Pages, etc.).
2. **Serve over HTTP(S), never as `file://`.** The scripts are ES modules and are blocked when a page is opened as a file. `index.html` contains a small inline script that shows a warning in that case; keep it.
3. **Keep the external downloads reachable.** `js/face.js` loads these at runtime when the player clicks "Enable camera":
   - `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs`
   - `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm/` (WebAssembly files)
   - `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task` (~3.6 MB model)

   If you add a Content Security Policy, allow these in `script-src`, `connect-src` and `worker-src`, and allow `'wasm-unsafe-eval'`. Keep the version pinned at `0.10.14` unless you test a newer one.
4. **Keep the game DOM contract.** `js/main.js` looks up these elements by ID, so they must all exist on the play page:
   `game` (canvas), `overlay`, `status`, `btn-camera`, `btn-keyboard`, `btn-scores`, `btn-back`, `btn-calibrate`, `calib-bar`, `calib-status`, `ready-text`, `final-score`, `name-entry`, `rank-text`, `initials`, `name-help`, `over-board`, `scores-board`, `again-text`, `face-lost`, `panel`, `webcam` (video), `btn-recalibrate`, `btn-mute`, `file-warning`.
   It also relies on `.screen[data-screen="start|calibrate|ready|over|scores"]` and `.meter[data-gesture="jump|shoot"]` elements containing `.fill` and `.mark`.
   The simplest safe approach is to move the game into `/play/` largely unchanged, then restyle around it.
5. **Keep the browser storage keys** so existing players keep their scores and settings: `face-runner-scores`, `face-runner-name`, `face-runner-muted`.
6. **Keep the global keyboard shortcuts working.** The game listens for `Space`, arrow keys, `F`, `J` and `M` on `window` and calls `preventDefault()` on Space. Don't put text inputs or other keyboard-driven widgets on the play page.
7. **Paths:** the game uses relative paths (`style.css`, `js/main.js`). If you move it into `/play/`, move `js/` and `style.css` with it, or update the paths.

## Content for the landing page

- **Headline idea:** "Play with your face." Tagline: "Open your mouth to jump. Raise your eyebrows to shoot."
- **How it works:** three short steps: allow the camera → hold a neutral face for 2 seconds → play.
- **Privacy note (required):** "Your camera video is processed on your device and is never uploaded. No account, no tracking." This is true of the current code, so don't add analytics or anything else that contradicts it without updating the note.
- **Requirements:** a webcam, a recent Chrome or Edge (other modern browsers will probably work), good lighting, and your face roughly centered.
- **Keyboard mode:** mention that the game can also be played with the keyboard.
- **Tips:** keep your face in good, even light; exaggerate the gestures at first; use Recalibrate if the gestures feel off.

## Visual style

Match the game's existing look, defined as tokens on `:root` in `style.css`:

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0f1020` | page background |
| `--panel` | `#1a1c33` | cards and panels |
| `--text` | `#eef0ff` | body text |
| `--muted` | `#9aa0c8` | secondary text |
| `--accent` | `#4fd1c5` | teal: player, primary buttons |
| `--accent-2` | `#f6c945` | yellow: highlights, scores |
| `--danger` | `#ff6b6b` | red: robots, warnings |

Drones use `#b388ff` and crates `#c98b4e`. The font is the system UI stack, and the initials entry uses a monospace font. The mood is retro arcade, night sky, playful. The game has no image assets, so a screenshot or short screen recording of real gameplay makes a good hero image. Don't invent features the game doesn't have.

## Acceptance checklist

- [ ] Landing page loads, describes the game accurately, and links to the play page.
- [ ] Over HTTPS, **Enable camera** asks for permission, loads the model, shows calibration, and the webcam preview and gesture meters appear.
- [ ] Mouth-open jumps and eyebrow-raise shoots; the meters respond.
- [ ] **Play with keyboard** works with no camera (Space / F).
- [ ] Game over shows the initials entry when the score makes the top 10, and the board persists after a reload.
- [ ] Sounds play after the first click or key press, and mute works.
- [ ] No console errors. At phone width the layout has no horizontal scrolling (the game is meant for desktop/laptop with a webcam; on phones, saying so is fine).
- [ ] The privacy note is present and still true.

## Out of scope unless the owner asks

- An online leaderboard shared between players (needs a backend; scores are local-only today).
- Accounts, analytics, ads, or rewriting the game in a framework.
