const ISLAND = "卡通欢乐岛";
const WEDDING = {
  names: "曾嘉慧 ♥ 陆峰浩",
  date: "10月3日",
  place: "浙江 · 嘉兴",
};

const el = (id) => document.getElementById(id);

let ac = null;
let blipBuf = null;

function ensureCtx() {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === "suspended") void ac.resume();
  return ac;
}

function preloadBlip() {
  try {
    ensureCtx();
    if (blipBuf) return;
    fetch("blip.m4a?v=22")
      .then((r) => r.arrayBuffer())
      .then((b) => ac.decodeAudioData(b))
      .then((buf) => { blipBuf = buf; })
      .catch(() => {});
  } catch (e) { /* 不支持则静默降级 */ }
}

function unlockAudio() {
  try {
    ensureCtx();
    if (!blipBuf) preloadBlip();
  } catch (e) {}
}

function blip() {
  try {
    if (!ac || !blipBuf) return;
    if (ac.state === "suspended") void ac.resume();
    const src = ac.createBufferSource();
    src.buffer = blipBuf;
    src.playbackRate.value = 1 + (Math.random() * 0.06 - 0.03);
    src.connect(ac.destination);
    src.start();
  } catch (e) { /* 忽略 */ }
}
const scenes = {
  arrival: el("scene-arrival"),
  broadcast: el("scene-broadcast"),
  letter: el("scene-letter"),
};

const state = { soundOn: true };
const video = el("character");
let sync = null;

const iris = el("iris");
const irisOK = typeof iris !== "undefined" && iris &&
  window.CSS && CSS.supports && CSS.supports("clip-path", "circle(10px at 50% 50%)");
let wiping = false;

function swapScene(name) {
  for (const [key, node] of Object.entries(scenes)) {
    node.classList.toggle("active", key === name);
  }
  scenes.letter.scrollTop = 0;
}

function show(name) {
  if (scenes[name] === undefined) return;
  const current = Object.keys(scenes).find((k) => scenes[k].classList.contains("active"));
  if (current === name || wiping) { if (!irisOK) swapScene(name); return; }
  if (!irisOK) { swapScene(name); return; }
  wiping = true;
  iris.classList.remove("reveal");
  void iris.offsetWidth;
  iris.classList.add("cover");
  window.setTimeout(() => {
    swapScene(name);
    iris.classList.remove("cover");
    iris.classList.add("reveal");
    window.setTimeout(() => { iris.classList.remove("reveal"); wiping = false; }, 360);
  }, 300);
}

function setSwitch(btn, on, onText, offText) {
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.toggle("on", on);
  btn.querySelector("b").textContent = on ? onText : offText;
}

el("btn-direct").addEventListener("click", () => enterLetter());

/* ---------- 场景一：气球快递 → 弹弓 → DIY 制作 → 请柬 ---------- */

const stage = el("sky-stage");
const rig = el("rig"), balloon = el("balloon"), tether = el("tether");
const gift = el("gift"), invite = el("invite"), ground = el("ground");
const sling = el("sling"), pebble = el("pebble"), fxBox = el("fx"), flash = el("flash");
const craft = el("craft");
const cursor = el("craft-cursor");
const track = craft.querySelector(".craft-track");
const zone = craft.querySelector(".craft-zone");

let arrivalStage = 0;
let busy = false;

function say(text, giftIcon) {
  arrivalText.classList.toggle("has-gift", !!giftIcon);
  typeArrival(text);
}

function centerIn(node) {
  const a = node.getBoundingClientRect(), b = stage.getBoundingClientRect();
  return { x: a.left + a.width / 2 - b.left, y: a.top + a.height / 2 - b.top };
}

const CONFETTI = ["#e8564b", "#f6d98a", "#8fd06e", "#63b951", "#ecb549", "#fffaf0"];

function burst(at, n) {
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement("i");
    const a = Math.random() * Math.PI * 2;
    const d = 42 + Math.random() * 80;
    const sz = 6 + Math.floor(Math.random() * 7);
    p.style.cssText =
      `left:${at.x}px;top:${at.y}px;width:${sz}px;height:${sz}px;` +
      `background:${CONFETTI[i % CONFETTI.length]};` +
      `--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d + 30).toFixed(1)}px;` +
      `--rot:${Math.floor(Math.random() * 440 - 220)}deg`;
    fxBox.appendChild(p);
    requestAnimationFrame(() => p.classList.add("go"));
    window.setTimeout(() => p.remove(), 720);
  }
}

