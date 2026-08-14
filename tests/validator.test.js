import test from "node:test";
import assert from "node:assert/strict";
import { validateLevel } from "../js/data/validator.js";

function levelWith(cells) {
  return { grid: { columns: 5, rows: 4 }, activeLayerId: "main", layers: [{ id: "main", name: "Layer 01", visible: true, cells }] };
}

test("validator chấp nhận cấu trúc grid hợp lệ và cân bằng delivery", () => {
  const report = validateLevel(levelWith({
    "0,0": { path: true, item: { kind: "snake" } },
    "1,0": { path: true, item: { kind: "fruit", fruitType: "apple" } },
    "2,0": { path: true, item: { kind: "truck", fruitType: "apple", capacity: 1 } }
  }));
  assert.equal(report.valid, true);
  assert.equal(report.warnings.length, 0);
  assert.equal(report.stats.fruits, 1);
});

test("validator báo ô nằm ngoài grid", () => {
  const report = validateLevel(levelWith({ "9,9": { path: true, item: null } }));
  assert.equal(report.valid, false);
  assert.match(report.errors[0], /nằm ngoài grid/);
});
