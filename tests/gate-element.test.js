import test from "node:test";
import assert from "node:assert/strict";
import { applyTool } from "../js/editor/object-placement.js";
import { objectsByCategory } from "../js/objects/object-registry.js";
import { deserializeLevel, serializeLevel } from "../js/data/serializer.js";
import { validateLevel } from "../js/data/validator.js";
import { availableDirections, createPlayableSession, movePlayableSession } from "../js/gameplay/playable-controller.js";

function gateLevel(direction = 2) {
  return {
    map: { width: 3, height: 3 },
    Path: { index: [3, 4, 5] },
    Grass: { index: [0, 1, 2, 6, 7, 8] },
    PriorityPoint: { index: [] },
    spawns: [{ index: 3 }],
    itemLayers: [{ layer: 0, items: [{ itemId: 0, index: [4] }] }],
    trays: [{
      trayId: 0,
      deliverPoint: { index: 5 },
      trayPosition: { index: 2 },
      layers: [{ layer: 0, items: [{ itemId: 0, count: 1 }] }]
    }],
    bridgeElement: [],
    gateElement: [{ index: 5, direction }]
  };
}

function playableGateLevel(direction = 2) {
  const sharedCells = {};
  const layerCells = {};
  for (let x = 0; x <= 10; x += 1) sharedCells[`${x},1`] = { path: true, item: null, element: null };
  sharedCells["0,1"].item = { id: "snake-start", kind: "snake", label: "Đầu rắn" };
  sharedCells["10,1"].item = {
    id: "tray-0",
    trayId: 0,
    kind: "tray",
    label: "Khay chứa",
    icon: "🧺",
    trayPosition: { x: 10, y: 0 },
    trayLayers: [{ id: "tray-layer-1", recipe: { apple: 9, banana: 0, grape: 0, eggplant: 0 } }]
  };
  sharedCells["10,1"].element = { id: "gate", kind: "gate", category: "element", direction };
  for (let x = 1; x <= 9; x += 1) {
    layerCells[`${x},1`] = { item: { id: "fruit-apple", kind: "fruit", fruitType: "apple", label: "Táo", icon: "🍎" } };
  }
  return {
    grid: { columns: 11, rows: 3 },
    activeLayerId: "main",
    sharedCells,
    grassCells: {},
    priorityPoints: {},
    layers: [{ id: "main", name: "Layer 01", cells: layerCells }]
  };
}

test("palette Element có Gate", () => {
  assert.ok(objectsByCategory("element").some((object) => object.id === "gate"));
});

test("đặt Gate yêu cầu Path và cập nhật direction khi đặt lại cùng ô", () => {
  const state = {
    grid: { columns: 3, rows: 3 },
    tool: "item",
    selectedAssetId: "gate",
    selectedGateDirection: 2,
    activeLayerId: "main",
    sharedCells: { "1,1": { path: true, item: null, element: null } },
    grassCells: {},
    priorityPoints: {},
    selectedCell: null,
    layers: [{ id: "main", cells: {} }]
  };

  applyTool(state, 1, 1);
  assert.equal(state.sharedCells["1,1"].element.kind, "gate");
  assert.equal(state.sharedCells["1,1"].element.direction, 2);

  state.selectedGateDirection = 3;
  applyTool(state, 1, 1);
  assert.equal(state.sharedCells["1,1"].element.direction, 3);

  state.sharedCells["0,0"] = { path: false, item: null, element: null };
  const result = applyTool(state, 0, 0);
  assert.deepEqual(result, { changed: false, reason: "gate-needs-path", objectId: "gate" });
});

test("serialize/deserialize Gate dùng root gateElement", () => {
  const state = deserializeLevel(gateLevel(2));
  assert.equal(state.sharedCells["2,1"].element.kind, "gate");
  assert.equal(state.sharedCells["2,1"].element.direction, 2);

  const json = serializeLevel(state);
  assert.deepEqual(json.gateElement, [{ index: 5, direction: 2 }]);
});

test("validator cho phép Gate nằm bất kỳ trên Path", () => {
  const valid = deserializeLevel(gateLevel(2));
  assert.equal(validateLevel(valid).errors.some((message) => message.includes("Gate")), false);

  const middleGate = deserializeLevel({ ...gateLevel(0), gateElement: [{ index: 4, direction: 0 }] });
  assert.equal(validateLevel(middleGate).errors.some((message) => message.includes("Gate")), false);

  const anyDirection = deserializeLevel(gateLevel(3));
  assert.equal(validateLevel(anyDirection).errors.some((message) => message.includes("Gate")), false);
});

test("import từ chối Gate sai direction hoặc duplicate index", () => {
  assert.throws(() => deserializeLevel({ ...gateLevel(2), gateElement: [{ index: 5, direction: 4 }] }), /direction/);
  assert.throws(() => deserializeLevel({ ...gateLevel(2), gateElement: [{ index: 5, direction: 2 }, { index: 5, direction: 3 }] }), /trùng/);
});

test("playable Gate chỉ cho đi cùng hướng mũi tên", () => {
  const passSession = createPlayableSession(playableGateLevel(2), { mode: "step" });
  const blockSession = createPlayableSession(playableGateLevel(3), { mode: "step" });
  for (let step = 0; step < 9; step += 1) {
    assert.equal(movePlayableSession(passSession, "right").moved, true);
    assert.equal(movePlayableSession(blockSession, "right").moved, true);
  }
  assert.deepEqual(availableDirections(passSession), ["right"]);
  assert.deepEqual(availableDirections(blockSession), []);
});
