import { Game } from "./game.js";
import { NAME_LENGTH, addScore, lastName, loadScores, qualifies, rankFor } from "./scores.js";
import { isMuted, play, toggleMute, unlockAudio } from "./sound.js";

const $ = (sel) => document.querySelector(sel);

const game = new Game($("#game"));
game.onSound = play;

// ---------- Sound ----------

// Audio can only start after a user gesture (e.g. the "Enable camera" click).
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

function renderMute() {
  const muted = isMuted();
  $("#btn-mute").textContent = muted ? "🔇" : "🔊";
  $("#btn-mute").setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
}

$("#btn-mute").addEventListener("click", (e) => {
  toggleMute();
  renderMute();
  e.currentTarget.blur(); // so Space doesn't re-trigger the button
});
renderMute();
let tracker = null;
let mode = null; // "face" | "keyboard"
let screen = "start";
let acceptStartAt = 0;
const FACE_LOST_PAUSE_MS = 400;

function showScreen(name) {
  screen = name;
  for (const el of document.querySelectorAll(".screen")) el.hidden = el.dataset.screen !== name;
  $("#overlay").hidden = name === null;
}

function startPrompt() {
  return mode === "face" ? "Open your mouth to start" : "Press Space to start";
}

function showReady() {
  $("#ready-text").textContent =
    mode === "face"
      ? "Try the gestures and watch the meters on the right. Open your mouth to start."
      : "Space = jump, F = shoot. Press Space to start.";
  showScreen("ready");
  acceptStartAt = performance.now() + 500;
}

function tryStart() {
  if (pendingScore) return;
  if ((screen === "ready" || screen === "over") && performance.now() >= acceptStartAt) {
    showScreen(null);
    game.start();
  }
}

// ---------- High scores ----------

function renderBoard(table, highlight = -1) {
  const scores = loadScores();
  const body = table.querySelector("tbody");
  body.replaceChildren();
  if (scores.length === 0) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.className = "empty";
    cell.textContent = "No scores yet. Go set one!";
    return;
  }
  scores.forEach((entry, i) => {
    const row = body.insertRow();
    if (i === highlight) row.className = "me";
    const cells = [
      ["rank", `${i + 1}.`],
      ["name", entry.name],
      ["score", String(entry.score)],
      ["kills", `${entry.kills ?? 0} kills`],
    ];
    for (const [cls, text] of cells) {
      const cell = row.insertCell();
      cell.className = cls;
      cell.textContent = text; // textContent: names are user input
    }
  });
}

// ---------- Arcade-style initials entry ----------

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
let pendingScore = null; // set while the player is entering their initials
let initials = [];
let cursor = 0;

function renderInitials() {
  const box = $("#initials");
  box.replaceChildren();
  initials.forEach((ch, i) => {
    const slot = document.createElement("span");
    slot.className = i === cursor ? "slot current" : "slot";
    slot.textContent = ch;
    box.append(slot);
  });
}

function nameInputReady() {
  return pendingScore && performance.now() >= acceptStartAt;
}

function cycleLetter(step) {
  const i = CHARS.indexOf(initials[cursor]);
  initials[cursor] = CHARS[(i + step + CHARS.length) % CHARS.length];
  renderInitials();
}

function moveCursor(step) {
  cursor = Math.max(0, Math.min(NAME_LENGTH - 1, cursor + step));
  renderInitials();
}

// Locks in the current letter; on the last slot, saves the name.
function confirmLetter() {
  if (cursor < NAME_LENGTH - 1) moveCursor(1);
  else finishNameEntry(true);
}

function typeLetter(ch) {
  initials[cursor] = ch;
  if (cursor < NAME_LENGTH - 1) cursor++;
  renderInitials();
}

function finishNameEntry(save) {
  if (!pendingScore) return;
  const rank = save ? addScore({ ...pendingScore, name: initials.join("") }) : -1;
  pendingScore = null;
  $("#name-entry").hidden = true;
  renderBoard($("#over-board"), rank);
  $("#again-text").hidden = false;
  // The confirming mouth-open is probably still in progress; don't let it restart the game.
  acceptStartAt = performance.now() + 1000;
}

function handleNameKey(e) {
  const key = e.key.toUpperCase();
  if (key.length === 1 && CHARS.includes(key)) typeLetter(key);
  else if (e.code === "ArrowUp") cycleLetter(1);
  else if (e.code === "ArrowDown") cycleLetter(-1);
  else if (e.code === "ArrowLeft" || e.code === "Backspace") moveCursor(-1);
  else if (e.code === "ArrowRight") moveCursor(1);
  else if (e.code === "Space") confirmLetter();
  else if (e.code === "Enter") finishNameEntry(true);
  else if (e.code === "Escape") finishNameEntry(false);
  else return;
  e.preventDefault();
}

