import { FRUIT_TYPES } from "../core/constants.js";
import { blockLabelForFruitType } from "../core/block-visuals.js";
import { isPlayerHeadItem } from "../core/player-head-layer-rule.js";
import { isBridgeElement, normalizeBridgeAxis } from "../objects/bridge-object.js";
import { isGateElement, isValidGateDirection, normalizeGateDirection } from "../objects/gate-object.js";
import { normalizeCountBarrierElement } from "../objects/count-barrier-object.js";
import { isValidTunnelDirection, normalizeTunnelDirection, normalizeTunnelElement } from "../objects/tunnel-object.js";
import { isValidOneWayDirection, normalizeOneWayDirection, normalizeOneWayElement } from "../objects/one-way-object.js";
import { createMergedLayer, ensureTerrainState, getTrayVisualCells, getTrayVisualPosition, indexToPosition, isInsideGrid, parseCellKey, positionToIndex } from "../utils/grid-utils.js";

export function collectStats(layer) {
  const stats = {
    paths: 0, items: 0, snake: 0, fruits: 0, capacity: 0,
    trays: 0, trayLayers: 0, invalidTrayRecipes: 0,
    allFruits: 0, fruitLayers: 0,
    fruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    allFruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    capacityByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    bridges: 0,
    gates: 0,
    mysteryFruits: 0,
    countBarriers: 0,
    countBarrierCells: 0,
    tunnels: 0,
    oneWays: 0
  };
  Object.values(layer?.cells ?? {}).forEach((cell) => {
    if (cell.path) stats.paths += 1;
    if (isBridgeElement(cell.element)) stats.bridges += 1;
    if (isGateElement(cell.element)) stats.gates += 1;
    if (!cell.item) return;
    stats.items += 1;
    if (cell.item.kind === "snake") stats.snake += 1;
    if (cell.item.kind === "fruit") {
      stats.fruits += 1;
      stats.fruitsByType[cell.item.fruitType] = (stats.fruitsByType[cell.item.fruitType] ?? 0) + 1;
    }
    if (cell.item.kind === "truck") {
      const capacity = Number(cell.item.capacity) || 0;
      stats.capacity += capacity;
      stats.capacityByType[cell.item.fruitType] = (stats.capacityByType[cell.item.fruitType] ?? 0) + capacity;
    }
    if (cell.item.kind === "tray") {
      stats.trays += 1;
      const trayLayers = cell.item.trayLayers ?? [];
      if (trayLayers.length === 0) stats.invalidTrayRecipes += 1;
      for (const trayLayer of trayLayers) {
        stats.trayLayers += 1;
        const recipeTotal = FRUIT_TYPES.reduce((sum, type) => sum + (Number(trayLayer.recipe?.[type]) || 0), 0)
          + (trayLayer.unknownItems ?? []).reduce((sum, item) => sum + (Number(item.count) || 0), 0);
        if (recipeTotal !== 9) stats.invalidTrayRecipes += 1;
        for (const type of FRUIT_TYPES) {
          const amount = Number(trayLayer.recipe?.[type]) || 0;
          stats.capacity += amount;
          stats.capacityByType[type] += amount;
        }
      }
    }
  });
  return stats;
}

