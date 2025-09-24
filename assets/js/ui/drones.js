const WAVE_TO_IDX = { "sine": 0, "triangle": 1, "square": 2, "sawtooth": 3 };
const IDX_TO_WAVE = ["sine", "triangle", "square", "sawtooth"];

export function setupDrones(doc, DRONE_NOTES, ctx, master, ensureContext, updateURL) {
  const droneNodes = {};
  const droneDesired = {};
  const droneToggles = {};
  let dronesReady = false;

  doc.querySelectorAll(".drone").forEach((droneEl, idx) => {
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

  return { encodeDrones, decodeDrones, startArmedDrones };
}