import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

/**
 * One face gesture, driven by a 0..1 score computed from blendshapes.
 * Thresholds are relative to the player's calibrated neutral baseline, and
 * hysteresis (separate on/off thresholds) prevents one gesture firing repeatedly.
 */
class Gesture {
  constructor({ read, onDelta, offDelta, holdRepeatMs = 0 }) {
    this.read = read;
    this.onDelta = onDelta;
    this.offDelta = offDelta;
    this.holdRepeatMs = holdRepeatMs;
    this.baseline = 0;
    this.value = 0;
    this.active = false;
    this.lastFire = 0;
    this.listeners = [];
  }

  get onThreshold() {
    return Math.min(0.95, this.baseline + this.onDelta);
  }

  get offThreshold() {
    return Math.min(this.onThreshold - 0.05, this.baseline + this.offDelta);
  }

  on(fn) {
    this.listeners.push(fn);
  }

  step(now) {
    if (!this.active && this.value >= this.onThreshold) {
      this.active = true;
      this.fire(now);
    } else if (this.active && this.value <= this.offThreshold) {
      this.active = false;
    } else if (this.active && this.holdRepeatMs && now - this.lastFire >= this.holdRepeatMs) {
      this.fire(now);
    }
  }

  fire(now) {
    this.lastFire = now;
    for (const fn of this.listeners) fn();
  }

  release() {
    this.value = 0;
    this.active = false;
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export class FaceTracker {
  constructor(video) {
    this.video = video;
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.faceVisible = false;
    this.lastSeenAt = 0;
    this.calibrating = null;

    this.gestures = {
      jump: new Gesture({
        read: (s) => s.jawOpen,
        onDelta: 0.35,
        offDelta: 0.15,
      }),
      shoot: new Gesture({
        read: (s) => (s.browInnerUp + (s.browOuterUpLeft + s.browOuterUpRight) / 2) / 2,
        onDelta: 0.3,
        offDelta: 0.12,
        holdRepeatMs: 350, // keep eyebrows up for auto-fire
      }),
    };
  }

  async init(onStatus = () => {}) {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser can't access the camera. Open the game from http://127.0.0.1 or localhost.");
    }

    onStatus("Starting camera…");
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();

    onStatus("Loading face model…");
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    const options = (delegate) => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });
    try {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      this.landmarker = await FaceLandmarker.createFromOptions(fileset, options("CPU"));
    }

    onStatus("");
    this.loop();
  }

  loop = () => {
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = v.currentTime;
      const now = performance.now();
      this.process(this.landmarker.detectForVideo(v, now), now);
    }
    requestAnimationFrame(this.loop);
  };

  process(result, now) {
    const categories = result.faceBlendshapes?.[0]?.categories;
    if (!categories) {
      this.faceVisible = false;
      for (const g of Object.values(this.gestures)) g.release();
      return;
    }

    this.faceVisible = true;
    this.lastSeenAt = now;
    const scores = {};
    for (const c of categories) scores[c.categoryName] = c.score;

    for (const [name, g] of Object.entries(this.gestures)) {
      g.value = g.read(scores);
      if (this.calibrating) this.calibrating[name].push(g.value);
      else g.step(now);
    }
  }

  /** Samples the player's neutral face and sets each gesture's baseline. */
  calibrate(durationMs = 2500, onProgress = () => {}) {
    return new Promise((resolve, reject) => {
      const samples = Object.fromEntries(Object.keys(this.gestures).map((k) => [k, []]));
      this.calibrating = samples;
      const start = performance.now();

      const tick = () => {
        const progress = Math.min(1, (performance.now() - start) / durationMs);
        onProgress(progress);
        if (progress < 1) {
          requestAnimationFrame(tick);
          return;
        }
        this.calibrating = null;
        if (samples.jump.length < 10) {
          reject(new Error("Couldn't see your face clearly. Check the lighting and try again."));
          return;
        }
        for (const [name, g] of Object.entries(this.gestures)) {
          g.baseline = Math.min(0.5, median(samples[name]));
          g.active = false;
        }
        resolve();
      };
      tick();
    });
  }
}
