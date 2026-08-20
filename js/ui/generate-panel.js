import { GENERATE_PRESETS, GENERATE_SETTING_FIELDS, MULTI_BRANCH_MODE_LABELS, PRESET_LABELS, TAIL_CURVE_LABELS, normalizeGenerateSettings } from "../generate/generate-settings.js";
import { analyzeGenerateSource } from "../generate/generate-source.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPercent(value) {
  return `${Math.round(Number(value) * 100)}%`;
}

function statusOf(state) {
  const meta = state.generationMeta;
  if (meta?.status === "Error") return "Lỗi";
  if (meta?.status === "Generated" && state.fileDirty) return "Đã chỉnh sửa";
  if (meta?.status === "Generated") return "Đã sinh";
  return "Chưa sinh";
}

function statusClass(status) {
  return {
    "Sẵn sàng xem trước": "preview-ready",
    "Đã sinh": "generated",
    "Đã chỉnh sửa": "modified",
    "Lỗi": "error",
    "Chưa sinh": "not-generated"
  }[status] ?? "not-generated";
}

function issueRows(issues) {
  if (!issues?.length) return `<div class="generate-issue ok"><strong>Ổn</strong><span>Không có lỗi bộ sinh.</span></div>`;
  return issues.map((issue) => `
    <div class="generate-issue ${escapeHtml(issue.severity ?? "error")}">
      <strong>${escapeHtml(issue.code)}</strong>
      <span>${escapeHtml(issue.message)}</span>
      ${issue.suggestion ? `<small>${escapeHtml(issue.suggestion)}</small>` : ""}
    </div>
  `).join("");
}

