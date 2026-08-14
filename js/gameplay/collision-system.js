import { cellKey, isInsideGrid } from "../utils/grid-utils.js";

export function detectCollision({ grid, layer, snake }, nextHead) {
  if (!isInsideGrid(grid, nextHead.x, nextHead.y)) return { type: "boundary" };
  const cell = layer.cells[cellKey(nextHead.x, nextHead.y)];
  if (!cell?.path) return { type: "off-path" };
  if (snake.body.some((part) => part.x === nextHead.x && part.y === nextHead.y)) return { type: "self" };
  if (cell.item?.kind === "obstacle") return { type: "obstacle", item: cell.item };
  return null;
}
