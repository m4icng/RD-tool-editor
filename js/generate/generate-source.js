import { FRUIT_TYPES } from "../core/constants.js";
import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";
import { bridgeItemBlockCells, bridgeVisualCells, pathConnectionsAt } from "../objects/element-placement-rules.js";
import { normalizeCountBarrierElement } from "../objects/count-barrier-object.js";
import { normalizeTunnelElement } from "../objects/tunnel-object.js";
import { normalizeOneWayElement } from "../objects/one-way-object.js";
import { cellKey, getTrayVisualCells, indexToPosition, isInsideGrid, parseCellKey, positionToIndex } from "../utils/grid-utils.js";

const FRUIT_TYPE_BY_ITEM_ID = Object.freeze(Object.fromEntries(
  Object.entries(FRUIT_ITEM_IDS).map(([type, itemId]) => [String(itemId), type])
));

export function fruitTypeFromItemId(itemId) {
  return FRUIT_TYPE_BY_ITEM_ID[String(itemId)] ?? null;
}

export function createGeneratorIssue({ code, message, severity = "error", levelId = null, layerIndex = null, trayId = null, index = null, suggestion = "" }) {
  return { code, message, severity, levelId, layerIndex, trayId, index, suggestion };
}

export function collectPathIndexes(state) {
  return Object.entries(state.sharedCells ?? {})
    .filter(([, cell]) => cell?.path)
    .map(([key]) => {
      const { x, y } = parseCellKey(key);
      return positionToIndex(x, y, state.grid.columns);
    })
    .sort((a, b) => a - b);
}

export function collectTrayRequirements(state) {
  const requirements = [];
  Object.entries(state.sharedCells ?? {}).forEach(([key, cell]) => {
    const item = cell?.item;
    if (!["tray", "truck"].includes(item?.kind)) return;
    const { x, y } = parseCellKey(key);
    const deliverIndex = positionToIndex(x, y, state.grid.columns);
    const trayId = Number.isInteger(item.trayId) ? item.trayId : positionToIndex(x, y, state.grid.columns);
    if (item.kind === "truck") {
      const itemId = Number(FRUIT_ITEM_IDS[item.fruitType] ?? item.itemId ?? item.id);
      requirements.push({ trayId, deliverIndex, layerIndex: 0, itemId, fruitType: item.fruitType, amount: Number(item.capacity) || 0 });
      return;
    }
    (item.trayLayers ?? []).forEach((trayLayer, order) => {
      const layerIndex = Number.isInteger(trayLayer.layer) ? trayLayer.layer : order;
      FRUIT_TYPES.forEach((fruitType) => {
        const amount = Number(trayLayer.recipe?.[fruitType]) || 0;
        if (amount > 0) requirements.push({ trayId, deliverIndex, layerIndex, itemId: FRUIT_ITEM_IDS[fruitType], fruitType, amount });
      });
      (trayLayer.unknownItems ?? []).forEach((unknown) => {
        const itemId = Number(unknown.itemId);
        const amount = Number(unknown.count) || 0;
        if (Number.isInteger(itemId) && amount > 0) requirements.push({ trayId, deliverIndex, layerIndex, itemId, fruitType: fruitTypeFromItemId(itemId), amount });
      });
    });
  });
  return requirements.sort((a, b) => a.layerIndex - b.layerIndex || a.trayId - b.trayId || a.itemId - b.itemId);
}

function sharedBlockedIndexes(state) {
  const blocked = new Set();
  Object.entries(state.sharedCells ?? {}).forEach(([key, cell]) => {
    const { x, y } = parseCellKey(key);
    const index = positionToIndex(x, y, state.grid.columns);
    if (cell.item?.kind === "snake" || cell.item?.kind === "tray" || cell.element) blocked.add(index);
    if (cell.item?.kind === "tray") {
      getTrayVisualCells(cell.item, { x, y }).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
    }
    if (cell.element?.kind === "bridge") {
      bridgeVisualCells(state, index).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
      bridgeItemBlockCells(state, index).forEach((visual) => {
        if (isInsideGrid(state.grid, visual.x, visual.y)) blocked.add(positionToIndex(visual.x, visual.y, state.grid.columns));
      });
    }
  });
  Object.keys(state.priorityPoints ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    blocked.add(positionToIndex(x, y, state.grid.columns));
  });
  normalizeCountBarrierElement(state.countBarrierElement).forEach((barrier) => {
    blocked.add(barrier.startIndex);
    blocked.add(barrier.endIndex);
  });
  normalizeTunnelElement(state.tunnelElement).forEach((tunnel) => {
    tunnel.entryPoints.forEach((point) => blocked.add(point.index));
  });
  normalizeOneWayElement(state.oneWayElement).forEach((oneWay) => {
    oneWay.entryPoints.forEach((point) => blocked.add(point.index));
  });
  return blocked;
}

