import { ensureTerrainState, getTrayVisualPosition, isInsideGrid, parseCellKey, trimCells } from "../utils/grid-utils.js";
import { remapCountBarrierIndexes } from "../objects/count-barrier-object.js";
import { normalizeTunnelDraft, normalizeTunnelElement, remapTunnelIndexes } from "../objects/tunnel-object.js";
import { normalizeOneWayDraft, normalizeOneWayElement, remapOneWayIndexes } from "../objects/one-way-object.js";

export function isMapSizeWithinBounds(grid) {
  return Number.isInteger(grid?.columns) && grid.columns >= 1 && Number.isInteger(grid?.rows) && grid.rows >= 1;
}

export function hasDataOutsideGrid(state, nextGrid) {
  const scopes = [{ cells: state.sharedCells ?? {} }, ...(state.layers ?? [])];
  if (scopes.some((scope) => Object.entries(scope.cells ?? {}).some(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    return (x >= nextGrid.columns || y >= nextGrid.rows) && Boolean(cell.path || cell.item || cell.element);
  }))) return true;
  return Object.entries(state.sharedCells ?? {}).some(([key, cell]) => {
    if (!["tray", "truck"].includes(cell.item?.kind)) return false;
    const visual = getTrayVisualPosition(cell.item, parseCellKey(key));
    return !isInsideGrid(nextGrid, visual.x, visual.y);
  }) || [...normalizeTunnelElement(state.tunnelElement), ...(normalizeTunnelDraft(state.tunnelDraft) ? [normalizeTunnelDraft(state.tunnelDraft)] : [])].some((tunnel) => tunnel.entryPoints.some((point) => {
    const x = point.index % state.grid.columns;
    const y = Math.floor(point.index / state.grid.columns);
    return !isInsideGrid(nextGrid, x, y);
  })) || [...normalizeOneWayElement(state.oneWayElement), ...(normalizeOneWayDraft(state.oneWayDraft) ? [normalizeOneWayDraft(state.oneWayDraft)] : [])].some((oneWay) => oneWay.entryPoints.some((point) => {
    const x = point.index % state.grid.columns;
    const y = Math.floor(point.index / state.grid.columns);
    return !isInsideGrid(nextGrid, x, y);
  }));
}

export function changeMapDimension(state, dimension, nextValue) {
  if (!['columns', 'rows'].includes(dimension)) return { changed: false, reason: "dimension" };
  const value = Number(nextValue);
  if (!Number.isInteger(value) || value < 1) return { changed: false, reason: "limit" };
  const nextGrid = { ...state.grid, [dimension]: value };
  if (value < state.grid[dimension] && hasDataOutsideGrid(state, nextGrid)) return { changed: false, reason: "occupied" };
  if (value === state.grid[dimension]) return { changed: false, reason: null };
  ensureTerrainState(state);
  const previousGrid = { ...state.grid };
  state.grid = nextGrid;
  state.countBarrierElement = remapCountBarrierIndexes(state.countBarrierElement, previousGrid.columns, nextGrid.columns);
  state.tunnelElement = remapTunnelIndexes(state.tunnelElement, previousGrid.columns, nextGrid.columns);
  if (state.tunnelDraft) {
    state.tunnelDraft.entryPoints = state.tunnelDraft.entryPoints.map((point) => {
      const x = point.index % previousGrid.columns;
      const y = Math.floor(point.index / previousGrid.columns);
      return { ...point, index: (y * nextGrid.columns) + x };
    });
  }
  state.oneWayElement = remapOneWayIndexes(state.oneWayElement, previousGrid.columns, nextGrid.columns);
  if (state.oneWayDraft) {
    state.oneWayDraft.entryPoints = state.oneWayDraft.entryPoints.map((point) => {
      const x = point.index % previousGrid.columns;
      const y = Math.floor(point.index / previousGrid.columns);
      return { ...point, index: (y * nextGrid.columns) + x };
    });
  }
  if (value > previousGrid[dimension]) {
    for (let y = 0; y < nextGrid.rows; y += 1) {
      for (let x = 0; x < nextGrid.columns; x += 1) {
        if (x < previousGrid.columns && y < previousGrid.rows) continue;
        state.grassCells[`${x},${y}`] = true;
      }
    }
  } else {
    state.grassCells = trimCells(state.grassCells, nextGrid);
    state.priorityPoints = trimCells(state.priorityPoints, nextGrid);
  }
  if (state.selectedCell && (state.selectedCell.x >= nextGrid.columns || state.selectedCell.y >= nextGrid.rows)) state.selectedCell = null;
  return { changed: true, reason: null };
}
