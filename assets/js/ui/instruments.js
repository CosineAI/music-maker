import { beepLabel } from "../lib/tracks.js";

const VOICE_TO_IDX = { "blip": 0, "pluck": 1, "chime": 2, "fm": 3 };
const IDX_TO_VOICE = ["blip", "pluck", "chime", "fm"];
const WAVE_TO_IDX = { "sine": 0, "triangle": 1, "square": 2, "sawtooth": 3 };
const IDX_TO_WAVE = ["sine", "triangle", "square", "sawtooth"];

export function buildInstrumentList(instrumentsListEl, beepIds, beepInst, DRONE_NOTES, nearestNoteIndex, updateURL, removeChannel) {
  if (!instrumentsListEl) return;
  instrumentsListEl.innerHTML = "";
  beepIds.forEach(id => {
    const inst = beepInst[id] || { voice: "blip", wave: "square", freq: 440.0, vol: 0.35 };
    const instEl = document.createElement("div");
    instEl.className = "inst";
    instEl.dataset.id = id;

    const label = document.createElement("span");
    label.className = "inst-label";
    label.textContent = beepLabel(id);
    instEl.appendChild(label);

    const voiceWrap = document.createElement("label");
    voiceWrap.innerHTML = "Voice";
    const voiceSel = document.createElement("select");
    voiceSel.className = "inst-voice";
    ["blip", "pluck", "chime", "fm"].forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      voiceSel.appendChild(opt);
    });
    voiceWrap.appendChild(voiceSel);
    instEl.appendChild(voiceWrap);

    const waveWrap = document.createElement("label");
    waveWrap.innerHTML = "Wave";
    const waveSel = document.createElement("select");
    waveSel.className = "inst-wave";
    ["sine", "triangle", "square", "sawtooth"].forEach(w => {
      const opt = document.createElement("option");
      opt.value = w;
      opt.textContent = w;
      waveSel.appendChild(opt);
    });
    waveWrap.appendChild(waveSel);
    instEl.appendChild(waveWrap);

    const noteWrap = document.createElement("label");
    noteWrap.innerHTML = "Note";
    const noteSel = document.createElement("select");
    noteSel.className = "inst-note";
    DRONE_NOTES.forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n.f);
      opt.textContent = `${n.name} (${n.f.toFixed(2)} Hz)`;
      noteSel.appendChild(opt);
    });
    noteWrap.appendChild(noteSel);
    instEl.appendChild(noteWrap);

    const volWrap = document.createElement("label");
    volWrap.className = "vol";
    volWrap.innerHTML = "Volume";
    const volInput = document.createElement("input");
    volInput.className = "inst-vol";
    volInput.type = "range";
    volInput.min = "0"; volInput.max = "1"; volInput.step = "0.01";
    volWrap.appendChild(volInput);
    instEl.appendChild(volWrap);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => { removeChannel(id); });
    instEl.appendChild(removeBtn);

    voiceSel.value = inst.voice;
    waveSel.value = inst.wave;
    let di = nearestNoteIndex(inst.freq);
    noteSel.value = String(DRONE_NOTES[di].f);
    volInput.value = String(inst.vol);

    inst.freq = parseFloat(noteSel.value);
    beepInst[id] = inst;

    voiceSel.addEventListener("change", () => { beepInst[id].voice = voiceSel.value; updateURL(); });
    waveSel.addEventListener("change", () => { beepInst[id].wave = waveSel.value; updateURL(); });
    noteSel.addEventListener("change", () => { beepInst[id].freq = parseFloat(noteSel.value); updateURL(); });
    volInput.addEventListener("input", () => { beepInst[id].vol = parseFloat(volInput.value); updateURL(); });

    instrumentsListEl.appendChild(instEl);
  });
}

export function encodeInstruments(beepIds, beepInst, DRONE_NOTES, nearestNoteIndex) {
  const parts = [];
  beepIds.forEach(id => {
    const inst = beepInst[id];
    if (!inst) return;
    const v = VOICE_TO_IDX[inst.voice] ?? 0;
    const w = WAVE_TO_IDX[inst.wave] ?? 2;
    const n = nearestNoteIndex(inst.freq);
    const vol = Math.max(0, Math.min(100, Math.round(inst.vol * 100)));
    parts.push([v, w, n, vol].join("-"));
  });
  return parts.join(".");
}

export function decodeInstruments(str, instrumentsListEl, beepIds, beepInst, setBeepChannelCount, DRONE_NOTES) {
  if (!str) return;
  const groups = str.split(".");
  setBeepChannelCount(groups.length);
  groups.forEach((g, idx) => {
    const [vStr, wStr, nStr, volStr] = (g || "").split("-");
    const v = Math.max(0, Math.min(3, parseInt(vStr || "0", 10) || 0));
    const w = Math.max(0, Math.min(3, parseInt(wStr || "2", 10) || 2));
    const n = Math.max(0, Math.min(DRONE_NOTES.length - 1, parseInt(nStr || "0", 10) || 0));
    const p = Math.max(0, Math.min(100, parseInt(volStr || "35", 10) || 35));
    const id = beepIds[idx];
    const inst = beepInst[id] || {};
    inst.voice = IDX_TO_VOICE[v];
    inst.wave = IDX_TO_WAVE[w];
    inst.freq = DRONE_NOTES[n].f;
    inst.vol = p / 100;
    beepInst[id] = inst;
    const instEl = instrumentsListEl.querySelector(`.inst[data-id="${id}"]`);
    if (instEl) {
      instEl.querySelector(".inst-voice").value = inst.voice;
      instEl.querySelector(".inst-wave").value = inst.wave;
      instEl.querySelector(".inst-note").value = String(inst.freq);
      instEl.querySelector(".inst-vol").value = String(inst.vol);
    }
  });
}

function nextBeepId(beepIds) {
  let i = 1;
  while (beepIds.includes(`beep${i}`)) i++;
  return `beep${i}`;
}

export function addBeepChannel(beepIds, beepInst, defaultFreq, onBeepChannelsChanged) {
  const id = nextBeepId(beepIds);
  beepIds.push(id);
  beepInst[id] = { voice: "blip", wave: "square", freq: defaultFreq, vol: 0.35 };
  onBeepChannelsChanged();
}

export function removeBeepChannel(id, beepIds, beepInst, sequences, onBeepChannelsChanged) {
  const idx = beepIds.indexOf(id);
  if (idx === -1) return;
  beepIds.splice(idx, 1);
  delete beepInst[id];
  if (sequences && sequences[id]) delete sequences[id];
  onBeepChannelsChanged();
}

export function setBeepChannelCount(n, beepIds, beepInst, sequences, onBeepChannelsChanged) {
  const count = Math.max(0, Math.min(16, parseInt(n, 10)));
  while (beepIds.length < count) {
    const id = nextBeepId(beepIds);
    beepIds.push(id);
    beepInst[id] = { voice: "blip", wave: "square", freq: 440, vol: 0.35 };
  }
  if (beepIds.length > count) {
    const toRemove = beepIds.slice(count);
    beepIds.length = count;
    toRemove.forEach(id => { delete beepInst[id]; if (sequences && sequences[id]) delete sequences[id]; });
  }
  onBeepChannelsChanged();
}

export const MAPPINGS = { VOICE_TO_IDX, IDX_TO_VOICE, WAVE_TO_IDX, IDX_TO_WAVE };