export function validateLevel(level) {
  ensureTerrainState(level);
  const errors = [];
  const warnings = [];
  const indexOfKey = (key) => {
    const { x, y } = parseCellKey(key);
    return positionToIndex(x, y, level?.grid?.columns ?? 0);
  };
  if (!level?.grid || !Number.isInteger(level.grid.columns) || !Number.isInteger(level.grid.rows)) errors.push("Kích thước grid không hợp lệ.");
  if (level?.grid && (level.grid.columns < 1 || level.grid.rows < 1)) errors.push("Width và Height phải là số nguyên dương.");
  if (!Array.isArray(level?.layers) || level.layers.length === 0) errors.push("Level phải có ít nhất một layer.");

  [{ name: "Map dùng chung", cells: level?.sharedCells ?? {} }, ...(level?.layers ?? [])].forEach((layer) => {
    Object.keys(layer.cells ?? {}).forEach((key) => {
      const { x, y } = parseCellKey(key);
      if (!isInsideGrid(level.grid, x, y)) errors.push(`${layer.name}: Index ${indexOfKey(key)} nằm ngoài grid.`);
    });
  });
  Object.keys(level.grassCells ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    if (!isInsideGrid(level.grid, x, y)) errors.push(`Grass: Index ${indexOfKey(key)} nằm ngoài grid.`);
    if (level.sharedCells?.[key]?.path) errors.push(`Grass Index ${indexOfKey(key)} bị trùng Path.`);
  });
  Object.keys(level.priorityPoints ?? {}).forEach((key) => {
    const { x, y } = parseCellKey(key);
    if (!isInsideGrid(level.grid, x, y)) errors.push(`PriorityPoint: Index ${indexOfKey(key)} nằm ngoài grid.`);
    else if (!level.sharedCells?.[key]?.path) errors.push(`PriorityPoint Index ${indexOfKey(key)} phải thuộc Path.`);
  });

  const stats = collectStats(createMergedLayer(level));
  (level?.layers ?? []).forEach((layer) => {
    const fruits = Object.values(layer.cells ?? {}).filter((cell) => cell.item?.kind === "fruit");
    if (fruits.length > 0) stats.fruitLayers += 1;
    fruits.forEach((cell) => {
      stats.allFruits += 1;
      stats.allFruitsByType[cell.item.fruitType] = (stats.allFruitsByType[cell.item.fruitType] ?? 0) + 1;
    });
  });
  (level?.mysteryFruitElement ?? []).forEach((entry) => { stats.mysteryFruits += entry.index?.length ?? 0; });
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((entry) => {
    stats.countBarriers += 1;
    stats.countBarrierCells += entry.index.length;
  });
  stats.tunnels = normalizeTunnelElement(level?.tunnelElement).length;
  stats.oneWays = normalizeOneWayElement(level?.oneWayElement).length;
  if (!level?.sharedCells) {
    stats.allFruits = stats.fruits;
    stats.allFruitsByType = { ...stats.fruitsByType };
    stats.fruitLayers = stats.fruits > 0 ? 1 : 0;
  }
  stats.snake = Object.values(level?.sharedCells ?? {}).filter((cell) => cell.item?.kind === "snake").length || stats.snake;
  if (stats.snake !== 1) warnings.push(`Cần đúng 1 điểm bắt đầu (hiện có ${stats.snake}).`);
  if (stats.allFruits === 0) warnings.push("Chưa có trái cây trong các layer.");
  if (stats.trays === 0) warnings.push("Chưa có khay chứa trên map.");
  if (stats.invalidTrayRecipes > 0) warnings.push(`Có ${stats.invalidTrayRecipes} khay/layer chưa setup đủ recipe 9/9.`);
  FRUIT_TYPES.forEach((type) => {
    const map = stats.allFruitsByType[type];
    const tray = stats.capacityByType[type];
    if (map === 0 && tray === 0) return;
    if (map > tray) warnings.push(`Khay thiếu ${map - tray} ${blockLabelForFruitType(type)}`);
    else if (map < tray) warnings.push(`Map thiếu ${tray - map} ${blockLabelForFruitType(type)}`);
  });
  const roadKeys = new Set(Object.entries(level?.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
  const roadIndexes = new Set([...roadKeys].map(indexOfKey));
  const countBarrierEndpointIndexes = new Set();
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((barrier) => {
    countBarrierEndpointIndexes.add(barrier.startIndex);
    countBarrierEndpointIndexes.add(barrier.endIndex);
  });
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isBridgeElement(cell.element)) return;
    const index = indexOfKey(key);
    if (![0, 1].includes(cell.element.axis)) errors.push(`Bridge tại Index ${index} có axis không hợp lệ.`);
    else cell.element.axis = normalizeBridgeAxis(cell.element.axis);
  });
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (!isGateElement(cell.element)) return;
    const index = indexOfKey(key);
    if (!cell.path) errors.push(`Gate tại Index ${index} phải nằm trên Path.`);
    if (!isValidGateDirection(cell.element.direction)) {
      errors.push(`Gate tại Index ${index} có direction không hợp lệ.`);
      return;
    }
    cell.element.direction = normalizeGateDirection(cell.element.direction);
  });
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind === "snake" && !cell.path) warnings.push(`Spawn tại Index ${indexOfKey(key)} phải nằm trên Path.`);
    if (cell.item?.kind === "tray") {
      const { x, y } = parseCellKey(key);
      const trayPosition = getTrayVisualPosition(cell.item, { x, y });
      if (trayPosition.x !== x || trayPosition.y + 1 !== y) {
        errors.push(`Khay tại Index ${indexOfKey(key)} có trayPosition không nằm ngay phía trên deliverPoint.`);
      }
      if (!cell.path) warnings.push(`Checkpoint khay tại Index ${indexOfKey(key)} phải nằm trên Path.`);
      getTrayVisualCells(cell.item, { x, y }).forEach((visual) => {
        if (!isInsideGrid(level.grid, visual.x, visual.y)) {
          warnings.push(`Visual khay 3x4 tại checkpoint Index ${indexOfKey(key)} nằm ngoài map.`);
          return;
        }
        const visualKey = `${visual.x},${visual.y}`;
        const visualIndex = positionToIndex(visual.x, visual.y, level.grid.columns);
        const visualShared = level.sharedCells?.[visualKey];
        const visualFruit = (level.layers ?? []).some((layer) => layer.cells?.[visualKey]?.item);
        if (visualKey === key) warnings.push(`Tray visual đang overlap Delivery Point Index ${indexOfKey(key)}.`);
        else if (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit) warnings.push(`Tray visual checkpoint Index ${indexOfKey(key)} overlap data tại Index ${visualIndex}.`);
      });
      if (!Number.isInteger(cell.item.trayId) || cell.item.trayId < 0) warnings.push(`Khay tại Index ${indexOfKey(key)} chưa có trayId hợp lệ.`);
      (cell.item.trayLayers ?? []).forEach((trayLayer, layerIndex) => {
        const hasSelectedBlock = FRUIT_TYPES.some((type) => (Number(trayLayer.recipe?.[type]) || 0) > 0);
        if (!hasSelectedBlock) warnings.push(`Tray #${cell.item.trayId ?? indexOfKey(key)} - Layer ${trayLayer.layer ?? layerIndex} chưa chọn Block.`);
        if ((trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0)) warnings.push(`Khay ${cell.item.trayId} còn item chưa hỗ trợ.`);
      });
    }
  });
  const trayVisualKeys = new Map();
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "tray") return;
    getTrayVisualCells(cell.item, parseCellKey(key)).forEach((visual) => {
      const visualKey = `${visual.x},${visual.y}`;
      if (trayVisualKeys.has(visualKey)) warnings.push(`Khay ${cell.item.trayId} có footprint visual trùng với khay ${trayVisualKeys.get(visualKey)}.`);
      else trayVisualKeys.set(visualKey, cell.item.trayId);
    });
  });
  (level?.layers ?? []).forEach((layer, layerIndex) => Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "fruit") return;
    const index = indexOfKey(key);
    if (!roadKeys.has(key)) warnings.push(`Fruit tại Index ${index} trong layer ${layer.layer ?? layer.name} phải nằm trên Path.`);
    if (countBarrierEndpointIndexes.has(index)) errors.push(`Fruit tại Index ${index} không được đặt tại startIndex/endIndex của Count Barrier.`);
    if (cell.item.unknown) warnings.push(`Layer ${layer.layer ?? layer.name} còn Unknown #${cell.item.itemId ?? cell.item.id}.`);
    if (level.sharedCells?.[key]?.item?.kind === "tray") warnings.push(`Fruit tại Index ${index} trùng checkpoint khay.`);
    if (layerIndex === 0 && isPlayerHeadItem(level.sharedCells?.[key]?.item)) errors.push(`Fruit tại Index ${index} trùng Player Head Layer 1.`);
  }));
  (level?.mysteryFruitElement ?? []).forEach((entry) => {
    const layer = (level.layers ?? []).find((candidate, index) => (Number.isInteger(candidate.layer) ? candidate.layer : index) === entry.layer);
    if (!layer) {
      errors.push(`Mystery Fruit layer ${entry.layer} không tồn tại.`);
      return;
    }
    (entry.index ?? []).forEach((index) => {
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`Mystery Fruit layer ${entry.layer} Index ${index} nằm ngoài grid.`);
        return;
      }
      if (layer.cells?.[`${x},${y}`]?.item?.kind !== "fruit") errors.push(`Mystery Fruit layer ${entry.layer} Index ${index} phải trỏ tới Fruit thật.`);
    });
  });
  const barrierIds = new Set();
  const barrierIndexes = new Set();
  normalizeCountBarrierElement(level?.countBarrierElement).forEach((barrier) => {
    const label = `Count Barrier ${barrier.barrierId}`;
    if (barrierIds.has(barrier.barrierId)) errors.push(`${label} bị trùng barrierId.`);
    barrierIds.add(barrier.barrierId);
    if (!Number.isInteger(barrier.count) || barrier.count < 1) errors.push(`${label} phải có count là số nguyên dương.`);
    if (barrier.index.length < 2) errors.push(`${label} phải khóa ít nhất 2 ô Path.`);
    if (barrier.startIndex === barrier.endIndex) errors.push(`${label} phải có startIndex và endIndex khác nhau.`);
    const localIndexes = new Set();
    barrier.index.forEach((index) => {
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Index ${index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(index)) errors.push(`${label} Index ${index} phải thuộc Path.`);
      if (localIndexes.has(index)) errors.push(`${label} không được chứa index trùng.`);
      if (barrierIndexes.has(index)) errors.push(`Count Barrier không được chồng index ${index}.`);
      localIndexes.add(index);
      barrierIndexes.add(index);
    });
    [barrier.startIndex, barrier.endIndex].forEach((index, endpointOrder) => {
      const name = endpointOrder === 0 ? "startIndex" : "endIndex";
      const { x, y } = indexToPosition(index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) errors.push(`${label} ${name} ${index} nằm ngoài grid.`);
      else if (!roadIndexes.has(index)) errors.push(`${label} ${name} ${index} phải thuộc Path.`);
      if (!localIndexes.has(index)) errors.push(`${label} ${name} phải nằm trong index.`);
    });
  });
  const tunnelIds = new Set();
  const tunnelIndexes = new Set();
  normalizeTunnelElement(level?.tunnelElement).forEach((tunnel) => {
    const label = `Tunnel ${tunnel.tunnelId}`;
    if (tunnelIds.has(tunnel.tunnelId)) errors.push(`${label} bị trùng tunnelId.`);
    tunnelIds.add(tunnel.tunnelId);
    if (tunnel.entryPoints.length !== 2) errors.push(`${label} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    tunnel.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = indexToPosition(point.index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Entry ${name} Index ${point.index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(point.index)) errors.push(`${label} Entry ${name} Index ${point.index} phải thuộc Path.`);
      if (!isValidTunnelDirection(point.direction)) errors.push(`${label} Entry ${name} direction không hợp lệ.`);
      else point.direction = normalizeTunnelDirection(point.direction);
      if (localIndexes.has(point.index)) errors.push(`${label} không được dùng cùng index cho hai entryPoint.`);
      if (tunnelIndexes.has(point.index)) errors.push(`Tunnel không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      tunnelIndexes.add(point.index);
    });
  });
  const oneWayIds = new Set();
  const oneWayIndexes = new Set();
  normalizeOneWayElement(level?.oneWayElement).forEach((oneWay) => {
    const label = `One Way ${oneWay.oneWayId}`;
    if (oneWayIds.has(oneWay.oneWayId)) errors.push(`${label} bị trùng oneWayId.`);
    oneWayIds.add(oneWay.oneWayId);
    if (oneWay.entryPoints.length !== 2) errors.push(`${label} phải có đúng 2 entryPoint.`);
    const localIndexes = new Set();
    oneWay.entryPoints.forEach((point, entryIndex) => {
      const name = entryIndex === 0 ? "A" : "B";
      const { x, y } = indexToPosition(point.index, level.grid.columns);
      if (!isInsideGrid(level.grid, x, y)) {
        errors.push(`${label} Entry ${name} Index ${point.index} nằm ngoài grid.`);
        return;
      }
      if (!roadIndexes.has(point.index)) errors.push(`${label} Entry ${name} Index ${point.index} phải thuộc Path.`);
      if (!isValidOneWayDirection(point.direction)) errors.push(`${label} Entry ${name} direction không hợp lệ.`);
      else point.direction = normalizeOneWayDirection(point.direction);
      if (localIndexes.has(point.index)) errors.push(`${label} không được dùng cùng index cho hai entryPoint.`);
      if (oneWayIndexes.has(point.index)) errors.push(`One Way không được chồng index ${point.index}.`);
      localIndexes.add(point.index);
      oneWayIndexes.add(point.index);
    });
  });
  return { valid: errors.length === 0, exportable: errors.length === 0 && warnings.length === 0, errors, warnings: [...new Set(warnings)], stats };
}
