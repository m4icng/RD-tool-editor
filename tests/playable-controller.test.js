import test from "node:test";
import assert from "node:assert/strict";
import {
  PLAY_STATUS,
  availableDirections,
  createPlayableSession,
  movePlayableSession,
  validatePlayableLevel
} from "../js/gameplay/playable-controller.js";

function createStraightLevel() {
  const cells = {};
  for (let x = 0; x <= 10; x += 1) cells[`${x},1`] = { path: true, item: null };
  cells["0,1"].item = { id: "snake-start", kind: "snake", label: "Đầu rắn" };
  for (let x = 1; x <= 9; x += 1) {
    cells[`${x},1`].item = { id: "fruit-apple", kind: "fruit", fruitType: "apple", label: "Táo", icon: "🍎" };
  }
  cells["10,1"].item = {
    id: "tray-empty",
    kind: "tray",
    label: "Khay chứa",
    capacity: 9,
    trayLayers: [{ id: "tray-layer-1", recipe: { apple: 9, banana: 0, grape: 0, eggplant: 0 } }]
  };
  return {
    grid: { columns: 11, rows: 3 },
    activeLayerId: "main",
    layers: [{ id: "main", name: "Layer 01", cells }]
  };
}

test("playable validator chặn khay trống chưa có recipe", () => {
  const level = createStraightLevel();
  level.layers[0].cells["10,1"].item.trayLayers = [];
  const report = validatePlayableLevel(level);
  assert.equal(report.valid, false);
  assert.match(report.errors.join(" "), /chưa có layer recipe/);
});

test("phiên chơi bắt đầu ở trạng thái ready và chờ hướng đầu tiên", () => {
  const session = createPlayableSession(createStraightLevel());
  assert.equal(session.status, PLAY_STATUS.READY);
  assert.deepEqual(availableDirections(session), ["right"]);
});

test("fruit nối đúng thứ tự vào đuôi và khay nhận đủ để thắng", () => {
  const session = createPlayableSession(createStraightLevel(), { mode: "step" });
  for (let step = 0; step < 9; step += 1) {
    const result = movePlayableSession(session, "right");
    assert.equal(result.moved, true);
    assert.equal(session.snake.body.length, step + 2);
    assert.ok(session.snake.body.slice(1).every((segment) => segment.fruitType === "apple"));
  }
  movePlayableSession(session, "right");
  assert.equal(session.snake.body.length, 1);
  assert.equal(session.trays[0].activeIndex, 1);
  assert.equal(session.status, PLAY_STATUS.WON);
});

test("khóa quay đầu khi rắn đang có đuôi", () => {
  const session = createPlayableSession(createStraightLevel(), { mode: "step" });
  movePlayableSession(session, "right");
  assert.equal(session.snake.body.length, 2);
  assert.ok(!availableDirections(session).includes("left"));
});
