export function beepLabel(id) {
  if (id === "blip") return "Blip";
  const n = parseInt(id.replace("beep", ""), 10);
  return Number.isFinite(n) ? `Beep ${n}` : "Beep";
}

export function sampleLabel(id) {
  if (id === "sample") return "Sample";
  const n = parseInt(id.replace("sample", ""), 10);
  return Number.isFinite(n) ? `Sample ${n}` : "Sample";
}

export function rebuildTracks(beepIds, sampleIds = ["sample"]) {
  return [
    { id: "kick", name: "Kick" },
    { id: "snare", name: "Snare" },
    { id: "hat", name: "Hat" },
    ...beepIds.map(id => ({ id, name: beepLabel(id) })),
    ...(sampleIds && sampleIds.length ? sampleIds.map(id => ({ id, name: sampleLabel(id) })) : [{ id: "sample", name: "Sample" }]),
  ];
}

export function syncSequencesWithTracks(sequences, tracks, steps) {
  const ids = new Set(tracks.map(t => t.id));
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