function indexesAfterStart(state, pathIndexes, amount = 2) {
  const spawnIndex = Object.entries(state.sharedCells ?? {}).flatMap(([key, cell]) => {
    if (cell.item?.kind !== "snake") return [];
    const { x, y } = parseCellKey(key);
    return [positionToIndex(x, y, state.grid.columns)];
  })[0];
  if (!Number.isInteger(spawnIndex)) return new Set();
  const startOffset = pathIndexes.indexOf(spawnIndex);
  if (startOffset < 0) return new Set();
  return new Set(pathIndexes.slice(startOffset + 1, startOffset + 1 + amount));
}

export function collectValidCellsByLayer(state, extraLayerIndexes = []) {
  const pathIndexes = collectPathIndexes(state);
  const blocked = sharedBlockedIndexes(state);
  const layerOneStartBuffer = indexesAfterStart(state, pathIndexes, 2);
  const validByLayer = new Map();
  const layerIndexes = new Set([
    ...(state.layers ?? []).map((layer, order) => Number.isInteger(layer.layer) ? layer.layer : order),
    ...extraLayerIndexes
  ]);
  layerIndexes.forEach((layerIndex) => {
    const valid = pathIndexes.filter((index) => {
      if (blocked.has(index)) return false;
      if (layerIndex === 0 && layerOneStartBuffer.has(index)) return false;
      return true;
    });
    validByLayer.set(layerIndex, valid);
  });
  return validByLayer;
}

export function branchCellsForIndexes(state, indexes) {
  const remaining = new Set(indexes);
  const branches = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    const queue = [first];
    const cells = [];
    remaining.delete(first);
    while (queue.length > 0) {
      const current = queue.shift();
      cells.push(current);
      const connections = pathConnectionsAt(state, current);
      connections.forEach((direction) => {
        const { x, y } = indexToPosition(current, state.grid.columns);
        const next = [
          { x, y: y - 1 },
          { x: x + 1, y },
          { x, y: y + 1 },
          { x: x - 1, y }
        ][direction];
        if (!next || !isInsideGrid(state.grid, next.x, next.y)) return;
        const nextIndex = positionToIndex(next.x, next.y, state.grid.columns);
        if (!remaining.has(nextIndex)) return;
        remaining.delete(nextIndex);
        queue.push(nextIndex);
      });
    }
    branches.push({ branchId: `branch_${branches.length + 1}`, indexes: cells.sort((a, b) => a - b) });
  }
  return branches.sort((a, b) => b.indexes.length - a.indexes.length);
}

export function analyzeGenerateSource(state) {
  const issues = [];
  const pathIndexes = collectPathIndexes(state);
  const requirements = collectTrayRequirements(state);
  const validByLayer = collectValidCellsByLayer(state, requirements.map((entry) => entry.layerIndex));
  const requiredByLayer = new Map();
  requirements.forEach((entry) => {
    if (!Number.isInteger(entry.itemId) || entry.itemId <= 0 || entry.amount <= 0) {
      issues.push(createGeneratorIssue({
        code: "TRAY_INVALID",
        message: `Khay ${entry.trayId} có mã vật phẩm hoặc số lượng không hợp lệ.`,
        trayId: entry.trayId,
        layerIndex: entry.layerIndex,
        suggestion: "Kiểm tra công thức khay trong tab LevelDes."
      }));
      return;
    }
    requiredByLayer.set(entry.layerIndex, (requiredByLayer.get(entry.layerIndex) ?? 0) + entry.amount);
  });
  if (pathIndexes.length === 0) {
    issues.push(createGeneratorIssue({
      code: "SOURCE_INVALID",
      message: "Level chưa có ô đường ray.",
      suggestion: "Vẽ đường ray trong tab LevelDes trước khi sinh màn."
    }));
  }
  if (requirements.length === 0) {
    issues.push(createGeneratorIssue({
      code: "TRAY_INVALID",
      message: "Không tìm thấy yêu cầu vật phẩm từ khay.",
      suggestion: "Thêm lớp khay và số lượng vật phẩm trong tab LevelDes."
    }));
  }
  requiredByLayer.forEach((required, layerIndex) => {
    const validSlots = validByLayer.get(layerIndex)?.length ?? 0;
    if (required > validSlots) {
      issues.push(createGeneratorIssue({
        code: "NOT_ENOUGH_VALID_CELLS",
        message: `Lớp ${layerIndex + 1} cần ${required} vật phẩm nhưng chỉ có ${validSlots} ô hợp lệ.`,
        layerIndex,
        suggestion: "Thêm ô đường ray hợp lệ hoặc giảm yêu cầu trong khay."
      }));
    }
  });
  const trayCount = new Set(requirements.map((entry) => entry.trayId)).size;
  const priorityCount = Object.keys(state.priorityPoints ?? {}).length;
  const totalValidSlots = [...validByLayer.values()].reduce((sum, cells) => sum + cells.length, 0);
  const totalRequired = requirements.reduce((sum, entry) => sum + entry.amount, 0);
  return {
    valid: issues.every((issue) => issue.severity !== "error"),
    issues,
    pathIndexes,
    requirements,
    validByLayer,
    stats: {
      layers: state.layers?.length ?? 0,
      trays: trayCount,
      priorityPoints: priorityCount,
      totalRequired,
      totalValidSlots,
      itemDensity: totalValidSlots > 0 ? totalRequired / totalValidSlots : 0
    }
  };
}
