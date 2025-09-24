export function createGrid(gridEl, getTracks, getSequences, getSteps, updateURL) {
  const cellMap = {};
  let painting = false;
  let paintValue = false;

  document.addEventListener("pointerup", () => {
    if (painting) { painting = false; updateURL(); }
  });

  function buildGrid() {
    gridEl.innerHTML = "";
    Object.keys(cellMap).forEach(k => delete cellMap[k]);

    const tracks = getTracks();
    const steps = getSteps();
    const sequences = getSequences();

    tracks.forEach(track => {
      const row = document.createElement("div");
      row.className = "row";
      row.style.gridTemplateColumns = `minmax(92px, 110px) repeat(${steps}, minmax(28px, 1fr))`;

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
    const tracks = getTracks();
    tracks.forEach(t => {
      if (cellMap[t.id]) cellMap[t.id].forEach(c => c.classList.remove("is-current"));
    });
  }

  function setCurrentIndicator(stepIndex) {
    const tracks = getTracks();
    tracks.forEach(t => {
      const cell = cellMap[t.id] && cellMap[t.id][stepIndex];
      if (cell) cell.classList.add("is-current");
    });
  }

  return { buildGrid, clearCurrentIndicators, setCurrentIndicator };
}