function settingsGroupHtml(settings, group) {
  const fields = GENERATE_SETTING_FIELDS.filter((field) => field.group === group);
  return `
    <details class="generate-settings-group" ${group === "Cụm và đường đi" ? "open" : ""}>
      <summary>${escapeHtml(group)}</summary>
      <div class="generate-field-grid">
        ${fields.map((field) => {
          const value = field.type === "percent" ? Math.round(Number(settings[field.key]) * 100) : settings[field.key];
          const min = field.type === "percent" ? field.min * 100 : field.min;
          const max = field.type === "percent" ? field.max * 100 : field.max;
          const step = field.type === "percent" ? Math.max(1, field.step * 100) : field.step;
          return `
            <label class="generate-field" title="${escapeHtml(field.tip)}">
              <span>${escapeHtml(field.label)}</span>
              <input type="number" data-generate-setting="${escapeHtml(field.key)}" data-setting-type="${field.type}" min="${min}" max="${max}" step="${step}" value="${value}">
            </label>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

export function renderGenerateControls(container, state) {
  const settings = normalizeGenerateSettings(state.generateSettings);
  const source = analyzeGenerateSource(state);

  container.innerHTML = `
    <section class="control-section">
      <div class="section-heading"><h2>Dữ liệu nguồn</h2><span>Chỉ đọc</span></div>
      <div class="generate-source-grid">
        <div><span>Lớp</span><strong>${source.stats.layers}</strong></div>
        <div><span>Khay</span><strong>${source.stats.trays}</strong></div>
        <div><span>Cần sinh</span><strong>${source.stats.totalRequired}</strong></div>
        <div><span>Ô hợp lệ</span><strong>${source.stats.totalValidSlots}</strong></div>
      </div>
      <div class="generate-source-note">Đường ray, khay, điểm bắt đầu, điểm giao, điểm ưu tiên và đối tượng đặc biệt chỉ được đọc. Muốn sửa nguồn hãy mở tab LevelDes.</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Phân bổ</h2><span>Có seed</span></div>
      <div class="generate-field-grid">
        <label class="generate-field"><span>Mã ngẫu nhiên</span><input type="number" data-generate-setting="seed" min="0" step="1" value="${settings.seed}"></label>
        <label class="generate-field"><span>Số lần thử lại</span><input type="number" data-generate-setting="maxRetries" min="1" max="500" step="1" value="${settings.maxRetries}"></label>
        <label class="generate-field wide"><span>Chế độ nhiều nhánh</span>
          <select data-generate-setting="multiBranchMode">
            ${Object.entries(MULTI_BRANCH_MODE_LABELS).map(([value, label]) => `<option value="${value}" ${settings.multiBranchMode === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Độ khó</h2><span>Mẫu nhanh</span></div>
      <div class="generate-preset-list">
        ${Object.keys(GENERATE_PRESETS).map((preset) => `<button class="generate-preset ${settings.difficultyPreset === preset ? "active" : ""}" type="button" data-generate-preset="${preset}">${PRESET_LABELS[preset]}</button>`).join("")}
      </div>
      ${["Áp lực đuôi", "Áp lực xả", "Lớp và xuất hiện", "Cụm và đường đi"].map((group) => settingsGroupHtml(settings, group)).join("")}
      <div class="generate-field-grid">
        <label class="generate-field wide"><span>Đường cong tăng đuôi</span>
          <select data-generate-setting="tailLengthGrowthCurve">${Object.entries(TAIL_CURVE_LABELS).map(([value, label]) => `<option value="${value}" ${settings.tailLengthGrowthCurve === value ? "selected" : ""}>${label}</option>`).join("")}</select>
        </label>
      </div>
    </section>
  `;
}

export function renderGenerateResults(container, state, result = null) {
  const source = result?.source ?? analyzeGenerateSource(state);
  const meta = result?.meta ?? state.generationMeta ?? {};
  const issues = result?.issues?.length ? result.issues : source.issues;
  const status = result?.ok ? "Sẵn sàng xem trước" : statusOf(state);
  const totalGenerated = result?.generatedItems?.length ?? state.generatedItems?.length ?? 0;
  container.innerHTML = `
    <header class="panel-header">
      <div class="panel-title"><span class="panel-accent green"></span><div><h2>Kết quả sinh</h2><p>${escapeHtml(status)}</p></div></div>
      <span class="generate-status-badge ${statusClass(status)}">${escapeHtml(status)}</span>
    </header>
    <div class="generate-result-scroll">
      <section class="generate-result-card">
        <header><h3>Kết quả vật phẩm</h3><span>${totalGenerated}/${source.stats.totalRequired}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Yêu cầu</span><strong>${source.stats.totalRequired}</strong></div>
          <div><span>Đã sinh</span><strong>${totalGenerated}</strong></div>
          <div><span>Còn thiếu</span><strong>${Math.max(0, source.stats.totalRequired - totalGenerated)}</strong></div>
          <div><span>Nhánh dùng</span><strong>${meta.branchCount ?? "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Chỉ số độ khó</h3><span>${meta.generatorVersion ?? "nháp"}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Số cụm</span><strong>${meta.clusterCount ?? "-"}</strong></div>
          <div><span>Tỷ lệ gom</span><strong>${Number.isFinite(meta.actualClusterRatio) ? formatPercent(meta.actualClusterRatio) : "-"}</strong></div>
          <div><span>Đuôi TB</span><strong>${meta.avgTailLength ?? "-"}</strong></div>
          <div><span>Đuôi đỉnh</span><strong>${meta.peakTailLength ?? "-"}</strong></div>
          <div><span>Độ trễ xả TB</span><strong>${meta.avgReleaseDelay ?? "-"}</strong></div>
          <div><span>Tồn kho tối đa</span><strong>${meta.maxUnreleasedItems ?? "-"}</strong></div>
          <div><span>Mật độ vật phẩm</span><strong>${Number.isFinite(meta.itemDensity) ? formatPercent(meta.itemDensity) : "-"}</strong></div>
          <div><span>Bẫy xuất hiện</span><strong>${meta.spawnTrapCount ?? "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Cảnh báo & lỗi</h3><span>${issues.length}</span></header>
        <div class="generate-issue-list">${issueRows(issues)}</div>
      </section>
    </div>
  `;
}
