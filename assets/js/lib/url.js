export function readParams() {
  const raw = (window.location.hash || "").replace(/^#/, "");
  if (raw) return new URLSearchParams(raw);
  const q = (window.location.search || "").replace(/^\?/, "");
  return new URLSearchParams(q);
}

export function writeParams(sp) {
  const base = window.location.pathname + "#" + sp.toString();
  window.history.replaceState({}, "", base);
}

export function sequencesToHexList(trackIds, sequences, steps) {
  const digits = Math.ceil(steps / 4);
  return trackIds.map(id => {
    let v = 0n;
    const seq = sequences[id] || Array(steps).fill(false);
    for (let i = 0; i < steps; i++) if (seq[i]) v |= (1n << BigInt(i));
    const hex = v.toString(16);
    return hex.padStart(digits, "0");
  });
}

export function hexToSequence(hex, count) {
  const v = BigInt("0x" + (hex || "0"));
  const out = Array(count).fill(false);
  for (let i = 0; i < count; i++) out[i] = ((v >> BigInt(i)) & 1n) === 1n;
  return out;
}