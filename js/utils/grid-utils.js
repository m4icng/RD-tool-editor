export const cellKey = (x, y) => `${x},${y}`;

export const TRAY_VISUAL_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }
});

export function positionToIndex(x, y, width) {
  return (y * width) + x;
}

export function indexToPosition(index, width) {
  return { x: index % width, y: Math.floor(index / width) };
}

export function parseCellKey(key) {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

export function getTrayVisualPosition(item, deliverPoint) {
  const stored = item?.trayPosition;
  if (Number.isInteger(stored?.x) && Number.isInteger(stored?.y)) return { x: stored.x, y: stored.y };
  return { x: deliverPoint.x, y: deliverPoint.y - 1 };
}

export function getTrayVisualDirection(item, deliverPoint) {
  const visual = getTrayVisualPosition(item, deliverPoint);
  return Object.entries(TRAY_VISUAL_DIRECTIONS)
    .find(([, vector]) => deliverPoint.x + vector.x === visual.x && deliverPoint.y + vector.y === visual.y)?.[0] ?? "up";
}

export function createFullGrassCells(grid, excludedKeys = new Set()) {
  const cells = {};
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.columns; x += 1) {
      const key = cellKey(x, y);
      if (!excludedKeys.has(key)) cells[key] = true;
    }
  }
  return cells;
}

export function ensureTerrainState(state) {
  if (!state.grassCells) {
    const pathKeys = new Set(Object.entries(state.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
    state.grassCells = createFullGrassCells(state.grid, pathKeys);
  }
  if (!state.priorityPoints) {
    const merged = createMergedLayer(state);
    state.priorityPoints = Object.fromEntries(Object.keys(merged.cells ?? {})
      .filter((key) => {
        const { x, y } = parseCellKey(key);
        return isPathTurnpoint(merged, x, y);
      })
      .map((key) => [key, "auto"]));
  }
  return state;
}

export function isGrassAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.grassCells[cellKey(x, y)]);
}

export function isPriorityPointAt(state, x, y) {
  ensureTerrainState(state);
  return Boolean(state.priorityPoints[cellKey(x, y)]);
}

export function isInsideGrid(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.columns && y < grid.rows;
}

export function getCell(layer, x, y) {
  return layer.cells[cellKey(x, y)] ?? { path: false, item: null };
}

export function getMergedCell(level, x, y, layerId = level.activeLayerId) {
  const key = cellKey(x, y);
  const layer = level.layers?.find((candidate) => candidate.id === layerId) ?? level.layers?.[0];
  if (!level.sharedCells) return getCell(layer ?? { cells: {} }, x, y);
  const shared = level.sharedCells[key] ?? { path: false, item: null, element: null };
  const layerCell = layer?.cells?.[key] ?? {};
  return {
    path: Boolean(shared.path),
    element: shared.element ?? null,
    item: shared.item ?? layerCell.item ?? null,
    layerItem: layerCell.item ?? null,
    sharedItem: shared.item ?? null
  };
}

export function createMergedLayer(level, layerId = level.activeLayerId) {
  if (!level.sharedCells) return level.layers?.find((layer) => layer.id === layerId) ?? level.layers?.[0] ?? { cells: {} };
  const layer = level.layers?.find((candidate) => candidate.id === layerId) ?? level.layers?.[0];
  const keys = new Set([...Object.keys(level.sharedCells), ...Object.keys(layer?.cells ?? {})]);
  const cells = {};
  keys.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const cell = getMergedCell(level, x, y, layer?.id);
    if (cell.path || cell.item || cell.element) cells[key] = cell;
  });
  return { ...(layer ?? {}), cells };
}

export function trimCells(cells, grid) {
  return Object.fromEntries(Object.entries(cells).filter(([key]) => {
    const { x, y } = parseCellKey(key);
    return isInsideGrid(grid, x, y);
  }));
}

export function adjacentPositions(position) {
  return [
    { x: position.x, y: position.y - 1 },
    { x: position.x + 1, y: position.y },
    { x: position.x, y: position.y + 1 },
    { x: position.x - 1, y: position.y }
  ];
}

export function countPathNeighbors(layer, x, y) {
  return adjacentPositions({ x, y }).filter((position) =>
    Boolean(getCell(layer, position.x, position.y).path)
  ).length;
}

export function isPathJunction(layer, x, y) {
  return getCell(layer, x, y).path && countPathNeighbors(layer, x, y) >= 3;
}

export function isPathTurnpoint(layer, x, y) {
  if (!getCell(layer, x, y).path) return false;
  const neighbors = adjacentPositions({ x, y }).filter((position) => Boolean(getCell(layer, position.x, position.y).path));
  if (neighbors.length >= 3) return true;
  if (neighbors.length !== 2) return false;
  const [first, second] = neighbors;
  return first.x !== second.x && first.y !== second.y;
}
