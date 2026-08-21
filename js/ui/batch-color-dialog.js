import { applyBlockItemVisual } from "../core/block-visuals.js";
import { analyzeBatchColorRemap, batchColorOptions } from "../editor/batch-color-remap.js";

function createOptionSelect(name, selectedId) {
  const select = document.createElement("select");
  select.name = name;
  batchColorOptions().forEach((option) => {
    const item = document.createElement("option");
    item.value = String(option.itemId);
    item.textContent = option.label;
    item.selected = Number(selectedId) === option.itemId;
    select.appendChild(item);
  });
  return select;
}

function swatchForItemId(itemId) {
  const option = batchColorOptions().find((entry) => entry.itemId === Number(itemId));
  const swatch = document.createElement("span");
  if (option) applyBlockItemVisual(swatch, option.type);
  return swatch;
}

function formOptions(form) {
  const data = new FormData(form);
  return {
    mode: data.get("mode") === "swap" ? "swap" : "replace",
    sourceItemId: Number(data.get("sourceItemId")),
    targetItemId: Number(data.get("targetItemId")),
    includeMap: data.get("includeMap") === "on",
    includeTray: data.get("includeTray") === "on",
    mapScope: data.get("mapScope") === "current" ? "current" : "all",
    trayScope: data.get("trayScope") === "selected" ? "selected" : "all"
  };
}

function replaceChildren(element, children) {
  element.replaceChildren(...children.filter(Boolean));
}

export function createBatchColorDialog({ getState, onApply }) {
  const root = document.createElement("div");
  root.className = "batch-color-modal hidden";
  root.innerHTML = `
    <form class="batch-color-dialog" role="dialog" aria-modal="true" aria-labelledby="batchColorTitle">
      <header>
        <div><h2 id="batchColorTitle">Đổi màu hàng loạt</h2><p>Map item và requirement trong khay</p></div>
        <button class="icon-btn" type="button" data-batch-color-close aria-label="Đóng">×</button>
      </header>
      <div class="batch-color-body">
        <section class="batch-color-section">
          <span class="batch-color-label">Chế độ</span>
          <div class="batch-color-segment">
            <label><input type="radio" name="mode" value="replace" checked><span>Thay thế</span></label>
            <label><input type="radio" name="mode" value="swap"><span>Hoán đổi</span></label>
          </div>
        </section>
        <section class="batch-color-pair">
          <label><span>Từ</span><div class="batch-color-select" data-source-select></div></label>
          <label><span>Sang</span><div class="batch-color-select" data-target-select></div></label>
        </section>
        <section class="batch-color-section">
          <span class="batch-color-label">Áp dụng cho</span>
          <div class="batch-color-checks">
            <label><input type="checkbox" name="includeMap" checked><span>Item trên Map</span></label>
            <label><input type="checkbox" name="includeTray" checked><span>Yêu cầu trong Khay</span></label>
          </div>
        </section>
        <section class="batch-color-pair">
          <label><span>Map scope</span><select name="mapScope"><option value="all">Tất cả Layer</option><option value="current">Layer hiện tại</option></select></label>
          <label><span>Tray scope</span><select name="trayScope"><option value="all">Tất cả Khay</option><option value="selected">Khay đang chọn</option></select></label>
        </section>
        <section class="batch-color-preview" aria-live="polite"></section>
      </div>
      <footer>
        <button class="btn" type="button" data-batch-color-close>Hủy</button>
        <button class="btn btn-primary" type="submit" data-batch-color-apply>Đổi màu</button>
      </footer>
    </form>
  `;
  const form = root.querySelector("form");
  root.querySelector("[data-source-select]").appendChild(createOptionSelect("sourceItemId", 1));
  root.querySelector("[data-target-select]").appendChild(createOptionSelect("targetItemId", 3));
  const preview = root.querySelector(".batch-color-preview");
  const applyButton = root.querySelector("[data-batch-color-apply]");

  function renderPreview() {
    const options = formOptions(form);
    const result = analyzeBatchColorRemap(getState(), options);
    const sourceRow = document.createElement("div");
    sourceRow.className = "batch-color-flow";
    sourceRow.append(swatchForItemId(options.sourceItemId), document.createTextNode(options.mode === "swap" ? "↔" : "→"), swatchForItemId(options.targetItemId));
    const counts = document.createElement("div");
    counts.className = "batch-color-counts";
    counts.innerHTML = `<div><span>Map</span><strong>${result.mapAffected}</strong></div><div><span>Tray</span><strong>${result.trayAffected}</strong></div>`;
    const balance = document.createElement("div");
    balance.className = "batch-color-balance";
    const unbalanced = result.balanceRows.filter((row) => row.diff !== 0);
    balance.textContent = unbalanced.length === 0
      ? "Item Balance sau thay đổi: Balanced"
      : `Item Balance sau thay đổi: ${unbalanced.map((row) => `ID ${row.itemId} Map ${row.map} / Tray ${row.tray}`).join(" · ")}`;
    const warning = document.createElement("div");
    warning.className = "batch-color-warning";
    let warningText = "";
    if (options.sourceItemId === options.targetItemId) warningText = "Source ID và Target ID đang trùng.";
    else if (!options.includeMap && !options.includeTray) warningText = "Chọn ít nhất Map hoặc Tray.";
    else if (result.sourceAffected === 0) warningText = "Không tìm thấy Item ID này trong phạm vi đã chọn.";
    else if (result.lockedLayerCount > 0) warningText = `Có ${result.lockedLayerCount} Layer đang Locked. Thao tác vẫn sẽ đổi màu trong các Layer này.`;
    else if (options.trayScope === "selected" && !result.selectedTrayAvailable) warningText = "Chưa chọn khay để dùng Tray scope Selected.";
    warning.textContent = warningText;
    warning.classList.toggle("hidden", !warningText);
    applyButton.disabled = !result.valid;
    replaceChildren(preview, [sourceRow, counts, balance, warning]);
  }

  form.addEventListener("input", renderPreview);
  form.addEventListener("change", renderPreview);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = analyzeBatchColorRemap(getState(), formOptions(form));
    if (!result.valid) {
      renderPreview();
      return;
    }
    onApply(result.options, result);
    root.classList.add("hidden");
  });
  root.addEventListener("click", (event) => {
    if (event.target === root || event.target.closest("[data-batch-color-close]")) root.classList.add("hidden");
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") root.classList.add("hidden");
  });
  document.body.appendChild(root);

  return {
    open() {
      root.classList.remove("hidden");
      renderPreview();
      form.querySelector("select")?.focus();
    }
  };
}
