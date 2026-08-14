import { ERASE_MODE_LABELS, TOOL_LABELS } from "../core/constants.js";

export function renderToolbar(editor, elements) {
  document.querySelectorAll("[data-tool]").forEach((button) => button.classList.toggle("active", button.dataset.tool === editor.data.tool));
  const eraseLabel = ERASE_MODE_LABELS[editor.data.eraseMode ?? "smart"];
  document.querySelector("#eraseToolBtn .tool-label").textContent = `Xóa · ${eraseLabel}`;
  document.querySelectorAll("[data-erase-mode]").forEach((button) => {
    const active = button.dataset.eraseMode === (editor.data.eraseMode ?? "smart");
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  elements.activeToolBadge.textContent = editor.data.tool === "erase" ? `Xóa ${eraseLabel.toLowerCase()}` : TOOL_LABELS[editor.data.tool];
  elements.undoBtn.disabled = !editor.history.canUndo;
  elements.redoBtn.disabled = !editor.history.canRedo;
}

export function activateTab(tab, editorData, elements) {
  editorData.tab = tab;
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  const isLevel = tab === "level";
  const isPlayable = tab === "playable";
  const isJson = tab === "json";
  elements.levelWorkspace.classList.toggle("hidden", isPlayable);
  elements.playableWorkspace.classList.toggle("hidden", !isPlayable);
  document.querySelectorAll(".level-rail-content").forEach((element) => element.classList.toggle("hidden", !isLevel));
  elements.jsonFolderCard.classList.toggle("hidden", !isJson);
  elements.levelRightRail.classList.toggle("json-mode", isJson);
  elements.canvasArea.classList.toggle("read-only", isJson);
  elements.gridBoard.setAttribute("aria-readonly", String(isJson));
  elements.levelControls.classList.toggle("hidden", !isLevel);
  elements.playableControls.classList.toggle("hidden", !isPlayable);
  elements.jsonControls.classList.toggle("hidden", !isJson);
  elements.levelActions.classList.toggle("hidden", !isLevel);
  elements.jsonActions.classList.toggle("hidden", !isJson);
  elements.levelLayerPicker.classList.toggle("hidden", isPlayable);
  elements.levelLayerPicker.classList.toggle("read-only", isJson);
  elements.levelLayerPicker.querySelectorAll("button").forEach((button) => button.classList.toggle("hidden", isJson));
  if (isJson) elements.activeToolBadge.textContent = "Chỉ xem";
  else if (isLevel) elements.activeToolBadge.textContent = editorData.tool === "erase"
    ? `Xóa ${(ERASE_MODE_LABELS[editorData.eraseMode ?? "smart"] ?? "").toLowerCase()}`
    : TOOL_LABELS[editorData.tool];
  elements.placeholderView.classList.add("hidden");
  elements.topbarEyebrow.textContent = isPlayable ? "Playable / Snapshot màn chơi" : isLevel ? "Level Design / Layer fruit đang chọn" : "Data JSON / Map editor hiện tại";
}
