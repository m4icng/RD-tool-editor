import test from "node:test";
import assert from "node:assert/strict";
import { createSimulation, stepSimulation } from "../js/gameplay/simulator.js";

const level = {
  grid: { columns: 4, rows: 4 },
  activeLayerId: "main",
  layers: [{
    id: "main", name: "Layer 01", visible: true,
    cells: {
      "0,1": { path: true, item: { kind: "snake", direction: "right" } },
      "1,1": { path: true, item: { kind: "fruit", fruitType: "apple" } },
      "2,1": { path: true, item: { kind: "truck", fruitType: "apple", capacity: 1 } }
    }
  }]
};

test("simulation thu thập fruit, giao đúng truck và thắng", () => {
  let simulation = createSimulation(level);
  simulation = stepSimulation(simulation, "right");
  assert.equal(simulation.inventory.apple, 1);
  simulation = stepSimulation(simulation, "right");
  assert.equal(simulation.inventory.apple, 0);
  assert.equal(simulation.delivered.apple, 1);
  assert.equal(simulation.status, "won");
});

test("simulation thua khi đi ra khỏi path", () => {
  const simulation = stepSimulation(createSimulation(level), "up");
  assert.equal(simulation.status, "lost");
  assert.equal(simulation.lastCollision.type, "off-path");
});
