import { GATE_ASSET_ID, GATE_DIRECTIONS } from "../core/constants.js";

export const GATE_DIRECTION_META = Object.freeze({
  [GATE_DIRECTIONS.UP]: { key: "up", label: "Up", className: "up" },
  [GATE_DIRECTIONS.DOWN]: { key: "down", label: "Down", className: "down" },
  [GATE_DIRECTIONS.RIGHT]: { key: "right", label: "Right", className: "right" },
  [GATE_DIRECTIONS.LEFT]: { key: "left", label: "Left", className: "left" }
});

export function createGate(direction = GATE_DIRECTIONS.UP) {
  return {
    id: GATE_ASSET_ID,
    kind: "gate",
    category: "element",
    label: "Gate",
    icon: ">",
    direction: normalizeGateDirection(direction)
  };
}

export function isGateElement(element) {
  return element?.kind === "gate";
}

export function normalizeGateDirection(value) {
  const direction = Number(value);
  return Object.hasOwn(GATE_DIRECTION_META, direction) ? direction : GATE_DIRECTIONS.UP;
}

export function isValidGateDirection(value) {
  return Number.isInteger(value) && Object.hasOwn(GATE_DIRECTION_META, value);
}

export function gateDirectionLabel(direction) {
  return GATE_DIRECTION_META[normalizeGateDirection(direction)].label;
}

export function gateDirectionClass(direction) {
  return GATE_DIRECTION_META[normalizeGateDirection(direction)].className;
}

export function gateDirectionFromMovement(direction) {
  const entry = Object.entries(GATE_DIRECTION_META).find(([, meta]) => meta.key === direction);
  return entry ? Number(entry[0]) : null;
}
