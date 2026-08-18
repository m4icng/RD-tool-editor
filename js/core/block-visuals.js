import { FRUIT_TYPES } from "./constants.js";
import { FRUIT_ITEM_IDS } from "../objects/fruit-object.js";

export const TRAIN_HEAD_ICON = "🚂";
export const BLOCK_ITEM_GLYPH = "■";

export const BLOCK_ITEM_COLORS = Object.freeze({
  1: "#e53935",
  2: "#f6d33f",
  3: "#2f7eea",
  4: "#f062a7",
  5: "#8e44ad",
  6: "#34a853",
  7: "#f28c28"
});

const BLOCK_ITEM_LABELS = Object.freeze({
  1: "Block đỏ",
  2: "Block vàng",
  3: "Block xanh biển",
  4: "Block hồng",
  5: "Block tím",
  6: "Block xanh lá",
  7: "Block cam"
});

export function blockItemIdFromFruitType(fruitType) {
  return Number(FRUIT_ITEM_IDS[fruitType]) || null;
}

export function blockItemIdFromItem(itemOrType) {
  if (typeof itemOrType === "string" && FRUIT_TYPES.includes(itemOrType)) return blockItemIdFromFruitType(itemOrType);
  const directId = Number(itemOrType?.itemId ?? itemOrType?.id);
  if (Number.isInteger(directId) && directId > 0) return directId;
  return blockItemIdFromFruitType(itemOrType?.fruitType);
}

export function blockVisualMeta(itemOrType) {
  const itemId = blockItemIdFromItem(itemOrType);
  return {
    itemId,
    color: BLOCK_ITEM_COLORS[itemId] ?? "#94a3b8",
    label: BLOCK_ITEM_LABELS[itemId] ?? `Block #${itemId ?? "?"}`
  };
}

export function blockLabelForFruitType(fruitType) {
  return blockVisualMeta(fruitType).label;
}

export function applyBlockItemVisual(element, itemOrType, { mystery = false } = {}) {
  element.classList.add("block-item-visual");
  if (mystery) {
    element.classList.add("mystery-fruit-preview");
    element.textContent = "❓";
    element.title = "Mystery Item";
    element.removeAttribute("data-item-id");
    element.style.removeProperty("--block-color");
    return element;
  }
  const meta = blockVisualMeta(itemOrType);
  element.classList.remove("mystery-fruit-preview");
  element.textContent = "";
  element.title = meta.label;
  element.dataset.itemId = String(meta.itemId ?? "");
  element.style.setProperty("--block-color", meta.color);
  return element;
}

export function createBlockSwatch(itemOrType, className = "block-swatch") {
  const swatch = document.createElement("span");
  swatch.className = className;
  applyBlockItemVisual(swatch, itemOrType);
  return swatch;
}
