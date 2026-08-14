import { FRUIT_TYPES } from "../core/constants.js";
import { createMergedLayer, ensureTerrainState, getTrayVisualPosition, isInsideGrid, parseCellKey, positionToIndex } from "../utils/grid-utils.js";

export function collectStats(layer) {
  const stats = {
    paths: 0, items: 0, snake: 0, fruits: 0, capacity: 0,
    trays: 0, trayLayers: 0, invalidTrayRecipes: 0,
    allFruits: 0, fruitLayers: 0,
    fruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    allFruitsByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0])),
    capacityByType: Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]))
  };
  Object.values(layer?.cells ?? {}).forEach((cell) => {
    if (cell.path) stats.paths += 1;
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
  const balanced = FRUIT_TYPES.every((type) => stats.allFruitsByType[type] === stats.capacityByType[type]);
  if (!balanced || stats.allFruits === 0) warnings.push("Tổng trái cây của các layer và recipe khay chưa khớp.");
  const roadKeys = new Set(Object.entries(level?.sharedCells ?? {}).filter(([, cell]) => cell.path).map(([key]) => key));
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind === "snake" && !cell.path) warnings.push(`Spawn tại Index ${indexOfKey(key)} phải nằm trên Path.`);
    if (cell.item?.kind === "tray") {
      const { x, y } = parseCellKey(key);
      if (!cell.path) warnings.push(`Checkpoint khay tại Index ${indexOfKey(key)} phải nằm trên Path.`);
      const visual = getTrayVisualPosition(cell.item, { x, y });
      const visualIndex = positionToIndex(visual.x, visual.y, level.grid.columns);
      if (!isInsideGrid(level.grid, visual.x, visual.y)) warnings.push(`Visual khay tại checkpoint Index ${indexOfKey(key)} nằm ngoài map.`);
      const visualKey = `${visual.x},${visual.y}`;
      const visualShared = level.sharedCells?.[visualKey];
      const visualFruit = (level.layers ?? []).some((layer) => layer.cells?.[visualKey]?.item);
      if (isInsideGrid(level.grid, visual.x, visual.y) && (visualShared?.path || visualShared?.item || visualShared?.element || visualFruit)) warnings.push(`Ô visual Index ${visualIndex} của khay checkpoint Index ${indexOfKey(key)} phải để trống.`);
      if (!Number.isInteger(cell.item.trayId) || cell.item.trayId < 0) warnings.push(`Khay tại Index ${indexOfKey(key)} chưa có trayId hợp lệ.`);
      (cell.item.trayLayers ?? []).forEach((trayLayer) => {
        if ((trayLayer.unknownItems ?? []).some((item) => Number(item.count) > 0)) warnings.push(`Khay ${cell.item.trayId} còn item chưa hỗ trợ.`);
      });
    }
  });
  const trayVisualKeys = new Map();
  Object.entries(level?.sharedCells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "tray") return;
    const visual = getTrayVisualPosition(cell.item, parseCellKey(key));
    const visualKey = `${visual.x},${visual.y}`;
    if (trayVisualKeys.has(visualKey)) warnings.push(`Khay ${cell.item.trayId} có visual trùng với khay ${trayVisualKeys.get(visualKey)}.`);
    else trayVisualKeys.set(visualKey, cell.item.trayId);
  });
  (level?.layers ?? []).forEach((layer) => Object.entries(layer.cells ?? {}).forEach(([key, cell]) => {
    if (cell.item?.kind !== "fruit") return;
    if (!roadKeys.has(key)) warnings.push(`Fruit tại Index ${indexOfKey(key)} trong layer ${layer.layer ?? layer.name} phải nằm trên Path.`);
    if (cell.item.unknown) warnings.push(`Layer ${layer.layer ?? layer.name} còn Unknown #${cell.item.itemId ?? cell.item.id}.`);
    if (level.sharedCells?.[key]?.item?.kind === "tray") warnings.push(`Fruit tại Index ${indexOfKey(key)} trùng checkpoint khay.`);
  }));
  return { valid: errors.length === 0, exportable: errors.length === 0 && warnings.length === 0, errors, warnings: [...new Set(warnings)], stats };
}
