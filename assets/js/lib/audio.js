const AudioCtx = window.AudioContext || window.webkitAudioContext;

export const ctx = new AudioCtx();
export const master = ctx.createGain();
master.gain.value = 0.8;
master.connect(ctx.destination);

export function ensureContext() {
  if (ctx.state !== "running") ctx.resume();
}

/* Drums */
function playKick(when) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, when);
  osc.frequency.exponentialRampToValueAtTime(50, when + 0.2);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.2);

  osc.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + 0.3);
}

function playSnare(when) {
  const bufferSize = Math.floor(0.2 * ctx.sampleRate);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);

  noise.connect(hp);
  hp.connect(gain);
  gain.connect(master);

  noise.start(when);
  noise.stop(when + 0.2);

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(200, when);

  const og = ctx.createGain();
  og.gain.setValueAtTime(0.2, when);
  og.gain.exponentialRampToValueAtTime(0.001, when + 0.1);

  osc.connect(og);
  og.connect(master);
  osc.start(when);
  osc.stop(when + 0.11);
}

function playHat(when) {
  const bufferSize = Math.floor(0.08 * ctx.sampleRate);
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.35, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.06);

  noise.connect(hp);
  hp.connect(gain);
  gain.connect(master);

  noise.start(when);
  noise.stop(when + 0.07);
}

function playSample(sampleBuffer, when) {
  if (!sampleBuffer) return;
  const src = ctx.createBufferSource();
  src.buffer = sampleBuffer;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.5, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.5);

  src.connect(gain);
  gain.connect(master);
  src.start(when);
}

/* Beeps */
function playBeepBlip(inst, when) {
  const osc = ctx.createOscillator();
  osc.type = inst.wave;
  osc.frequency.setValueAtTime(inst.freq, when);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.001, inst.vol), when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);
  osc.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + 0.14);
}
function playBeepPluck(inst, when) {
  const osc = ctx.createOscillator();
  osc.type = inst.wave;
  osc.frequency.setValueAtTime(inst.freq, when);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(inst.freq * 2.5, when);
  lp.Q.value = 0.8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.001, inst.vol), when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.22);
  osc.connect(lp);
  lp.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + 0.25);
}
function playBeepChime(inst, when) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(inst.freq, when);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(inst.freq, when);
  bp.Q.value = 8;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(Math.max(0.001, inst.vol), when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + 0.6);
  osc.connect(bp);
  bp.connect(gain);
  gain.connect(master);
  osc.start(when);
  osc.stop(when + 0.62);
}
function playBeepFM(inst, when) {
  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.setValueAtTime(inst.freq, when);
  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(inst.freq * 2, when);
  const modGain = ctx.createGain();
  modGain.gain.value = inst.freq * 0.25;
  const outGain = ctx.createGain();
  outGain.gain.setValueAtTime(Math.max(0.001, inst.vol), when);
  outGain.gain.exponentialRampToValueAtTime(0.001, when + 0.35);
  mod.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(outGain);
  outGain.connect(master);
  mod.start(when);
  carrier.start(when);
  mod.stop(when + 0.4);
  carrier.stop(when + 0.4);
}

export function playBeep(inst, when) {
  if (!inst) return;
  switch (inst.voice) {
    case "blip": return playBeepBlip(inst, when);
    case "pluck": return playBeepPluck(inst, when);
    case "chime": return playBeepChime(inst, when);
    case "fm": return playBeepFM(inst, when);
    default: return playBeepBlip(inst, when);
  }
}

export function triggerTrack(id, when, beepInst, sampleBuffer) {
  if (id === "kick") return playKick(when);
  if (id === "snare") return playSnare(when);
  if (id === "hat") return playHat(when);
  if (id === "sample") return playSample(sampleBuffer, when);
  if (beepInst && beepInst[id]) return playBeep(beepInst[id], when);
}