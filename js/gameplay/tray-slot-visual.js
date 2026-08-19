import { FRUIT_TYPES } from "../core/constants.js";
import { blockVisualMeta } from "../core/block-visuals.js";

export const TRAY_SLOT_COUNT = 9;

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
        color: meta.color,
        label: meta.label,
        filled: index < delivered
      });
    }
  });
  while (slots.length < TRAY_SLOT_COUNT) {
    slots.push({ type: null, color: "#cbd5e1", label: "Chua setup requirement", filled: false, placeholder: true });
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