function leaves(n) {
  for (let i = 0; i < n; i += 1) {
    const p = document.createElement("i");
    p.className = "leaf";
    p.style.left = `${12 + Math.random() * 76}%`;
    p.style.top = "0px";
    p.style.setProperty("--dx", `${(Math.random() * 70 - 35).toFixed(1)}px`);
    p.style.animationDelay = `${(Math.random() * 900).toFixed(0)}ms`;
    fxBox.appendChild(p);
    requestAnimationFrame(() => p.classList.add("go"));
    window.setTimeout(() => p.remove(), 3800);
  }
}

function flyPebble(from, to, ms, done) {
  const t0 = performance.now();
  const peak = Math.min(from.y, to.y) - 96;
  pebble.style.opacity = "1";
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    const x = from.x + (to.x - from.x) * k;
    const y = (1 - k) * (1 - k) * from.y + 2 * (1 - k) * k * peak + k * k * to.y;
    pebble.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    if (k < 1) requestAnimationFrame(step);
    else { pebble.style.opacity = "0"; done(); }
  };
  requestAnimationFrame(step);
}

function fire() {
  busy = true;
  const from = centerIn(sling), to = centerIn(balloon);
  pebble.style.left = `${from.x}px`;
  pebble.style.top = `${from.y}px`;
  sling.classList.add("fire");
  flyPebble(from, to, 430, () => {
    balloon.classList.add("pop");
    tether.classList.add("snap");
    flash.classList.add("go");
    stage.classList.add("shake");
    burst(to, 18);
    rig.classList.add("still");
    const fall = ground.getBoundingClientRect().bottom - gift.getBoundingClientRect().bottom;
    gift.style.setProperty("--fall", `${Math.max(40, Math.round(fall))}px`);
    window.setTimeout(() => gift.classList.add("fall"), 130);
    window.setTimeout(() => { flash.classList.remove("go"); stage.classList.remove("shake"); }, 300);
    leaves(9);
    window.setTimeout(() => {
      busy = false;
      arrivalStage = 2;
      craft.hidden = false;
      requestAnimationFrame(() => craft.classList.add("show"));
      cursor.classList.add("run");
      say("点一下，把游标停在绿色里！");
    }, 940);
  });
}

function judge() {
  const c = cursor.getBoundingClientRect(), t = track.getBoundingClientRect(), z = zone.getBoundingClientRect();
  const mid = c.left + c.width / 2;
  if (mid < z.left || mid > z.right) {
    craft.classList.add("bad");
    window.setTimeout(() => craft.classList.remove("bad"), 330);
    say("差一点点，再来一次～");
    return;
  }
  busy = true;
  cursor.style.left = `${(mid - t.left).toFixed(1)}px`;
  cursor.classList.remove("run");
  craft.classList.add("ok");
  burst(centerIn(gift), 14);
  say("制作成功！");
  window.setTimeout(() => { arrivalStage = 3; gift.classList.add("open"); invite.classList.add("rise", "glow"); }, 430);
  window.setTimeout(() => {
    arrivalStage = 4;
    busy = false;
    craft.classList.remove("show");
    window.setTimeout(() => { craft.hidden = true; }, 320);
    el("arrival-hint").hidden = true;
    el("btn-open").hidden = false;
    say("获得了一张请柬！", true);
  }, 1280);
}

const arrivalText = el("arrival-text");
let arrivalTimer = 0;

function typeArrival(text) {
  window.clearTimeout(arrivalTimer);
  arrivalText.textContent = "";
  el("arrival-next").classList.remove("show");
  let i = 0;
  const step = () => {
    if (i >= text.length) {
      el("arrival-next").classList.add("show");
      arrivalText.dataset.full = text;
      return;
    }
    const ch = text[i];
    i += 1;
    arrivalText.textContent = text.slice(0, i);
    const d = /[，、]/.test(ch) ? 235 : /[。！？～]/.test(ch) ? 330 : 82;
    arrivalTimer = window.setTimeout(step, d);
  };
  step();
}

const envelope = el("envelope");
let mailTimers = [];

function toBroadcast() {
  mailTimers.forEach(window.clearTimeout);
  envelope.classList.remove("go");
  void envelope.offsetWidth;
  envelope.classList.add("go");
  mailTimers = [
    window.setTimeout(enterBroadcast, 430),
    window.setTimeout(() => envelope.classList.remove("go"), 820),
  ];
}

