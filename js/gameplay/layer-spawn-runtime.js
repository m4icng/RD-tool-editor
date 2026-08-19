import { cellKey, positionToIndex } from "../utils/grid-utils.js";

const HORIZONTAL_DIRECTIONS = new Set(["left", "right"]);
const VERTICAL_DIRECTIONS = new Set(["up", "down"]);

function visibleTrainSegments(session) {
  return (session?.snake?.body ?? []).filter((segment, index) => (
    !segment.hiddenInTunnel
    && !segment.hiddenInShovel
    && !(session?.tailDisabled && index > 0)
  ));
}

export function occupiedTrainIndexMap(session) {
  return new Map(visibleTrainSegments(session).map((segment) => [
    positionToIndex(segment.x, segment.y, session.grid.columns),
    segment
  ]));
}

function offsetSideForSegment(segment) {
  if (HORIZONTAL_DIRECTIONS.has(segment?.direction)) return "up";
  if (VERTICAL_DIRECTIONS.has(segment?.direction)) return "right";
  return "up";
}

export function resetLayerSpawnRuntime(session) {
  session.waitingNextLayerSpawn = false;
  session.pendingFruitLayerIndex = null;
  session.itemVisualOffsets = {};
  session.clearedFruitLayerIndexes = [];
}

export function markFruitLayerClearIfNeeded(session) {
  if (session.remainingFruits !== 0) return false;
  session.clearedFruitLayerIndexes = [...new Set([...(session.clearedFruitLayerIndexes ?? []), session.activeFruitLayerIndex])];
  if (session.activeFruitLayerIndex + 1 >= session.fruitLayers.length) {
    session.waitingNextLayerSpawn = false;
    session.pendingFruitLayerIndex = null;
    return false;
  }
  session.waitingNextLayerSpawn = true;
  session.pendingFruitLayerIndex = session.activeFruitLayerIndex + 1;
  return true;
}

export function trackSpawnedItemOffsets(session, spawnedKeys) {
  const occupied = occupiedTrainIndexMap(session);
  session.itemVisualOffsets ??= {};
  spawnedKeys.forEach((key) => {
    const cell = session.layer.cells[key];
    if (cell?.item?.kind !== "fruit") return;
    const [x, y] = key.split(",").map(Number);
    const index = positionToIndex(x, y, session.grid.columns);
    const segment = occupied.get(index);
    if (!segment) return;
    session.itemVisualOffsets[key] = { side: offsetSideForSegment(segment) };
  });
}

export function restoreReleasedItemOffsets(session) {
  const offsets = session.itemVisualOffsets ?? {};
  const keys = Object.keys(offsets);
  if (keys.length === 0) return;
  const occupied = occupiedTrainIndexMap(session);
  keys.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    const index = positionToIndex(x, y, session.grid.columns);
    if (!occupied.has(index)) delete offsets[key];
  });
}

export function temporaryItemOffsetClass(session, key) {
  const side = session?.itemVisualOffsets?.[key]?.side;
  return side ? ` item-offset-${side}` : "";
}
