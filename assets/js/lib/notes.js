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

export const DRONE_NOTES = buildDroneNotes();

export function nearestNoteIndex(freq) {
  let idx = 0, best = Infinity;
  for (let i = 0; i < DRONE_NOTES.length; i++) {
    const err = Math.abs(DRONE_NOTES[i].f - freq);
    if (err < best) { best = err; idx = i; }
  }
  return idx;
}