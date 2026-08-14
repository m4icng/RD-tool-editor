import { FRUIT_SHORT } from "../core/constants.js";
import { cellKey, createMergedLayer, ensureTerrainState, getCell, getTrayVisualPosition, positionToIndex } from "../utils/grid-utils.js";
import { samePosition } from "../utils/math-utils.js";

export function renderGrid(container, editorData) {
  ensureTerrainState(editorData);
  const activeLayer = editorData.layers.find((candidate) => candidate.id === editorData.activeLayerId) ?? editorData.layers[0];
  const layer = createMergedLayer(editorData);
  if (activeLayer?.visible === false) {
    Object.values(layer.cells).forEach((cell) => {
      cell.item = cell.sharedItem ?? null;
      cell.layerItem = null;
    });
  }
  container.innerHTML = "";
  container.style.gridTemplateColumns = `repeat(${editorData.grid.columns}, minmax(0, 1fr))`;
  const trayVisuals = new Map();
  const trayCheckpoints = new Map();
  Object.entries(editorData.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!["tray", "truck"].includes(cell?.item?.kind)) return;
    const [trayX, trayY] = key.split(",").map(Number);
    trayCheckpoints.set(key, { x: trayX, y: trayY, item: cell.item });
    const visual = getTrayVisualPosition(cell.item, { x: trayX, y: trayY });
    trayVisuals.set(cellKey(visual.x, visual.y), { x: trayX, y: trayY, item: cell.item });
  });

  for (let y = 0; y < editorData.grid.rows; y += 1) {
    for (let x = 0; x < editorData.grid.columns; x += 1) {
      const data = getCell(layer, x, y);
      const index = positionToIndex(x, y, editorData.grid.columns);
      const priorityPoint = Boolean(editorData.priorityPoints[cellKey(x, y)]);
      const grass = Boolean(editorData.grassCells[cellKey(x, y)]);
      const checkpointTray = trayCheckpoints.get(cellKey(x, y));
      const visualTray = trayVisuals.get(cellKey(x, y));
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `grid-cell${grass ? " grass" : " terrain-empty"}${data.path ? " path" : ""}${priorityPoint ? " priority-point" : ""}${samePosition(editorData.selectedCell, { x, y }) ? " selected" : ""}`;
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Ô Index ${index}${priorityPoint ? ", PriorityPoint" : ""}${grass ? ", Grass" : data.path ? ", Path" : ", Terrain trống"}`);

      if (data.item && data.item.kind !== "tray") {
        const icon = document.createElement("span");
        icon.className = `placed-icon ${data.item.kind}`;
        icon.textContent = data.item.icon;
        if (data.item.kind === "fruit" || data.item.kind === "truck" || data.item.kind === "tray") {
          const badge = document.createElement("small");
          badge.textContent = data.item.kind === "fruit" ? (data.item.unknown ? `#${data.item.itemId ?? data.item.id}` : FRUIT_SHORT[data.item.fruitType]) : data.item.capacity;
          icon.appendChild(badge);
        }
        cell.appendChild(icon);
      }
      if (visualTray) {
        const icon = document.createElement("span");
        icon.className = "placed-icon tray tray-visual-proxy";
        icon.textContent = visualTray.item.icon ?? "🧺";
        const badge = document.createElement("small");
        badge.textContent = visualTray.item.trayId;
        icon.appendChild(badge);
        cell.appendChild(icon);
      }
      if (checkpointTray) {
        const checkpoint = document.createElement("span");
        checkpoint.className = "delivery-checkpoint editor-checkpoint";
        checkpoint.title = `Checkpoint khay ID ${checkpointTray.item.trayId} tại Index ${positionToIndex(checkpointTray.x, checkpointTray.y, editorData.grid.columns)}`;
        cell.appendChild(checkpoint);
      }
      container.appendChild(cell);
    }
  }
}
