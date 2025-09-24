import { ctx, master, ensureContext, triggerTrack } from "./lib/audio.js";
import { DRONE_NOTES, nearestNoteIndex } from "./lib/notes.js";
import { readParams, writeParams, sequencesToHexList, hexToSequence } from "./lib/url.js";
import { setupTheme } from "./lib/theme.js";
import { rebuildTracks, syncSequencesWithTracks } from "./lib/tracks.js";
import { createGrid } from "./ui/grid.js";
import {
  buildInstrumentList,
  encodeInstruments,
  decodeInstruments,
  addBeepChannel,
  removeBeepChannel,
  setBeepChannelCount
} from "./ui/instruments.js";
import { setupDrones } from "./ui/drones.js";

/* DOM */
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
const themeSelect = document.getElementById("themeSelect");

/* State */
let steps = 16;
let bpm = 120;
let playing = false;
let currentStep = -1;
let timer = null;
let sampleBuffer = null;

let sequences = {};
let tracks = [];
let beepIds = ["beep1", "beep2", "blip"];
const beepInst = {};
function setDefaultBeepInst(id) { beepInst[id] = { voice: "blip", wave: "square", freq: 440.0, vol: 0.35 }; }
setDefaultBeepInst("beep1"); beepInst["beep1"].freq = 440.0;
setDefaultBeepInst("beep2"); beepInst["beep2"].freq = 329.63; beepInst["beep2"].vol = 0.30;
setDefaultBeepInst("blip");  beepInst["blip"].freq = 659.25;

let currentTheme = "light";

function TRACK_IDS() { return tracks.map(t => t.id); }
function clampNumber(n, min, max) { return Math.max(min, Math.min(max, isNaN(n) ? min : n)); }
function stepMs() { return (60000 / bpm) / 4; }

/* Theme */
const theme = setupTheme(themeToggle, themeSelect, (mode) => { currentTheme = mode; updateURL(); });
currentTheme = theme.current;

/* Grid */
const gridApi = createGrid(
  gridEl,
  () => tracks,
  () => sequences,
  () => steps,
  () => updateURL()
);

/* Drones */
const drones = setupDrones(document, DRONE_NOTES, ctx, master, ensureContext, () => updateURL());

/* Instruments */
function onBeepChannelsChanged() {
  tracks = rebuildTracks(beepIds);
  syncSequencesWithTracks(sequences, tracks, steps);
  gridApi.buildGrid();
  buildInstrumentList(instrumentsListEl, beepIds, beepInst, DRONE_NOTES, nearestNoteIndex, () => updateURL(), (id) => {
    removeBeepChannel(id, beepIds, beepInst, sequences, onBeepChannelsChanged);
  });
  updateURL();
}

/* Transport */
function scheduleLoop() {
  if (!playing) return;
  timer = setTimeout(() => { tick(); scheduleLoop(); }, stepMs());
}
function tick() {
  gridApi.clearCurrentIndicators();
  currentStep = (currentStep + 1) % steps;
  gridApi.setCurrentIndicator(currentStep);

  const when = ctx.currentTime + 0.01;
  tracks.forEach(t => { if (sequences[t.id]?.[currentStep]) triggerTrack(t.id, when, beepInst, sampleBuffer); });
}

/* Controls */
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
    drones.startArmedDrones();
    tick();
    scheduleLoop();
  } else {
    playing = false;
    playToggle.textContent = "Play";
    clearTimeout(timer);
    gridApi.clearCurrentIndicators();
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

  syncSequencesWithTracks(sequences, tracks, steps);
  gridApi.buildGrid();

  if (playing) {
    gridApi.clearCurrentIndicators();
    currentStep = currentStep % steps;
    gridApi.setCurrentIndicator(currentStep);
  }
  updateURL();
}
stepsInput.addEventListener("input", () => setSteps(stepsInput.value || "16"));
stepsSlider.addEventListener("input", () => setSteps(stepsSlider.value || "16"));

if (addBeepBtn) addBeepBtn.addEventListener("click", () => {
  addBeepChannel(beepIds, beepInst, 220, onBeepChannelsChanged);
});

/* URL */
function updateURL() {
  const sp = new URLSearchParams();
  sp.set("b", String(bpm));
  sp.set("s", String(steps));
  sp.set("p", sequencesToHexList(TRACK_IDS(), sequences, steps).join("-"));
  const iVal = encodeInstruments(beepIds, beepInst, DRONE_NOTES, nearestNoteIndex);
  if (iVal) sp.set("i", iVal);
  const dVal = drones.encodeDrones();
  if (dVal) sp.set("d", dVal);
  sp.set("t", currentTheme);
  writeParams(sp);
}

function loadFromURL() {
  tracks = rebuildTracks(beepIds);
  syncSequencesWithTracks(sequences, tracks, steps);
  gridApi.buildGrid();
  buildInstrumentList(instrumentsListEl, beepIds, beepInst, DRONE_NOTES, nearestNoteIndex, () => updateURL(), (id) => {
    removeBeepChannel(id, beepIds, beepInst, sequences, onBeepChannelsChanged);
  });

  const sp = readParams();
  const sParam = sp.get("s");
  const bParam = sp.get("b");
  const pParam = sp.get("p");
  const iParam = sp.get("i");
  const dParam = sp.get("d");
  const tParam = sp.get("t");

  if (iParam) {
    const setter = (count) => setBeepChannelCount(count, beepIds, beepInst, sequences, onBeepChannelsChanged);
    decodeInstruments(iParam, instrumentsListEl, beepIds, beepInst, setter, DRONE_NOTES);
  }
  if (sParam) setSteps(sParam);
  if (tParam) { currentTheme = tParam; theme.applyTheme(tParam); }

  syncSequencesWithTracks(sequences, tracks, steps);

  if (bParam) {
    bpm = clampNumber(parseInt(bParam, 10), 40, 220);
    bpmInput.value = String(bpm);
    bpmSlider.value = String(bpm);
  }

  if (pParam) {
    const parts = pParam.split("-");
    const ids = TRACK_IDS();
    for (let i = 0; i < ids.length; i++) {
      const hex = parts[i] || "";
      sequences[ids[i]] = hexToSequence(hex, steps);
    }
  }

  gridApi.buildGrid();

  if (dParam) drones.decodeDrones(dParam);

  updateURL();
}

loadFromURL();