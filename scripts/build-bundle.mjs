import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceFiles = [
  "js/core/constants.js",
  "js/core/event-bus.js",
  "js/core/history-manager.js",
  "js/core/visual-scale.js",
  "js/core/player-head-layer-rule.js",
  "js/utils/id-generator.js",
  "js/utils/grid-utils.js",
  "js/utils/math-utils.js",
  "js/utils/grouped-element-ids.js",
  "js/utils/file-utils.js",
  "js/objects/path-object.js",
  "js/objects/fruit-object.js",
  "js/core/block-visuals.js",
  "js/core/tray-slot-visual.js",
  "js/objects/truck-object.js",
  "js/objects/tray-object.js",
  "js/objects/tray-position-sync.js",
  "js/objects/obstacle-object.js",
  "js/objects/bridge-object.js",
  "js/objects/gate-object.js",
  "js/objects/element-placement-rules.js",
  "js/objects/count-barrier-object.js",
  "js/objects/tunnel-object.js",
  "js/objects/one-way-object.js",
  "js/objects/object-registry.js",
  "js/core/editor-state.js",
  "js/data/level-schema.js",
  "js/data/migration.js",
  "js/data/serializer.js",
  "js/data/validator.js",
  "js/data/directory-handle-storage.js",
  "js/data/directory-permission-service.js",
  "js/data/data-folder-scanner.js",
  "js/data/file-manager.js",
  "js/generate/generate-settings.js",
  "js/generate/item-layer-locks.js",
  "js/generate/generate-source.js",
  "js/generate/adaptive-parameters.js",
  "js/generate/cluster-distribution.js",
  "js/generate/generator-engine.js",
  "js/editor/delete-resolver.js",
  "js/editor/batch-color-remap.js",
  "js/editor/object-placement.js",
  "js/editor/selection-manager.js",
  "js/editor/camera-controller.js",
  "js/editor/grid-renderer.js",
  "js/editor/input-controller.js",
  "js/ui/notification.js",
  "js/ui/object-palette.js",
  "js/ui/batch-color-dialog.js",
  "js/ui/tray-editor.js",
  "js/ui/data-summary.js",
  "js/ui/panel-resizer.js",
  "js/ui/grid-index-tooltip.js",
  "js/ui/generate-panel.js",
  "js/ui/toolbar.js",
  "js/ui/inspector-panel.js",
  "js/ui/level-settings.js",
  "js/gameplay/snake-movement.js",
  "js/gameplay/collision-system.js",
  "js/gameplay/delivery-system.js",
  "js/gameplay/win-condition.js",
  "js/gameplay/tunnel-transit.js",
  "js/gameplay/simulator.js",
  "js/gameplay/shovel-booster.js",
  "js/gameplay/tray-fill-system.js",
  "js/gameplay/lose-revive.js",
  "js/gameplay/playable-settings.js",
  "js/gameplay/layer-spawn-runtime.js",
  "js/gameplay/playable-controller.js",
  "js/app.js"
];

function removeModuleSyntax(source, file) {
  if (/^export\s+\{[\s\S]*?\}\s+from\s+["'][^"']+["'];\s*$/m.test(source)) {
    throw new Error(`Unsupported re-export in ${file}. Import the symbol normally and export it from its owning module.`);
  }

  return source
    .replace(/^import\s+[\s\S]*?\s+from\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^import\s+["'][^"']+["'];\s*$/gm, "")
    .replace(/^export\s+/gm, "");
}

const banner = `/*
 * AUTO-GENERATED FILE — do not edit directly.
 * Run: npm run build
 * Source: ES modules under js/.
 */`;
const body = sourceFiles.map((file) => {
  const source = readFileSync(resolve(projectRoot, file), "utf8");
  return `\n// ---- ${file} ----\n${removeModuleSyntax(source, file)}`;
}).join("\n");

const bundle = `${banner}\n(() => {\n"use strict";\n${body}\n})();\n`;

try {
  new Function(bundle);
} catch (error) {
  throw new Error(`Generated bundle is invalid: ${error.message}`);
}

writeFileSync(resolve(projectRoot, "js/app.bundle.js"), bundle, "utf8");
console.log(`Built js/app.bundle.js from ${sourceFiles.length} modules.`);
