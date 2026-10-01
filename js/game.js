// Logical resolution; the canvas is scaled to fit its container.
const W = 960;
const H = 540;
const GROUND = 450;

const GRAVITY = 2600;
const JUMP_VELOCITY = 1000; // ~190px high, ~0.77s airtime
const JUMP_BUFFER = 0.15; // seconds a jump request stays valid before landing
const SHOT_COOLDOWN = 0.18;
const BULLET_SPEED = 900;
const START_SPEED = 320;
const MAX_SPEED = 720;
const INVULN_TIME = 1.2;

const rand = (min, max) => min + Math.random() * (max - min);

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = "idle"; // idle | playing | over
    this.paused = false;
    this.onGameOver = () => {};
    this.onSound = () => {};

    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.reset();
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = W * dpr;
    this.canvas.height = H * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  reset() {
    this.player = { x: 160, y: GROUND, vy: 0, w: 40, h: 56, onGround: true, invulnUntil: 0 };
    this.lives = 3;
    this.obstacles = [];
    this.bullets = [];
    this.particles = [];
    this.floaters = [];
    this.speed = START_SPEED;
    this.distance = 0;
    this.kills = 0;
    this.time = 0;
    this.spawnIn = 1.5;
    this.jumpRequestAt = -Infinity;
    this.lastShot = -Infinity;
    this.muzzle = 0;
    this.shake = 0;
  }

  get score() {
    return Math.floor(this.distance / 10) + this.kills * 50;
  }

  start() {
    this.reset();
    this.state = "playing";
    this.paused = false;
  }

  jump() {
    if (this.state === "playing" && !this.paused) this.jumpRequestAt = this.time;
  }

  shoot() {
    if (this.state !== "playing" || this.paused) return;
    if (this.time - this.lastShot < SHOT_COOLDOWN) return;
    this.lastShot = this.time;
    const p = this.player;
    this.bullets.push({ x: p.x + p.w, y: p.y - p.h * 0.6, w: 16, h: 6 });
    this.muzzle = 0.08;
    this.onSound("shoot");
  }

  frame = (now) => {
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;
    if (this.state === "playing" && !this.paused) this.update(dt);
    else if (this.state === "idle") this.distance += 60 * dt; // gentle background scroll
    this.updateEffects(this.paused ? 0 : dt);
    this.draw();
    requestAnimationFrame(this.frame);
  };

  update(dt) {
    this.time += dt;
    this.speed = Math.min(MAX_SPEED, START_SPEED + this.time * 7);
    this.distance += this.speed * dt;

    // Player
    const p = this.player;
    if (p.onGround && this.time - this.jumpRequestAt <= JUMP_BUFFER) {
      p.vy = -JUMP_VELOCITY;
      p.onGround = false;
      this.jumpRequestAt = -Infinity;
      this.onSound("jump");
    }
    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) {
      p.y = GROUND;
      p.vy = 0;
      p.onGround = true;
    }

    // Spawning: intervals shrink over time, but never below what a jump can clear.
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawn();
      const pace = Math.max(0.9, 1.9 - this.time * 0.015);
      this.spawnIn = pace * rand(0.8, 1.3);
    }

    // Obstacles
    for (const o of this.obstacles) {
      o.x -= (this.speed + o.extraSpeed) * dt;
      if (o.type === "flyer") o.y = o.baseY + Math.sin(this.time * 3 + o.phase) * 14;
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -60 && !o.dead);

    // Bullets
    for (const b of this.bullets) {
      b.x += BULLET_SPEED * dt;
      const box = { x: b.x, y: b.y - b.h / 2, w: b.w, h: b.h };
      for (const o of this.obstacles) {
        if (o.dead || !overlaps(box, this.box(o))) continue;
        b.dead = true;
        if (o.type === "crate") {
          this.burst(b.x + b.w, b.y, "#f6c945", 5);
          this.onSound("block");
        } else {
          o.dead = true;
          this.kills++;
          this.onSound("hit");
          this.burst(o.x + o.w / 2, o.y - o.h / 2, o.type === "flyer" ? "#b388ff" : "#ff6b6b", 18);
          this.floaters.push({ x: o.x + o.w / 2, y: o.y - o.h, text: "+50", life: 0.8 });
        }
        break;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead && b.x < W + 20);
    this.obstacles = this.obstacles.filter((o) => !o.dead);

    // Player collisions (hitbox slightly smaller than the sprite, to be forgiving)
    const hitbox = { x: p.x + 6, y: p.y - p.h + 6, w: p.w - 12, h: p.h - 8 };
    for (const o of this.obstacles) {
      if (this.time < p.invulnUntil || !overlaps(hitbox, this.box(o))) continue;
      o.dead = true;
      this.lives--;
      p.invulnUntil = this.time + INVULN_TIME;
      this.shake = 0.3;
      this.onSound("hurt");
      this.burst(p.x + p.w / 2, p.y - p.h / 2, "#4fd1c5", 14);
      if (this.lives <= 0) {
        this.state = "over";
        this.onGameOver(this.score);
      }
      break;
    }
    this.obstacles = this.obstacles.filter((o) => !o.dead);

    this.muzzle = Math.max(0, this.muzzle - dt);
  }

  spawn() {
    const r = Math.random();
    const x = W + 40;
    let o;
    if (this.time > 8 && r < 0.3) {
      o = { type: "flyer", x, w: 46, h: 32, baseY: GROUND - rand(20, 45), phase: rand(0, 6), extraSpeed: 40 };
      o.y = o.baseY;
    } else if (r < 0.65) {
      o = { type: "walker", x, y: GROUND, w: 40, h: 64, extraSpeed: 70 };
    } else {
      o = { type: "crate", x, y: GROUND, w: 42, h: Math.random() < 0.3 ? 72 : 42, extraSpeed: 0 };
    }
    this.obstacles.push(o);
  }

  // Obstacles store their bottom edge in `y`; convert to a top-left box.
  box(o) {
    return { x: o.x, y: o.y - o.h, w: o.w, h: o.h };
  }

  burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(80, 360);
      this.particles.push({
        x, y, color,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 120,
        life: rand(0.3, 0.7),
        size: rand(2, 5),
      });
    }
  }

  updateEffects(dt) {
    for (const pt of this.particles) {
      pt.vy += 900 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const f of this.floaters) {
      f.y -= 60 * dt;
      f.life -= dt;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt);
  }

  // ---------- Rendering ----------

  draw() {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-6, 6) * this.shake * 3, rand(-6, 6) * this.shake * 3);

    this.drawBackground();
    for (const o of this.obstacles) this.drawObstacle(o);
    this.drawBullets();
    this.drawPlayer();

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.min(1, pt.life * 2);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.fillStyle = "#f6c945";
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (this.state !== "idle") this.drawHud();
  }

  drawBackground() {
    const ctx = this.ctx;
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#161a36");
    sky.addColorStop(1, "#43407a");
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    // Stars
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    for (let i = 0; i < 40; i++) {
      const sx = (((i * 137.5 - this.distance * 0.02) % W) + W) % W;
      const sy = (i * 53) % 220;
      ctx.fillRect(sx, sy, 2, 2);
    }

    this.drawHills(0.15, 330, 40, "#2e2c5c");
    this.drawHills(0.35, 380, 28, "#252447");

    // Ground
    ctx.fillStyle = "#1e1f38";
    ctx.fillRect(-20, GROUND, W + 40, H - GROUND + 20);
    ctx.fillStyle = "#6c6fa8";
    ctx.fillRect(-20, GROUND, W + 40, 4);
    ctx.fillStyle = "#2c2e52";
    const offset = this.distance % 60;
    for (let x = -offset; x < W; x += 60) ctx.fillRect(x, GROUND + 22, 30, 4);
  }

  drawHills(parallax, base, amp, color) {
    const ctx = this.ctx;
    const shift = this.distance * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-20, GROUND);
    for (let x = -20; x <= W + 20; x += 16) {
      const t = (x + shift) * 0.006;
      ctx.lineTo(x, base - Math.sin(t) * amp - Math.sin(t * 2.3) * amp * 0.4);
    }
    ctx.lineTo(W + 20, GROUND);
    ctx.fill();
  }

  drawPlayer() {
    const ctx = this.ctx;
    const p = this.player;
    const invuln = this.time < p.invulnUntil && this.state === "playing";
    if (invuln && Math.floor(this.time * 10) % 2 === 0) return;

    const top = p.y - p.h;
    const legPhase = p.onGround ? Math.sin(this.distance * 0.05) * 6 : 0;

    // Legs
    ctx.fillStyle = "#2b8f86";
    ctx.fillRect(p.x + 8, p.y - 12, 8, 12 + legPhase * 0.3);
    ctx.fillRect(p.x + p.w - 16, p.y - 12, 8, 12 - legPhase * 0.3);

    // Body
    ctx.fillStyle = "#4fd1c5";
    ctx.beginPath();
    ctx.roundRect(p.x, top, p.w, p.h - 10, 12);
    ctx.fill();

    // Face: the mouth opens while airborne, mirroring the player's gesture
    ctx.fillStyle = "#0f1020";
    ctx.beginPath();
    ctx.arc(p.x + p.w - 12, top + 16, 4, 0, Math.PI * 2);
    ctx.fill();
    if (p.onGround) ctx.fillRect(p.x + p.w - 20, top + 30, 12, 3);
    else {
      ctx.beginPath();
      ctx.ellipse(p.x + p.w - 14, top + 32, 6, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Blaster
    ctx.fillStyle = "#f6c945";
    ctx.fillRect(p.x + p.w - 4, p.y - p.h * 0.6 - 4, 14, 8);
    if (this.muzzle > 0) {
      ctx.fillStyle = "#fff6c8";
      ctx.beginPath();
      ctx.arc(p.x + p.w + 14, p.y - p.h * 0.6, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawObstacle(o) {
    const ctx = this.ctx;
    const top = o.y - o.h;

    if (o.type === "crate") {
      ctx.fillStyle = "#c98b4e";
      ctx.fillRect(o.x, top, o.w, o.h);
      ctx.strokeStyle = "#8a5a2b";
      ctx.lineWidth = 4;
      ctx.strokeRect(o.x + 2, top + 2, o.w - 4, o.h - 4);
      ctx.beginPath();
      ctx.moveTo(o.x + 4, top + 4);
      ctx.lineTo(o.x + o.w - 4, o.y - 4);
      ctx.moveTo(o.x + o.w - 4, top + 4);
      ctx.lineTo(o.x + 4, o.y - 4);
      ctx.stroke();
      return;
    }

    if (o.type === "walker") {
      const step = Math.sin((this.distance + o.x) * 0.08) * 5;
      ctx.fillStyle = "#a83f4a";
      ctx.fillRect(o.x + 6, o.y - 14, 8, 14 + step * 0.4);
      ctx.fillRect(o.x + o.w - 14, o.y - 14, 8, 14 - step * 0.4);
      ctx.fillStyle = "#ff6b6b";
      ctx.beginPath();
      ctx.roundRect(o.x, top, o.w, o.h - 12, 8);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.fillRect(o.x + 6, top + 12, 18, 8);
      ctx.fillStyle = "#0f1020";
      ctx.fillRect(o.x + 6, top + 14, 6, 4);
      ctx.fillStyle = "#ffd1d1";
      ctx.fillRect(o.x + o.w / 2 - 2, top - 10, 4, 10);
      return;
    }

    // Flyer
    const flap = Math.sin(this.time * 25 + o.phase) * 8;
    ctx.fillStyle = "#d9c6ff";
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, top - 2, 20, 4 + Math.abs(flap) * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b388ff";
    ctx.beginPath();
    ctx.roundRect(o.x, top, o.w, o.h, 14);
    ctx.fill();
    ctx.fillStyle = "#ff4d6d";
    ctx.beginPath();
    ctx.arc(o.x + 12, top + o.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBullets() {
    const ctx = this.ctx;
    ctx.fillStyle = "#f6c945";
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.roundRect(b.x, b.y - b.h / 2, b.w, b.h, 3);
      ctx.fill();
    }
  }

  drawHud() {
    const ctx = this.ctx;
    ctx.textAlign = "left";
    ctx.fillStyle = "#eef0ff";
    ctx.font = "bold 26px system-ui, sans-serif";
    ctx.fillText(String(this.score), 24, 42);
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "#9aa0c8";
    ctx.fillText(`${this.kills} kills`, 24, 64);

    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < this.lives ? "#ff6b6b" : "rgba(255,255,255,0.15)";
      this.heart(W - 40 - i * 34, 32);
    }

    if (this.paused) {
      ctx.fillStyle = "rgba(10,11,25,0.5)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#eef0ff";
      ctx.textAlign = "center";
      ctx.font = "bold 36px system-ui, sans-serif";
      ctx.fillText("Paused", W / 2, H / 2);
    }
  }

  heart(cx, cy) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 10);
    ctx.bezierCurveTo(cx - 16, cy, cx - 10, cy - 12, cx, cy - 4);
    ctx.bezierCurveTo(cx + 10, cy - 12, cx + 16, cy, cx, cy + 10);
    ctx.fill();
  }
}
