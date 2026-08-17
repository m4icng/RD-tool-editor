import { createFruit } from "./fruit-object.js";
import { createEmptyTray } from "./tray-object.js";
import { createBridge } from "./bridge-object.js";
import { createGate } from "./gate-object.js";
import { createCountBarrierTool } from "./count-barrier-object.js";
import { createTunnelTool } from "./tunnel-object.js";
import { createOneWayTool } from "./one-way-object.js";
import { MYSTERY_FRUIT_ASSET_ID, TERRAIN_ASSET_IDS } from "../core/constants.js";

const objects = [
  { id: "snake-start", kind: "snake", category: "item", label: "Đầu rắn", icon: "🐍", direction: "right", uniqueOnMap: true },
  createEmptyTray(),
  createFruit("apple", "Táo", "🍎"),
  createFruit("banana", "Chuối", "🍌"),
  createFruit("grape", "Nho", "🍇"),
  createFruit("eggplant", "Cà tím", "🍆"),
  createBridge(),
  createGate(),
  createCountBarrierTool(),
  createTunnelTool(),
  createOneWayTool(),
  { id: MYSTERY_FRUIT_ASSET_ID, kind: "mystery-fruit", category: "element", label: "Mystery Fruit", icon: "?" },
  { id: TERRAIN_ASSET_IDS.GRASS, kind: "terrain", category: "terrain", label: "Grass", icon: "▦" },
  { id: TERRAIN_ASSET_IDS.EMPTY, kind: "terrain", category: "terrain", label: "Terrain trống", icon: "□" },
  { id: TERRAIN_ASSET_IDS.PRIORITY_POINT, kind: "priority-point", category: "terrain", label: "PriorityPoint", icon: "•" }
];

export const OBJECTS = Object.freeze(objects.map(Object.freeze));

export function findObject(id) {
  return OBJECTS.find((object) => String(object.id) === String(id)) ?? null;
}

export function cloneObject(object) {
  return object ? structuredClone(object) : null;
}

export function objectsByCategory(category) {
  return OBJECTS.filter((object) => object.category === category);
}
