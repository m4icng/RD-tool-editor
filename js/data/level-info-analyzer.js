import { deserializeLevel } from "./serializer.js";
import { validateLevel } from "./validator.js";
import { evaluateDifficulty } from "../generate/difficulty-evaluator.js";

export const LEVEL_INFO_ITEM_META = Object.freeze({
  1: { label: "Đỏ", color: "#e54b4b" },
  2: { label: "Vàng", color: "#f1c232" },
  3: { label: "Xanh biển", color: "#3b82f6" },
  4: { label: "Hồng", color: "#ec4899" },
  5: { label: "Tím", color: "#8b5cf6" },
  6: { label: "Xanh lá", color: "#22c55e" },
  7: { label: "Cam", color: "#f97316" }
});

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => Array.isArray(value) ? value : [];

function normalizeTrayGroupsForInfo(rawTrays) {
  if (Array.isArray(rawTrays)) return rawTrays;
  if (!isObject(rawTrays) || !Array.isArray(rawTrays.layers)) return [];
  const groups = new Map();
  rawTrays.layers.forEach((layer) => {
    const trayId = Number.isInteger(layer?.trayId) ? layer.trayId : 0;
    const group = groups.get(trayId) ?? { trayId, layers: [] };
    group.layers.push(layer);
    groups.set(trayId, group);
  });
  return [...groups.values()].sort((a, b) => a.trayId - b.trayId);
}

function addItemId(target, itemId) {
  const numeric = Number(itemId);
  if (Number.isInteger(numeric) && numeric > 0) target.add(numeric);
}

function collectMapItemIds(raw, itemIds) {
  asArray(raw?.itemLayers).forEach((layer) => {
    asArray(layer?.items).forEach((item) => addItemId(itemIds, item?.itemId));
  });
}

function collectTrayItemIds(trays, itemIds) {
  trays.forEach((tray) => {
    asArray(tray?.layers).forEach((layer) => {
      asArray(layer?.items).forEach((item) => addItemId(itemIds, item?.itemId));
    });
  });
}

function basicInfo(raw) {
  const warnings = [];
  if (!isObject(raw?.map)) warnings.push("Missing map");
  if (!Array.isArray(raw?.itemLayers)) warnings.push("Missing itemLayers");
  if (!Array.isArray(raw?.trays) && !isObject(raw?.trays)) warnings.push("Missing trays");

  const trays = normalizeTrayGroupsForInfo(raw?.trays);
  const itemIds = new Set();
  collectMapItemIds(raw, itemIds);
  collectTrayItemIds(trays, itemIds);

  return {
    mapWidth: Number.isInteger(raw?.map?.width) ? raw.map.width : null,
    mapHeight: Number.isInteger(raw?.map?.height) ? raw.map.height : null,
    trayCount: trays.length,
    trayLayerCount: trays.reduce((sum, tray) => sum + asArray(tray?.layers).length, 0),
    itemLayerCount: asArray(raw?.itemLayers).length,
    itemIds: [...itemIds].sort((a, b) => a - b),
    itemTypeCount: itemIds.size,
    warnings
  };
}

export function analyzeLevelInfo(rawData, { fileName = "untitled-level.json" } = {}) {
  if (!isObject(rawData)) throw new Error("Root JSON phải là object.");
  const basic = basicInfo(rawData);
  const warnings = [...basic.warnings];
  let difficulty = {
    evaluable: false,
    score: null,
    score100: null,
    label: "Không thể đánh giá",
    issues: []
  };

  try {
    const temporaryLevel = deserializeLevel(rawData, { fileName });
    temporaryLevel.generateSettings = rawData.generateSettings;
    temporaryLevel.generationMeta = rawData.generationMeta;
    const validation = validateLevel(temporaryLevel);
    const blocksDifficulty = validation.errors.length > 0
      || validation.stats.snake !== 1
      || validation.stats.paths === 0
      || validation.stats.trays === 0;
    if (blocksDifficulty) {
      warnings.push("Level data chưa hợp lệ");
    } else {
      difficulty = evaluateDifficulty(temporaryLevel, temporaryLevel.generateSettings);
      if (!difficulty.evaluable) warnings.push("Level data chưa hợp lệ");
    }
  } catch (error) {
    warnings.push(error.message || "Level data chưa hợp lệ");
  }

  return {
    fileName,
    ...basic,
    difficultyScore: difficulty.score,
    difficultyScore100: difficulty.score100,
    difficultyLabel: difficulty.label,
    validationStatus: warnings.length ? "warning" : "valid",
    warnings
  };
}
