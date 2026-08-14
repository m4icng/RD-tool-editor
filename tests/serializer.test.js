import test from "node:test";
import assert from "node:assert/strict";
import { deserializeLevel, serializeLevel } from "../js/data/serializer.js";

test("serialize/deserialize giữ nguyên grid và cells", () => {
  const state = {
    grid: { columns: 6, rows: 5 },
    layers: [{ id: "layer-1", name: "Layer 01", visible: true, cells: { "1,2": { path: true, item: null } } }],
    activeLayerId: "layer-1"
  };
  const restored = deserializeLevel(serializeLevel(state));
  assert.deepEqual(restored.grid, state.grid);
  assert.deepEqual(restored.layers, state.layers);
  assert.equal(restored.activeLayerId, "layer-1");
});

test("migrate schema v1 với cells dạng entries", () => {
  const restored = deserializeLevel({
    schemaVersion: 1,
    grid: { columns: 4, rows: 4 },
    activeLayerId: "old",
    layers: [{ id: "old", name: "Layer 01", visible: true, cells: [["0,0", { path: true, item: null }]] }]
  });
  assert.deepEqual(restored.layers[0].cells["0,0"], { path: true, item: null });
});
