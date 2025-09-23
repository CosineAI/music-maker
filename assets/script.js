/* Music Toy — Drones, Beats & Blips */
(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  let steps = 16;
  let bpm = 120;
  let playing = false;
  let currentStep = -1;
  let timer = null;
  let sampleBuffer = null;

  const gridEl = document.getElementById("grid");
  const playToggle = document.getElementById("playToggle");
  const bpmInput = document.getElementById("bpmInput");
  const bpmSlider = document.getElementById("bpmSlider");
  const stepsInput = document.getElementById("stepsInput");
  const stepsSlider = document.getElementById("stepsSlider");
  const sampleFile = document.getElementById("sampleFile");
  const sampleStatus = document.getElementById("sampleStatus");
  const instrumentsListEl = document.getElementById("instrumentsList");
  const addBeepBtn = document.getElementById("addBeep");
  const themeToggle = document.getElementById("themeToggle");

  function ensureContext() { if (ctx.state !== "running") ctx.resume(); }
  function clampNumber(n, min, max) { return Math.max(min, Math.min(max, isNaN(n) ? min : n)); }
  function stepMs() { return (60000 / bpm) / 4; }

  // Theme handling
  function applyTheme(mode) {
    document.body.classList.toggle("dark", mode === "dark");
    if (themeToggle) {
      themeToggle.textContent = mode === "dark" ? "Light" : "Dark";
      themeToggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
    }
  }
  function initTheme() {
    let mode = "light";
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") {
        mode = saved;
      } else {
        const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        mode = prefersDark ? "dark" : "light";
      }
    } catch {
      // Ignore storage errors
    }
    applyTheme(mode);
  }
  initTheme();

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = document.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
      try { localStorage.setItem("theme", next); } catch {}
    });
  }

  // Track and sequence state
  const sequences = {};
  const cellMap = {};
  let tracks = [];
  let beepIds = ["beep1", "beep2", "blip"];
  function beepLabel(id) {
    if (id === "blip") return "Blip";
    const n = parseInt(id.replace("beep", ""), 10);
    return Number.isFinite(n) ? `Beep ${n}` : "Beep";
  }
  function rebuildTracks() {
    tracks = [
      { id: "kick", name: "Kick" },
      { id: "snare", name: "Snare" },
      { id: "hat", name: "Hat" },
      ...beepIds.map(id => ({ id, name: beepLabel(id) })),
      { id: "sample", name: "Sample" },
    ];
  }
  function TRACK_IDS() { return tracks.map(t => t.id); }

  function syncSequencesWithTracks() {
    const ids = new Set(TRACK_IDS());
    Object.keys(sequences).forEach(id => {
      if (!ids.has(id)) delete sequences[id];
    });
    tracks.forEach(t => {
      const oldSeq = sequences[t.id];
      if (!oldSeq) {
        sequences[t.id] = Array(steps).fill(false);
      } else if (oldSeq.length !== steps) {
        const next = Array(steps).fill(false);
        const L = Math.min(oldSeq.length, steps);
        for (let i = 0; i < L; i++) next[i] = oldSeq[i];
        sequences[t.id] = next;
      }
    });
  }

  function sequencesToHexList() {
    const digits = Math.ceil(steps / 4);
    return TRACK_IDS().map(id => {
      let v = 0n;
      const seq = sequences[id] || Array(steps).fill(false);
      for (let i = 0; i < steps; i++) if (seq[i]) v |= (1n << BigInt(i));
      const hex = v.toString(16);
      return hex.padStart(digits, "0");
    });
  }
  function hexToSequence(hex, count) {
    const v = BigInt("0x" + (hex || "0"));
    const out = Array(count).fill(false);
    for (let i = 0; i < count; i++) out[i] = ((v >> BigInt(i)) & 1n) === 1n;
    return out;
  }
  function readParams() {
    const raw = (window.location.hash || "").replace(/^#/, "");
    if (raw) return new URLSearchParams(raw);
    const q = (window.location.search || "").replace(/^\?/, "");
    return new URLSearchParams(q);
  }
  function writeParams(sp) {
    const base = window.location.pathname + "#" + sp.toString();
    window.history.replaceState({}, "", base);
  }
  function updateURL() {
    const sp = new URLSearchParams();
    sp.set("b", String(bpm));
    sp.set("s", String(steps));
    sp.set("p", sequencesToHexList().join("-"));
    const iVal = encodeInstruments();
    if (iVal) sp.set("i", iVal);
    const dVal = encodeDrones();
    if (dVal) sp.set("d", dVal);
    writeParams(sp);
  }

  // Grid mouse painting
  let painting = false;
  let paintValue = false;
  document.addEventListener("pointerup", () => {
    if (painting) { painting = false; updateURL(); }
  });

  function buildGrid() {
    gridEl.innerHTML = "";
    Object.keys(cellMap).forEach(k => delete cellMap[k]);

    tracks.forEach(track => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.gridTemplateColumns = `110px repeat(${steps}, 1fr)`;

      const label = document.createElement("div");
      label.className = "track-label";
      label.textContent = track.name;
      row.appendChild(label);

      cellMap[track.id] = [];

      for (let i = 0; i < steps; i++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.track = track.id;
        cell.dataset.step = String(i);
        cell.classList.toggle("active", !!sequences[track.id]?.[i]);

        cell.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          const id = cell.dataset.track;
          const s = parseInt(cell.dataset.step, 10);
          const curr = !!sequences[id][s];
          paintValue = !curr;
          painting = true;
          sequences[id][s] = paintValue;
          cell.classList.toggle("active", paintValue);
        });
        cell.addEventListener("pointerenter", () => {
          if (!painting) return;
          const id = cell.dataset.track;
          const s = parseInt(cell.dataset.step, 10);
          if (sequences[id][s] !== paintValue) {
            sequences[id][s] = paintValue;
            cell.classList.toggle("active", paintValue);
          }
        });

        row.appendChild(cell);
        cellMap[track.id].push(cell);
      }

      gridEl.appendChild(row);
    });
  }

  function clearCurrentIndicators() {
    tracks.forEach(t => {
      if (cellMap[t.id]) cellMap[t.id].forEach(c => c.classList.remove("is-current"));
    });
  }
  function setCurrentIndicator(stepIndex) {
    tracks.forEach(t => {
      const cell = cellMap[t.id] && cellMap[t.id][stepIndex];
      if (cell) cell.classList.add("is-current");
    });
  }
  function scheduleLoop() {
    if (!playing) return;
    timer = setTimeout(() => { tick(); scheduleLoop(); }, stepMs());
  }
  function tick() {
    clearCurrentIndicators();
    currentStep = (currentStep + 1) % steps;
    setCurrentIndicator(currentStep);

    const when = ctx.currentTime + 0.01;
    tracks.forEach(t => { if (sequences[t.id]?.[currentStep]) triggerTrack(t.id, when); });
  }

  function triggerTrack(id, when) {
    if (id === "kick") return playKick(when);
    if (id === "snare") return playSnare(when);
    if (id === "hat") return playHat(when);
    if (beepIds.includes(id)) return playBeep(id, when);
    if (id === "sample") return playSample(when);
  }

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

  function playSample(when) {
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

  // Beep instruments synthesis
  const VOICE_TO_IDX = { "blip": 0, "pluck": 1, "chime": 2, "fm": 3 };
  const IDX_TO_VOICE = ["blip", "pluck", "chime", "fm"];
  const WAVE_TO_IDX = { "sine": 0, "triangle": 1, "square": 2, "sawtooth": 3 };
  const IDX_TO_WAVE = ["sine", "triangle", "square", "sawtooth"];
  function buildDroneNotes() {
    const NAMES = [
      ["C"], ["C#", "Db"], ["D"], ["D#", "Eb"], ["E"],
      ["F"], ["F#", "Gb"], ["G"], ["G#", "Ab"], ["A"], ["A#", "Bb"], ["B"],
    ];
    const out = [];
    for (let octave = 2; octave <= 5; octave++) {
      for (let pc = 0; pc < 12; pc++) {
        const names = NAMES[pc];
        const label = names.length === 1 ? `${names[0]}${octave}` : `${names[0]}${octave}/${names[1]}${octave}`;
        const midi = 12 * (octave + 1) + pc;
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        out.push({ name: label, f });
      }
    }
    return out;
  }
  const DRONE_NOTES = buildDroneNotes();

  const beepInst = {};
  function setDefaultBeepInst(id) {
    beepInst[id] = { voice: "blip", wave: "square", freq: 440.0, vol: 0.35 };
  }
  // Defaults for initial channels
  setDefaultBeepInst("beep1"); beepInst["beep1"].freq = 440.0;
  setDefaultBeepInst("beep2"); beepInst["beep2"].freq = 329.63; beepInst["beep2"].vol = 0.30;
  setDefaultBeepInst("blip");  beepInst["blip"].freq = 659.25;

  function playBeep(id, when) {
    const inst = beepInst[id];
    if (!inst) return;
    switch (inst.voice) {
      case "blip": return playBeepBlip(inst, when);
      case "pluck": return playBeepPluck(inst, when);
      case "chime": return playBeepChime(inst, when);
      case "fm": return playBeepFM(inst, when);
      default: return playBeepBlip(inst, when);
    }
  }
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

  function nearestNoteIndex(freq) {
    let idx = 0, best = Infinity;
    for (let i = 0; i < DRONE_NOTES.length; i++) {
      const err = Math.abs(DRONE_NOTES[i].f - freq);
      if (err < best) { best = err; idx = i; }
    }
    return idx;
  }

  // Instruments encoding for URL
  function encodeInstruments() {
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
  function decodeInstruments(str) {
    if (!str) return;
    const groups = str.split(".");
    setBeepChannelCount(groups.length);
    buildInstrumentList();
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
      // reflect to UI
      const instEl = instrumentsListEl.querySelector(`.inst[data-id="${id}"]`);
      if (instEl) {
        instEl.querySelector(".inst-voice").value = inst.voice;
        instEl.querySelector(".inst-wave").value = inst.wave;
        instEl.querySelector(".inst-note").value = String(inst.freq);
        instEl.querySelector(".inst-vol").value = String(inst.vol);
      }
    });
  }

  // Build instrument UI dynamically
  function buildInstrumentList() {
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

      // Voice
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

      // Wave
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

      // Note
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

      // Volume
      const volWrap = document.createElement("label");
      volWrap.className = "vol";
      volWrap.innerHTML = "Volume";
      const volInput = document.createElement("input");
      volInput.className = "inst-vol";
      volInput.type = "range";
      volInput.min = "0"; volInput.max = "1"; volInput.step = "0.01";
      volWrap.appendChild(volInput);
      instEl.appendChild(volWrap);

      // Remove button
      const removeBtn = document.createElement("button");
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", () => {
        removeBeepChannel(id);
      });
      instEl.appendChild(removeBtn);

      // Defaults
      voiceSel.value = inst.voice;
      waveSel.value = inst.wave;
      // Choose nearest note
      let di = nearestNoteIndex(inst.freq);
      noteSel.value = String(DRONE_NOTES[di].f);
      volInput.value = String(inst.vol);

      // Sync model
      inst.freq = parseFloat(noteSel.value);
      beepInst[id] = inst;

      voiceSel.addEventListener("change", () => { beepInst[id].voice = voiceSel.value; updateURL(); });
      waveSel.addEventListener("change", () => { beepInst[id].wave = waveSel.value; updateURL(); });
      noteSel.addEventListener("change", () => { beepInst[id].freq = parseFloat(noteSel.value); updateURL(); });
      volInput.addEventListener("input", () => { beepInst[id].vol = parseFloat(volInput.value); updateURL(); });

      instrumentsListEl.appendChild(instEl);
    });
  }

  function nextBeepId() {
    let i = 1;
    while (beepIds.includes(`beep${i}`)) i++;
    return `beep${i}`;
  }
  function addBeepChannel(defaultFreq = 440) {
    const id = nextBeepId();
    beepIds.push(id);
    beepInst[id] = { voice: "blip", wave: "square", freq: defaultFreq, vol: 0.35 };
    onBeepChannelsChanged();
  }
  function removeBeepChannel(id) {
    const idx = beepIds.indexOf(id);
    if (idx === -1) return;
    beepIds.splice(idx, 1);
    delete beepInst[id];
    onBeepChannelsChanged();
  }
  function setBeepChannelCount(n) {
    const count = clampNumber(parseInt(n, 10), 0, 16);
    while (beepIds.length < count) {
      const id = nextBeepId();
      beepIds.push(id);
      beepInst[id] = { voice: "blip", wave: "square", freq: 440, vol: 0.35 };
    }
    if (beepIds.length > count) {
      const toRemove = beepIds.slice(count);
      beepIds = beepIds.slice(0, count);
      toRemove.forEach(id => { delete beepInst[id]; delete sequences[id]; });
    }
    onBeepChannelsChanged();
  }
  function onBeepChannelsChanged() {
    rebuildTracks();
    syncSequencesWithTracks();
    buildGrid();
    buildInstrumentList();
    updateURL();
  }

  if (addBeepBtn) addBeepBtn.addEventListener("click", () => {
    addBeepChannel(220);
  });

  // Transport and controls
  bpmInput.addEventListener("input", () => {
    bpm = clampNumber(parseInt(bpmInput.value || "120", 10), 40, 220);
    bpmSlider.value = String(bpm);
    updateURL();
  });
  bpmSlider.addEventListener("input", () => {
    bpm = clampNumber(parseInt(bpmSlider.value || "120", 10), 40, 220);
    bpmInput.value = String(bpm);
    updateURL();
  });
  playToggle.addEventListener("click", () => {
    ensureContext();
    if (!playing) {
      playing = true;
      playToggle.textContent = "Stop";
      currentStep = -1;
      startArmedDrones();
      tick();
      scheduleLoop();
    } else {
      playing = false;
      playToggle.textContent = "Play";
      clearTimeout(timer);
      clearCurrentIndicators();
    }
  });

  sampleFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    ensureContext();
    const arr = await file.arrayBuffer();
    try {
      const buf = await ctx.decodeAudioData(arr);
      sampleBuffer = buf;
      sampleStatus.textContent = `Loaded: ${file.name}`;
    } catch {
      sampleStatus.textContent = "Failed to decode sample";
    }
  });

  function setSteps(n) {
    const next = clampNumber(parseInt(n, 10), 4, 32);
    if (!Number.isFinite(next) || next === steps) {
      stepsInput.value = String(steps);
      stepsSlider.value = String(steps);
      return;
    }
    steps = next;
    stepsInput.value = String(steps);
    stepsSlider.value = String(steps);

    syncSequencesWithTracks();
    buildGrid();

    if (playing) {
      clearCurrentIndicators();
      currentStep = currentStep % steps;
      setCurrentIndicator(currentStep);
    }
    updateURL();
  }
  stepsInput.addEventListener("input", () => setSteps(stepsInput.value || "16"));
  stepsSlider.addEventListener("input", () => setSteps(stepsSlider.value || "16"));

  // Drones (unchanged from previous)
  const droneNodes = {};
  const droneDesired = {};
  const droneToggles = {};
  let dronesReady = false;

  document.querySelectorAll(".drone").forEach((droneEl, idx) => {
    const id = String(droneEl.dataset.id || idx + 1);
    const toggleBtn = droneEl.querySelector(".drone-toggle");
    const noteSel = droneEl.querySelector(".drone-note");
    const waveSel = droneEl.querySelector(".drone-wave");
    const vol = droneEl.querySelector(".drone-vol");
    droneDesired[id] = false;
    droneToggles[id] = toggleBtn;

    DRONE_NOTES.forEach(n => {
      const opt = document.createElement("option");
      opt.value = String(n.f);
      opt.textContent = `${n.name} (${n.f.toFixed(2)} Hz)`;
      noteSel.appendChild(opt);
    });
    {
      const target = 220;
      let di = 0, best = Infinity;
      for (let i = 0; i < DRONE_NOTES.length; i++) {
        const err = Math.abs(DRONE_NOTES[i].f - target);
        if (err < best) { best = err; di = i; }
      }
      noteSel.value = String(DRONE_NOTES[di].f);
    }

    function startDrone() {
      ensureContext();
      const osc = ctx.createOscillator();
      osc.type = waveSel.value;
      osc.frequency.setValueAtTime(parseFloat(noteSel.value), ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(parseFloat(vol.value), ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(master);
      osc.start();

      droneNodes[id] = { osc, gain, active: true };
      toggleBtn.textContent = "Stop";
    }
    function stopDrone() {
      const node = droneNodes[id];
      if (!node) return;
      const t = ctx.currentTime;
      node.gain.gain.cancelScheduledValues(t);
      node.gain.gain.setValueAtTime(node.gain.gain.value, t);
      node.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      node.osc.stop(t + 0.35);
      droneNodes[id] = { active: false };
      toggleBtn.textContent = "Start";
    }

    toggleBtn.addEventListener("click", () => {
      if (!droneNodes[id]?.active) {
        startDrone();
        droneDesired[id] = true;
      } else {
        stopDrone();
        droneDesired[id] = false;
      }
      updateURL();
    });
    noteSel.addEventListener("change", () => {
      const node = droneNodes[id];
      if (node?.active) node.osc.frequency.setValueAtTime(parseFloat(noteSel.value), ctx.currentTime);
      updateURL();
    });
    waveSel.addEventListener("change", () => {
      const node = droneNodes[id];
      if (node?.active) node.osc.type = waveSel.value;
      updateURL();
    });
    vol.addEventListener("input", () => {
      const node = droneNodes[id];
      if (node?.active) node.gain.gain.setTargetAtTime(parseFloat(vol.value), ctx.currentTime, 0.05);
      updateURL();
    });
  });
  dronesReady = true;

  function startArmedDrones() {
    Object.keys(droneToggles).forEach(id => {
      if (droneDesired[id] && !droneNodes[id]?.active) droneToggles[id].click();
    });
  }
  function encodeDrones() {
    if (!dronesReady) return "";
    const parts = [];
    document.querySelectorAll(".drone").forEach((droneEl, idx) => {
      const id = String(droneEl.dataset.id || idx + 1);
      const noteSel = droneEl.querySelector(".drone-note");
      const waveSel = droneEl.querySelector(".drone-wave");
      const vol = droneEl.querySelector(".drone-vol");
      const a = droneDesired[id] ? 1 : 0;
      const w = WAVE_TO_IDX[waveSel.value] ?? 0;
      const freq = parseFloat(noteSel.value);
      let n = 0;
      let bestErr = Infinity;
      for (let i = 0; i < DRONE_NOTES.length; i++) {
        const err = Math.abs(DRONE_NOTES[i].f - freq);
        if (err < bestErr) { bestErr = err; n = i; }
      }
      const v = Math.max(0, Math.min(100, Math.round(parseFloat(vol.value) * 100)));
      parts.push([a, w, n, v].join("-"));
    });
    return parts.join(".");
  }
  function decodeDrones(str) {
    if (!str) return;
    const groups = str.split(".");
    document.querySelectorAll(".drone").forEach((droneEl, idx) => {
      const id = String(droneEl.dataset.id || idx + 1);
      const toggleBtn = droneEl.querySelector(".drone-toggle");
      const noteSel = droneEl.querySelector(".drone-note");
      const waveSel = droneEl.querySelector(".drone-wave");
      const vol = droneEl.querySelector(".drone-vol");
      const g = groups[idx] || "";
      const [aStr, wStr, nStr, vStr] = g.split("-");
      const a = parseInt(aStr || "0", 10) === 1;
      const w = Math.max(0, Math.min(3, parseInt(wStr || "0", 10) || 0));
      const n = Math.max(0, Math.min(DRONE_NOTES.length - 1, parseInt(nStr || "12", 10) || 12));
      const v = Math.max(0, Math.min(100, parseInt(vStr || "50", 10) || 50));
      waveSel.value = IDX_TO_WAVE[w];
      noteSel.value = String(DRONE_NOTES[n].f);
      vol.value = String(v / 100);
      droneDesired[id] = a;
      if (!a && droneNodes[id]?.active) toggleBtn.click();
    });
  }

  function loadFromURL() {
    rebuildTracks();
    syncSequencesWithTracks();
    buildInstrumentList();

    const sp = readParams();
    const sParam = sp.get("s");
    const bParam = sp.get("b");
    const pParam = sp.get("p");
    const iParam = sp.get("i");
    const dParam = sp.get("d");

    if (iParam) decodeInstruments(iParam);
    if (sParam) setSteps(sParam);

    // Sync sequences with (potentially) new tracks/steps before applying patterns
    syncSequencesWithTracks();

    if (bParam) {
      bpm = clampNumber(parseInt(bParam, 10), 40, 220);
      bpmInput.value = String(bpm);
      bpmSlider.value = String(bpm);
    }

    // Apply pattern if present
    if (pParam) {
      const parts = pParam.split("-");
      const ids = TRACK_IDS();
      for (let i = 0; i < ids.length; i++) {
        const hex = parts[i] || "";
        sequences[ids[i]] = hexToSequence(hex, steps);
      }
    }

    buildGrid();

    if (dParam) decodeDrones(dParam);

    updateURL();
  }

  loadFromURL();
})();