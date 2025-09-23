/* Music Toy — Drones, Beats & Blips */
(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  const tracks = [
    { id: "kick", name: "Kick" },
    { id: "snare", name: "Snare" },
    { id: "hat", name: "Hat" },
    { id: "blip", name: "Blip" },
    { id: "sample", name: "Sample" },
  ];
  const TRACK_IDS = tracks.map(t => t.id);

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

  const sequences = Object.fromEntries(tracks.map(t => [t.id, Array(steps).fill(false)]));
  const cellMap = {}; // trackId -> [cells]

  function ensureContext() {
    if (ctx.state !== "running") ctx.resume();
  }

  function stepMs() {
    return (60000 / bpm) / 4;
  }

  function sequencesToHexList() {
    const digits = Math.ceil(steps / 4);
    return TRACK_IDS.map(id => {
      let v = 0n;
      const seq = sequences[id];
      for (let i = 0; i < steps; i++) {
        if (seq[i]) v |= (1n << BigInt(i));
      }
      const hex = v.toString(16);
      return hex.padStart(digits, "0");
    });
  }

  function hexToSequence(hex, count) {
    const v = BigInt("0x" + (hex || "0"));
    const out = Array(count).fill(false);
    for (let i = 0; i < count; i++) {
      out[i] = ((v >> BigInt(i)) & 1n) === 1n;
    }
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
    const dVal = encodeDrones();
    if (dVal) sp.set("d", dVal);
    writeParams(sp);
  }

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
        cell.classList.toggle("active", !!sequences[track.id][i]);
        cell.addEventListener("click", () => {
          const id = cell.dataset.track;
          const s = parseInt(cell.dataset.step, 10);
          sequences[id][s] = !sequences[id][s];
          cell.classList.toggle("active", sequences[id][s]);
          updateURL();
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
    timer = setTimeout(() => {
      tick();
      scheduleLoop();
    }, stepMs());
  }

  function tick() {
    clearCurrentIndicators();
    currentStep = (currentStep + 1) % steps;
    setCurrentIndicator(currentStep);

    const when = ctx.currentTime + 0.01;
    tracks.forEach(t => {
      if (sequences[t.id][currentStep]) triggerTrack(t.id, when);
    });
  }

  function triggerTrack(id, when) {
    switch (id) {
      case "kick": return playKick(when);
      case "snare": return playSnare(when);
      case "hat": return playHat(when);
      case "blip": return playBlip(when);
      case "sample": return playSample(when);
    }
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

  function playBlip(when) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(660, when);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12);

    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + 0.14);
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

  function clampNumber(n, min, max) {
    return Math.max(min, Math.min(max, isNaN(n) ? min : n));
  }

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

    tracks.forEach(t => {
      const oldSeq = sequences[t.id];
      const newSeq = Array(steps).fill(false);
      const L = Math.min(oldSeq.length, steps);
      for (let i = 0; i < L; i++) newSeq[i] = oldSeq[i];
      sequences[t.id] = newSeq;
    });

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

  /* Drones */
  function buildDroneNotes() {
    const NAMES = [
      ["C"], ["C#", "Db"], ["D"], ["D#", "Eb"], ["E"],
      ["F"], ["F#", "Gb"], ["G"], ["G#", "Ab"], ["A"], ["A#", "Bb"], ["B"],
    ];
    const out = [];
    for (let octave = 2; octave <= 5; octave++) {
      for (let pc = 0; pc < 12; pc++) {
        const names = NAMES[pc];
        const label = names.length === 1
          ? `${names[0]}${octave}`
          : `${names[0]}${octave}/${names[1]}${octave}`;
        const midi = 12 * (octave + 1) + pc; // C4 => 60
        const f = 440 * Math.pow(2, (midi - 69) / 12);
        out.push({ name: label, f });
      }
    }
    return out;
  }
  const DRONE_NOTES = buildDroneNotes();
  const WAVE_TO_IDX = { "sine": 0, "triangle": 1, "square": 2, "sawtooth": 3 };
  const IDX_TO_WAVE = ["sine", "triangle", "square", "sawtooth"];

  const droneNodes = {}; // id -> { osc, gain, active }
  const droneDesired = {}; // id -> boolean
  const droneToggles = {}; // id -> button
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
      noteSel.value = String(DRONE_NOTES[di].f); // A3 default
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
      if (droneDesired[id] && !droneNodes[id]?.active) {
        droneToggles[id].click();
      }
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
      if (!a && droneNodes[id]?.active) {
        toggleBtn.click();
      }
    });
  }

  function loadFromURL() {
    const sp = readParams();
    const sParam = sp.get("s");
    const bParam = sp.get("b");
    const pParam = sp.get("p");
    const dParam = sp.get("d");

    if (sParam) setSteps(sParam);
    else buildGrid();

    if (bParam) {
      bpm = clampNumber(parseInt(bParam, 10), 40, 220);
      bpmInput.value = String(bpm);
      bpmSlider.value = String(bpm);
    }

    if (pParam) {
      const parts = pParam.split("-");
      for (let i = 0; i < TRACK_IDS.length; i++) {
        const hex = parts[i] || "";
        sequences[TRACK_IDS[i]] = hexToSequence(hex, steps);
      }
      buildGrid();
    }

    if (dParam) {
      decodeDrones(dParam);
    }

    updateURL();
  }

  loadFromURL();
})();