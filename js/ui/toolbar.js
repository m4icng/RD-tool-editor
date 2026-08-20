import { ERASE_MODE_LABELS, TOOL_LABELS } from "../core/constants.js";

export function renderToolbar(editor, elements) {
  if (!ERASE_MODE_LABELS[editor.data.eraseMode]) editor.data.eraseMode = "smart";
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === editor.data.tool));
  const eraseLabel = ERASE_MODE_LABELS[editor.data.eraseMode ?? "smart"];
  document.querySelector("#eraseToolBtn .tool-label").textContent = `Xóa: ${eraseLabel}`;
  document.querySelectorAll("[data-erase-mode]").forEach((button) => {
    const active = button.dataset.eraseMode === (editor.data.eraseMode ?? "smart");
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.activeToolBadge.textContent = editor.data.tool === "erase" ? `Xóa: ${eraseLabel}` : TOOL_LABELS[editor.data.tool];
  elements.undoBtn.disabled = !editor.history.canUndo;
  elements.redoBtn.disabled = !editor.history.canRedo;
}

export function activateTab(tab, editorData, elements) {
  editorData.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  const isLevel = tab === "level";
  const isGenerate = tab === "generate";
  const isPlayable = tab === "playable";
  const isJson = tab === "json";
  elements.levelWorkspace.classList.toggle("hidden", isPlayable);
  elements.playableWorkspace.classList.toggle("hidden", !isPlayable);
  document.querySelectorAll(".level-rail-content").forEach((element) => element.classList.toggle("hidden", !isLevel));
  elements.jsonFolderCard.classList.toggle("hidden", !isJson);
  elements.generateResultCard?.classList.toggle("hidden", !isGenerate);
  elements.levelRightRail.classList.toggle("json-mode", isJson || isGenerate);
  elements.canvasArea.classList.toggle("read-only", isJson || isGenerate);
  elements.gridBoard.setAttribute("aria-readonly", String(isJson || isGenerate));
  elements.levelControls.classList.toggle("hidden", !isLevel);
  elements.generateControls?.classList.toggle("hidden", !isGenerate);
  elements.playableControls.classList.toggle("hidden", !isPlayable);
  elements.jsonControls.classList.toggle("hidden", !isJson);
  elements.levelActions.classList.toggle("hidden", !isLevel);
  elements.generateActions?.classList.toggle("hidden", !isGenerate);
  elements.jsonActions.classList.toggle("hidden", !isJson);
  elements.levelLayerPicker.classList.toggle("hidden", isPlayable);
  elements.levelLayerPicker.classList.toggle("read-only", isJson || isGenerate);
  elements.levelLayerPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("hidden", isJson || isGenerate));
  if (isJson) elements.activeToolBadge.textContent = "Chỉ xem";
  else if (isGenerate) elements.activeToolBadge.textContent = "Xem trước sinh";
  else if (isLevel) {
    const eraseMode = ERASE_MODE_LABELS[editorData.eraseMode] ? editorData.eraseMode : "smart";
    elements.activeToolBadge.textContent = editorData.tool === "erase"
    ? `Xóa: ${ERASE_MODE_LABELS[eraseMode]}`
    : TOOL_LABELS[editorData.tool];
  }
  elements.placeholderView.classList.add("hidden");
  elements.topbarEyebrow.textContent = isPlayable ? "Playable / Snapshot màn chơi" : isGenerate ? "Sinh màn / Tự động sinh vật phẩm" : isLevel ? "Level Design / Layer fruit đang chọn" : "Data JSON / Map editor hiện tại";
}