scenes.arrival.addEventListener("click", (e) => {
  if (e.target.closest("button")) return;
  unlockAudio();
  blip();
  if (busy) return;
  if (arrivalStage === 0 && arrivalText.textContent.length < (arrivalText.dataset.full || "").length) {
    window.clearTimeout(arrivalTimer);
    arrivalText.textContent = arrivalText.dataset.full;
    el("arrival-next").classList.add("show");
    return;
  }
  if (arrivalStage === 0) {
    arrivalStage = 1;
    sling.classList.add("up");
    say("再点一下，把气球射下来！");
  } else if (arrivalStage === 1) {
    fire();
  } else if (arrivalStage === 2) {
    judge();
  } else {
    toBroadcast();
  }
});

el("btn-open").addEventListener("click", (e) => {
  e.stopPropagation();
  unlockAudio();
  blip();
  toBroadcast();
});

/* ---------- 场景二：岛内广播（真实音轨驱动文字） ---------- */

let lineIdx = 0;
let raf = 0;
let paused = false;

function lineTimes(line) {
  const raw = line.charAt.slice();
  let next = null;
  for (let i = raw.length - 1; i >= 0; i -= 1) {
    if (raw[i] !== null) next = raw[i];
    else raw[i] = next;
  }
  return raw;
}

function paintLine() {
  el("bcast-text").textContent = sync.lines[lineIdx].text;
}

function follow() {
  raf = requestAnimationFrame(follow);
  if (!sync || paused) return;
  const t = video.currentTime;
  let idx = 0;
  while (idx < sync.lines.length - 1 && t >= sync.lines[idx + 1]._times[0]) idx += 1;
  if (idx !== lineIdx) {
    lineIdx = idx;
    paintLine();
  }
  const last = sync.lines[sync.lines.length - 1];
  if (lineIdx === sync.lines.length - 1 && (t >= last.videoEnd + 0.8 || video.ended)) enterLetter();
}

function enterBroadcast() {
  window.clearTimeout(arrivalTimer);
  cursor.classList.remove("run");
  show("broadcast");
  video.muted = !state.soundOn;
  lineIdx = 0;
  paused = false;
  el("btn-pause").querySelector("b").textContent = "暂停";
  paintLine();
  video.currentTime = Math.max(0, sync.lines[0]._times[0] - 0.12);
  video.play().catch(() => {});
  cancelAnimationFrame(raf);
  follow();
}

function seekTo(t) {
  video.pause();
  video.currentTime = Math.max(0, t - 0.12);
  void video.play().catch(() => {});
}

el("bcast-bubble").addEventListener("click", () => {
  if (lineIdx >= sync.lines.length - 1) {
    enterLetter();
    return;
  }
  lineIdx += 1;
  paintLine();
  blip();
  seekTo(sync.lines[lineIdx]._times[0]);
});

el("btn-pause").addEventListener("click", () => {
  paused = !paused;
  if (paused) video.pause();
  else void video.play();
  el("btn-pause").querySelector("b").textContent = paused ? "继续" : "暂停";
});

el("btn-sound").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  video.muted = !state.soundOn;
  setSwitch(el("btn-sound"), state.soundOn, "开", "关");
});

el("btn-skip").addEventListener("click", () => enterLetter());

/* ---------- 场景三：狸克邮件 / 邀请函正文 ---------- */

function enterLetter() {
  cancelAnimationFrame(raf);
  paused = true;
  cursor.classList.remove("run");
  video.pause();
  show("letter");
  el("letter-card").classList.add("open");
  blip();
}

/* ---------- 启动 ---------- */

async function boot() {
  el("island-name").textContent = ISLAND;
  el("bcast-caption").textContent = `${ISLAND} · 特别广播`;
  el("w-names").textContent = WEDDING.names;
  el("w-date").textContent = WEDDING.date;
  el("w-place").textContent = WEDDING.place;
  setSwitch(el("btn-sound"), true, "开", "关");
  video.muted = false;

  const res = await fetch("sync.json?v=22");
  const data = await res.json();
  data.lines.forEach((l) => { l._times = lineTimes(l); });
  sync = data;

  el("arrival-text").textContent = "点击屏幕，\n收到这份惊喜～";
  el("arrival-text").dataset.full = "点击屏幕，\n收到这份惊喜～";
  el("arrival-next").classList.add("show");
  el("arrival-hint").hidden = false;
}

preloadBlip();
boot();
