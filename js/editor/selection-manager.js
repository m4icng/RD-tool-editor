import { cellKey } from "../utils/grid-utils.js";
import { clamp } from "../utils/math-utils.js";

export function selectCell(state, x, y) {
  state.selectedCell = { x, y };
}

export function changeSelectedTruckCapacity(state, delta) {
  if (!state.selectedCell) return false;
  const cell = state.sharedCells?.[cellKey(state.selectedCell.x, state.selectedCell.y)];
  if (cell?.item?.kind !== "truck") return false;
  cell.item.capacity = clamp((Number(cell.item.capacity) || 1) + delta, 1, 99);
  return true;
}
