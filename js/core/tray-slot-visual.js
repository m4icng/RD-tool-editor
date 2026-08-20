import { FRUIT_TYPES } from "./constants.js";
import { blockItemIdFromFruitType, blockVisualMeta } from "./block-visuals.js";

export const TRAY_SLOT_COUNT = 9;

function emptyRecipe() {
  return Object.fromEntries(FRUIT_TYPES.map((type) => [type, 0]));
}

function normalizedLayer(layer) {
  if (!layer) return null;
  return {
    ...layer,
    recipe: { ...emptyRecipe(), ...(layer.recipe ?? {}) },
    delivered: { ...emptyRecipe(), ...(layer.delivered ?? {}) }
  };
}

export function trayLayerForDisplay(item, layerNumber = 0) {
  if (!item) return null;
  if (item.kind === "truck") {
    const fruitType = FRUIT_TYPES.includes(item.fruitType) ? item.fruitType : null;
    const recipe = emptyRecipe();
    if (fruitType) recipe[fruitType] = Number(item.capacity) || 0;
    return { id: `${item.id ?? "legacy-truck"}-display-layer`, layer: 0, recipe, delivered: emptyRecipe() };
  }
  const layers = item.trayLayers ?? [];
  const exactLayer = layers.find((layer, index) => (Number.isInteger(layer.layer) ? layer.layer : index) === layerNumber);
  return normalizedLayer(exactLayer);
}

export function trayLayerSlotDescriptors(layer) {
  if (!layer) return [];
  const slots = [];
  FRUIT_TYPES.forEach((type) => {
    const required = Math.max(0, Number(layer.recipe?.[type]) || 0);
    const delivered = Math.min(Math.max(0, Number(layer.delivered?.[type]) || 0), required);
    for (let index = 0; index < required && slots.length < TRAY_SLOT_COUNT; index += 1) {
      const meta = blockVisualMeta(type);
      slots.push({
        type,
        itemId: blockItemIdFromFruitType(type),
        color: meta.color,
        label: meta.label,
        filled: index < delivered
      });
    }
  });
  while (slots.length < TRAY_SLOT_COUNT) {
    slots.push({ type: null, itemId: null, color: "#cbd5e1", label: "Chua setup requirement", filled: false, placeholder: true });
  }
  return slots;
}

export function trayLayerNeedTitle(layer) {
  if (!layer) return "Khay da hoan thanh";
  const needs = trayLayerSlotDescriptors(layer)
    .filter((slot) => !slot.placeholder)
    .reduce((summary, slot) => {
      summary[slot.type] ??= { label: slot.label, required: 0, delivered: 0 };
      summary[slot.type].required += 1;
      if (slot.filled) summary[slot.type].delivered += 1;
      return summary;
    }, {});
  const text = Object.values(needs).map((need) => `${need.label} ${need.delivered}/${need.required}`);
  return text.length > 0 ? `Khay can: ${text.join(", ")}` : "Layer khong co requirement";
}

export function createTrayRequirementSlot(slot) {
  const element = document.createElement("span");
  element.className = `tray-requirement-slot${slot?.filled ? " filled" : " empty"}${slot?.placeholder ? " placeholder" : ""}`;
  element.style.setProperty("--block-color", slot?.color ?? "#cbd5e1");
  element.title = slot?.placeholder
    ? "Chua setup requirement"
    : slot?.filled ? `${slot.label} da dien` : `${slot.label} con thieu`;
  return element;
}

export function renderTraySlotGrid(container, layer) {
  container.replaceChildren();
  if (!layer) {
    container.textContent = "✓";
    container.classList.add("complete");
    return;
  }
  container.classList.remove("complete");
  trayLayerSlotDescriptors(layer).forEach((slot) => {
    container.appendChild(createTrayRequirementSlot(slot));
  });
}