game.onGameOver = (score) => {
  $("#final-score").textContent = String(score);
  $("#again-text").textContent = `${startPrompt()} again.`;

  if (qualifies(score)) {
    const rank = rankFor(score);
    pendingScore = { score, kills: game.kills };
    const previous = [...lastName().toUpperCase()].filter((ch) => CHARS.includes(ch));
    initials = Array.from({ length: NAME_LENGTH }, (_, i) => previous[i] ?? "A");
    cursor = 0;
    renderInitials();
    $("#rank-text").textContent = rank === 1 ? "New top score!" : `You made the board: #${rank}`;
    $("#name-help").textContent =
      mode === "face"
        ? "Raise eyebrows = next letter · Open mouth = confirm"
        : "Type letters or use ↑↓ · Enter to save · Esc to skip";
    $("#name-entry").hidden = false;
    $("#again-text").hidden = true;
  } else {
    $("#name-entry").hidden = true;
    $("#again-text").hidden = false;
  }
  renderBoard($("#over-board"));
  showScreen("over");
  // Ignore the gesture that was in progress when the player died.
  acceptStartAt = performance.now() + 1000;
};

$("#btn-scores").addEventListener("click", () => {
  renderBoard($("#scores-board"));
  showScreen("scores");
});

$("#btn-back").addEventListener("click", () => showScreen("start"));

function onJump() {
  if (pendingScore) {
    if (nameInputReady()) confirmLetter();
  } else if (game.state === "playing") game.jump();
  else tryStart();
}

function onShoot() {
  if (pendingScore) {
    if (nameInputReady()) cycleLetter(1);
  } else game.shoot();
}

// ---------- Keyboard (always available as a fallback) ----------

window.addEventListener("keydown", (e) => {
  if (pendingScore) {
    if (nameInputReady()) handleNameKey(e);
    else if (e.code === "Space") e.preventDefault();
    return;
  }
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    if (!e.repeat) onJump();
  } else if (e.code === "KeyF" || e.code === "KeyJ") {
    onShoot();
  } else if (e.code === "KeyM") {
    toggleMute();
    renderMute();
  }
});

$("#btn-keyboard").addEventListener("click", () => {
  mode = "keyboard";
  showReady();
});

// ---------- Camera ----------

function describeCameraError(err) {
  if (err?.name === "NotAllowedError") return "Camera permission was denied. Allow it in the address bar, or play with the keyboard.";
  if (err?.name === "NotFoundError") return "No camera found. You can still play with the keyboard.";
  if (err?.name === "NotReadableError") return "The camera is in use by another app.";
  return err?.message || "Couldn't start face tracking.";
}

$("#btn-camera").addEventListener("click", async () => {
  const buttons = [$("#btn-camera"), $("#btn-keyboard")];
  buttons.forEach((b) => (b.disabled = true));
  const status = $("#status");

  try {
    // Loaded on demand so keyboard mode still works if the MediaPipe CDN is unreachable.
    status.textContent = "Loading face tracking…";
    const { FaceTracker } = await import("./face.js");
    tracker = new FaceTracker($("#webcam"));
    await tracker.init((msg) => (status.textContent = msg));
  } catch (err) {
    console.error(err);
    status.textContent = describeCameraError(err);
    buttons.forEach((b) => (b.disabled = false));
    return;
  }

  mode = "face";
  tracker.gestures.jump.on(onJump);
  tracker.gestures.shoot.on(onShoot);
  $("#panel").hidden = false;
  showScreen("calibrate");
  requestAnimationFrame(updatePanel);
});

async function runCalibration() {
  const btn = $("#btn-calibrate");
  const status = $("#calib-status");
  btn.disabled = true;
  status.textContent = "Hold still…";
  try {
    await tracker.calibrate(2500, (p) => ($("#calib-bar").style.width = `${p * 100}%`));
    status.textContent = "";
    showReady();
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

$("#btn-calibrate").addEventListener("click", runCalibration);

$("#btn-recalibrate").addEventListener("click", () => {
  game.state = "idle";
  game.paused = false;
  $("#face-lost").hidden = true;
  $("#calib-bar").style.width = "0";
  showScreen("calibrate");
});

// Live gesture meters, plus auto-pause while the face is out of view.
function updatePanel() {
  for (const [name, g] of Object.entries(tracker.gestures)) {
    const meter = document.querySelector(`.meter[data-gesture="${name}"]`);
    meter.querySelector(".fill").style.width = `${Math.min(1, g.value) * 100}%`;
    meter.querySelector(".mark").style.left = `${g.onThreshold * 100}%`;
    meter.classList.toggle("active", g.active);
  }

  const lost = !tracker.faceVisible && performance.now() - tracker.lastSeenAt > FACE_LOST_PAUSE_MS;
  const shouldPause = game.state === "playing" && lost;
  game.paused = shouldPause;
  $("#face-lost").hidden = !shouldPause;

  requestAnimationFrame(updatePanel);
}
