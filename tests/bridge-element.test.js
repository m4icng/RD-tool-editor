import test from "node:test";
import assert from "node:assert/strict";
import { applyTool } from "../js/editor/object-placement.js";
import { objectsByCategory } from "../js/objects/object-registry.js";
import { deserializeLevel, serializeLevel } from "../js/data/serializer.js";
import { validateLevel } from "../js/data/validator.js";

function crossLevel(axis = 1) {
  return {
    map: { width: 3, height: 3 },
    Path: { index: [1, 3, 4, 5, 7] },
    Grass: { index: [0, 2, 6, 8] },
    PriorityPoint: { index: [] },
    spawns: [],
    itemLayers: [],
    trays: [],
    bridgeElement: [{ index: 4, axis }]
  };
}

test("palette Element có Bridge", () => {
  const elementIds = objectsByCategory("element").map((object) => object.id);
  assert.ok(elementIds.includes("bridge"));
  assert.ok(elementIds.includes("gate"));
});

test("đặt Bridge lưu vào shared.element và cập nhật axis khi đặt lại cùng ô", () => {
  const state = {
    grid: { columns: 3, rows: 3 },
    tool: "item",
    selectedAssetId: "bridge",
    selectedBridgeAxis: 0,
    activeLayerId: "main",
    sharedCells: { "1,1": { path: true, item: null, element: null } },
    grassCells: {},
    priorityPoints: { "1,1": "manual" },
    selectedCell: null,
    layers: [{ id: "main", cells: {} }]
  };

  applyTool(state, 1, 1);
  assert.equal(state.sharedCells["1,1"].element.kind, "bridge");
  assert.equal(state.sharedCells["1,1"].element.axis, 0);
  assert.equal(state.priorityPoints["1,1"], undefined);

  state.selectedBridgeAxis = 1;
  applyTool(state, 1, 1);
  assert.equal(state.sharedCells["1,1"].element.axis, 1);
});

test("serialize/deserialize Bridge dùng root bridgeElement", () => {
  const state = deserializeLevel(crossLevel(1));
  assert.equal(state.sharedCells["1,1"].element.kind, "bridge");
  assert.equal(state.sharedCells["1,1"].element.axis, 1);

  const json = serializeLevel(state);
  assert.deepEqual(json.bridgeElement, [{ index: 4, axis: 1 }]);
});

test("validator không yêu cầu Bridge có Path đủ trái/phải/trên/dưới", () => {
  const state = deserializeLevel(crossLevel(0));
  assert.equal(validateLevel(state).errors.some((message) => message.includes("Bridge")), false);

  delete state.sharedCells["1,0"];
  const report = validateLevel(state);
  assert.equal(report.errors.some((message) => message.includes("Bridge")), false);
});

test("import từ chối Bridge sai axis nhưng không yêu cầu topology", () => {
  assert.throws(() => deserializeLevel({ ...crossLevel(2), bridgeElement: [{ index: 4, axis: 2 }] }), /axis/);
  assert.doesNotThrow(() => deserializeLevel({ ...crossLevel(0), Path: { index: [3, 4, 5] }, Grass: { index: [0, 1, 2, 6, 7, 8] } }));
});

test("import từ chối Bridge duplicate index", () => {
  assert.throws(() => deserializeLevel({
    ...crossLevel(0),
    bridgeElement: [{ index: 4, axis: 0 }, { index: 4, axis: 1 }]
  }), /trùng/);
});
