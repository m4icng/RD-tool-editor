export function renderObjectPalette(container, objects, selectedId, { emptyLabel = "Chưa có object trong nhóm này.", unavailableIds = [], unavailableReasons = {}, bridgeAxis = 0, countBarrierCount = 1 } = {}) {
  container.innerHTML = "";
  if (objects.length === 0) {
    const empty = document.createElement("div");
    empty.className = "palette-empty";
    empty.textContent = emptyLabel;
    container.appendChild(empty);
    return;
  }
  const unavailable = new Set(unavailableIds);
  objects.forEach((object) => {
    const button = document.createElement("button");
    button.type = "button";
    const isUnavailable = unavailable.has(object.id);
    const unavailableReason = unavailableReasons[object.id] ?? "Đã có trên map";
    button.className = `asset-btn${String(object.id) === String(selectedId) ? " active" : ""}${isUnavailable ? " unavailable" : ""}`;
    button.dataset.asset = object.id;
    button.dataset.tooltip = `ID: ${object.id}${isUnavailable ? ` · ${unavailableReason}` : ""}`;
    button.title = button.dataset.tooltip;
    button.setAttribute("aria-label", `${object.label}. ID: ${object.id}${isUnavailable ? `. ${unavailableReason}` : ""}`);
    if (isUnavailable) button.setAttribute("aria-disabled", "true");
    button.innerHTML = `<span class="asset-icon"></span><span class="asset-label"></span>`;
    button.firstElementChild.textContent = object.icon;
    button.lastElementChild.textContent = object.label;
    if (object.kind === "bridge") {
      button.classList.add("bridge-asset");
      button.firstElementChild.classList.toggle("vertical-bridge-icon", Number(bridgeAxis) === 1);
      button.dataset.tooltip = `Bridge · ${Number(bridgeAxis) === 1 ? "Vertical" : "Horizontal"}`;
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", `Bridge. ${Number(bridgeAxis) === 1 ? "Vertical" : "Horizontal"}`);
      const picker = document.createElement("span");
      picker.className = "bridge-axis-picker";
      [
        ["0", "🟰"],
        ["1", "🟰"]
      ].forEach(([direction, label]) => {
        const option = document.createElement("span");
        option.className = `bridge-axis-option${String(bridgeAxis) === direction ? " active" : ""}`;
        option.dataset.bridgeAxis = direction;
        option.textContent = label;
        option.title = direction === "0" ? "Horizontal" : "Vertical";
        picker.appendChild(option);
      });
      button.appendChild(picker);
    }
    if (object.kind === "gate") {
      button.classList.add("gate-asset");
      button.firstElementChild.className = "asset-icon gate-icon";
      button.dataset.tooltip = "Gate Tool";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "Gate Tool");
    }
    if (object.kind === "count-barrier") {
      button.classList.add("count-barrier-asset");
      button.dataset.tooltip = `Count Barrier · count ${countBarrierCount}`;
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", `Count Barrier. Count ${countBarrierCount}`);
      const badge = document.createElement("span");
      badge.className = "count-barrier-count-picker";
      badge.textContent = `Count ${countBarrierCount}`;
      button.appendChild(badge);
    }
    if (object.kind === "tunnel") {
      button.classList.add("tunnel-asset");
      button.dataset.tooltip = "Tunnel · tạo cặp mới";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "Tunnel. Tạo cặp mới");
    }
    if (object.kind === "one-way") {
      button.classList.add("one-way-asset");
      button.dataset.tooltip = "One Way · tạo cặp mới";
      button.title = button.dataset.tooltip;
      button.setAttribute("aria-label", "One Way. Tạo cặp mới");
    }
    container.appendChild(button);
  });
}
