// Local high score board, stored in this browser only.
const KEY = "face-runner-scores";
const NAME_KEY = "face-runner-name";
const MAX_ENTRIES = 10;
export const NAME_LENGTH = 3; // classic arcade initials

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode, blocked site data): scores last for this session only.
  }
}

let memory = null;

export function loadScores() {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(read(KEY) || "[]");
    memory = Array.isArray(parsed) ? parsed.filter((e) => typeof e?.score === "number") : [];
  } catch {
    memory = [];
  }
  return memory;
}

export function qualifies(score) {
  const scores = loadScores();
  return score > 0 && (scores.length < MAX_ENTRIES || score > scores[scores.length - 1].score);
}

/** Inserts an entry and returns its 0-based rank, or -1 if it didn't make the board. */
export function addScore({ name, score, kills }) {
  const scores = loadScores();
  const entry = { name: name.trim().slice(0, NAME_LENGTH) || "???", score, kills, date: new Date().toISOString() };
  scores.push(entry);
  scores.sort((a, b) => b.score - a.score);
  scores.length = Math.min(scores.length, MAX_ENTRIES);
  write(KEY, JSON.stringify(scores));
  write(NAME_KEY, entry.name);
  return scores.indexOf(entry);
}

/** 1-based rank a score would get if it were added now. */
export function rankFor(score) {
  return loadScores().filter((e) => e.score >= score).length + 1;
}

export function lastName() {
  return read(NAME_KEY) || "";
}
