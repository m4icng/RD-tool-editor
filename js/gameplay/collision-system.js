import { cellKey, isInsideGrid } from "../utils/grid-utils.js";
import { bridgeAllowsDifferentAxisOverlap } from "../objects/bridge-object.js";
import { gateDirectionFromMovement, isGateElement, normalizeGateDirection } from "../objects/gate-object.js";

function gateBlocks(element, direction) {
  return isGateElement(element) && gateDirectionFromMovement(direction) !== normalizeGateDirection(element.direction);
}

export function detectCollision({ grid, layer, snake }, nextHead, direction = snake.direction, { ignoreSelfCollision = false } = {}) {
  if (!isInsideGrid(grid, nextHead.x, nextHead.y)) return { type: "boundary" };
  const cell = layer.cells[cellKey(nextHead.x, nextHead.y)];
  if (!cell?.path) return { type: "off-path" };
  const head = snake.body[0];
  const headCell = layer.cells[cellKey(head.x, head.y)];
  if (gateBlocks(headCell?.element, direction) || gateBlocks(cell.element, direction)) return { type: "gate", element: cell.element ?? headCell?.element };
  if (!ignoreSelfCollision
    && snake.body.some((part) => !part.hiddenInTunnel && part.x === nextHead.x && part.y === nextHead.y)
    && !bridgeAllowsDifferentAxisOverlap(layer, { ...snake, body: snake.body.filter((part) => !part.hiddenInTunnel) }, nextHead, direction)) return { type: "self" };
  if (cell.item?.kind === "obstacle") return { type: "obstacle", item: cell.item };
  return null;
}
