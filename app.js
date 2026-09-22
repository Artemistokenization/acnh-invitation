import { unlockAudio, audio } from "./audio.js";

const ISLAND = "卡通欢乐岛";
const WEDDING = {
  names: "曾嘉慧 ♥ 陆峰浩",
  place: "浙江 · 嘉兴",
};

const el = (id) => document.getElementById(id);
const scenes = {
  arrival: el("scene-arrival"),
  broadcast: el("scene-broadcast"),
  letter: el("scene-letter"),
};

const state = { musicOn: false, sfxOn: true, broadcastOn: true, started: false };
const video = el("character");
let sync = null;

function show(name) {
  for (const [key, node] of Object.entries(scenes)) {
    node.classList.toggle("active", key === name);
  }
  scenes.letter.scrollTop = 0;
}

function setSwitch(btn, on, onText, offText) {
  btn.setAttribute("aria-pressed", String(on));
  btn.classList.toggle("on", on);
  btn.querySelector("b").textContent = on ? onText : offText;
}

async function armAudio() {
  if (state.started) return;
  state.started = true;
  await unlockAudio();
  audio().voice.enabled = state.sfxOn;
  if (state.musicOn) audio().bgm.start();
}

el("btn-music").addEventListener("click", async () => {
  await unlockAudio();
  state.musicOn = !state.musicOn;
  setSwitch(el("btn-music"), state.musicOn, "开", "关");
  if (state.musicOn) audio().bgm.start();
  else audio().bgm.stop();
});

el("btn-sfx").addEventListener("click", async () => {
  await unlockAudio();
  state.sfxOn = !state.sfxOn;
  setSwitch(el("btn-sfx"), state.sfxOn, "开", "关");
  audio().voice.enabled = state.sfxOn;
});

el("btn-direct").addEventListener("click", () => enterLetter());

/* ---------- 场景一：气球礼物（用我们合成的 BGM 与提示音） ---------- */

let arrivalStage = 0;

function setArrivalStage(next) {
  arrivalStage = next;
  if (next === 1) {
    el("arrival-hint").hidden = false;
    el("btn-open").hidden = true;
    el("balloon-rig").classList.add("falling");
  } else if (next === 2) {
    el("arrival-hint").hidden = true;
    el("btn-open").hidden = false;
    el("balloon-rig").classList.add("landed");
    typeArrival("！获得了一个神秘包裹！");
  }
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

scenes.arrival.addEventListener("click", async (e) => {
  if (e.target.closest("button")) return;
  await armAudio();
  if (arrivalStage === 0) {
    setArrivalStage(1);
    typeArrival("咦？好像有个礼物飘过来了～");
    return;
  }
  if (arrivalText.textContent.length < (arrivalText.dataset.full || "").length) {
    window.clearTimeout(arrivalTimer);
    arrivalText.textContent = arrivalText.dataset.full;
    el("arrival-next").classList.add("show");
    return;
  }
  if (arrivalStage === 1) {
    audio().voice.chime(784);
    setArrivalStage(2);
  } else {
    enterBroadcast();
  }
});

el("btn-open").addEventListener("click", (e) => {
  e.stopPropagation();
  enterBroadcast();
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
  if (lineIdx === sync.lines.length - 1 && t >= last.videoEnd + 1.4) enterLetter();
}

async function enterBroadcast() {
  window.clearTimeout(arrivalTimer);
  show("broadcast");
  await armAudio();
  audio().bgm.stop();
  video.muted = !state.broadcastOn;
  lineIdx = 0;
  paused = false;
  el("btn-pause").querySelector("b").textContent = "暂停";
  paintLine();
  video.currentTime = sync.lines[0]._times[0];
  await video.play().catch(() => {});
  cancelAnimationFrame(raf);
  follow();
}

el("bcast-bubble").addEventListener("click", () => {
  if (lineIdx >= sync.lines.length - 1) {
    enterLetter();
    return;
  }
  lineIdx += 1;
  paintLine();
  video.currentTime = sync.lines[lineIdx]._times[0];
  if (video.paused && !paused) void video.play();
});

el("btn-pause").addEventListener("click", () => {
  paused = !paused;
  if (paused) video.pause();
  else void video.play();
  el("btn-pause").querySelector("b").textContent = paused ? "继续" : "暂停";
});

el("btn-voice").addEventListener("click", () => {
  state.broadcastOn = !state.broadcastOn;
  video.muted = !state.broadcastOn;
  el("btn-voice").querySelector("b").textContent = state.broadcastOn ? "广播静音" : "广播播放";
});

el("btn-skip").addEventListener("click", () => enterLetter());

/* ---------- 场景三：狸克邮件 / 邀请函正文 ---------- */

function enterLetter() {
  cancelAnimationFrame(raf);
  paused = true;
  video.pause();
  if (state.musicOn) audio().bgm.start();
  show("letter");
  el("letter-card").classList.add("open");
  audio().voice.chime(1318);
}

/* ---------- 启动 ---------- */

async function boot() {
  el("island-name").textContent = ISLAND;
  el("bcast-caption").textContent = `${ISLAND} · 特别广播`;
  el("w-names").textContent = WEDDING.names;
  el("w-place").textContent = WEDDING.place;
  setSwitch(el("btn-music"), false, "开", "关");
  setSwitch(el("btn-sfx"), true, "开", "关");

  const res = await fetch("sync.json");
  const data = await res.json();
  data.lines.forEach((l) => { l._times = lineTimes(l); });
  sync = data;

  el("arrival-text").textContent = "点击屏幕，\n收到这份惊喜～";
  el("arrival-text").dataset.full = "点击屏幕，\n收到这份惊喜～";
  el("arrival-next").classList.add("show");
  el("arrival-hint").hidden = false;
}

boot();
