import { BRIDGE_ASSET_ID, BRIDGE_AXES } from "../core/constants.js";

export function createBridge(axis = BRIDGE_AXES.HORIZONTAL) {
  return {
    id: BRIDGE_ASSET_ID,
    kind: "bridge",
    category: "element",
    label: "Bridge",
    icon: "🟰",
    axis
  };
}

export function isBridgeElement(element) {
  return element?.kind === "bridge";
}

export function normalizeBridgeAxis(value) {
  const axis = Number(value);
  return axis === BRIDGE_AXES.VERTICAL ? BRIDGE_AXES.VERTICAL : BRIDGE_AXES.HORIZONTAL;
}

export function bridgeAxisLabel(axis) {
  return normalizeBridgeAxis(axis) === BRIDGE_AXES.VERTICAL ? "Vertical" : "Horizontal";
}

export function bridgeAxisFromDirection(direction) {
  if (direction === "left" || direction === "right") return BRIDGE_AXES.HORIZONTAL;
  if (direction === "up" || direction === "down") return BRIDGE_AXES.VERTICAL;
  return null;
}

export function bridgeSegmentAxis(body, segmentIndex, fallbackDirection = null) {
  const segment = body?.[segmentIndex];
  if (!segment) return null;
  const neighbors = [body[segmentIndex - 1], body[segmentIndex + 1]].filter(Boolean);
  for (const neighbor of neighbors) {
    if (neighbor.y === segment.y && neighbor.x !== segment.x) return BRIDGE_AXES.HORIZONTAL;
    if (neighbor.x === segment.x && neighbor.y !== segment.y) return BRIDGE_AXES.VERTICAL;
  }
  return bridgeAxisFromDirection(fallbackDirection);
}

export function bridgeAllowsDifferentAxisOverlap(layer, snake, position, movingDirection) {
  const cell = layer?.cells?.[`${position.x},${position.y}`];
  if (!isBridgeElement(cell?.element)) return false;
  const movingAxis = bridgeAxisFromDirection(movingDirection);
  if (movingAxis === null) return false;
  return snake.body
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.x === position.x && part.y === position.y)
    .every(({ index }) => bridgeSegmentAxis(snake.body, index, snake.direction) !== movingAxis);
}
