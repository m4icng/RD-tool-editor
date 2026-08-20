import { GENERATE_PRESETS, GENERATE_SETTING_FIELDS, MULTI_BRANCH_MODE_LABELS, PRESET_LABELS, normalizeGenerateSettings } from "../generate/generate-settings.js";
import { analyzeAdaptiveLevel, estimateDerivedGenerateParameters } from "../generate/adaptive-parameters.js";
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

function formatNumber(value) {
  return Number.isFinite(Number(value)) ? String(value) : "-";
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

function intentFieldsHtml(settings) {
  return `
    ${GENERATE_SETTING_FIELDS.map((field) => {
      const value = field.type === "percent" ? Math.round(Number(settings[field.key]) * 100) : settings[field.key];
      const min = field.type === "percent" ? field.min * 100 : field.min;
      const max = field.type === "percent" ? field.max * 100 : field.max;
      const step = field.type === "percent" ? Math.max(1, field.step * 100) : field.step;
      return `
        <label class="generate-field wide" title="${escapeHtml(field.tip)}">
          <span>${escapeHtml(field.label)}</span>
          <input type="number" data-generate-setting="${escapeHtml(field.key)}" data-setting-type="${field.type}" min="${min}" max="${max}" step="${step}" value="${value}">
        </label>
      `;
    }).join("")}
  `;
}

export function renderGenerateControls(container, state) {
  const settings = normalizeGenerateSettings(state.generateSettings);
  const source = analyzeGenerateSource(state);
  const analysis = analyzeAdaptiveLevel(state, source);
  const derived = estimateDerivedGenerateParameters(source, analysis, settings).derivedParameters;

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
      <div class="section-heading"><h2>Phân bổ</h2><span>Tự động</span></div>
      <div class="generate-field-grid">
        <label class="generate-field"><span>Số lần thử lại</span><input type="number" data-generate-setting="maxRetries" min="1" max="500" step="1" value="${settings.maxRetries}"></label>
        <label class="generate-field wide"><span>Chế độ nhiều nhánh</span>
          <select data-generate-setting="multiBranchMode">
            ${Object.entries(MULTI_BRANCH_MODE_LABELS).map(([value, label]) => `<option value="${value}" ${settings.multiBranchMode === value ? "selected" : ""}>${label}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Độ khó</h2><span>Intent</span></div>
      <div class="generate-preset-list">
        ${Object.keys(GENERATE_PRESETS).map((preset) => `<button class="generate-preset ${settings.difficultyPreset === preset ? "active" : ""}" type="button" data-generate-preset="${preset}">${PRESET_LABELS[preset]}</button>`).join("")}
      </div>
      <div class="generate-field-grid">${intentFieldsHtml(settings)}</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Auto Derived</h2><span>Level riêng</span></div>
      <div class="generate-derived-grid">
        <div><span>Avg Tail</span><strong>${formatNumber(derived.targetAverageTail)}</strong></div>
        <div><span>Peak Tail</span><strong>${formatNumber(derived.targetPeakTail)}</strong></div>
        <div><span>Safe Tail</span><strong>${formatNumber(derived.safeTailLimit)}</strong></div>
        <div><span>Noise</span><strong>${formatPercent(derived.noiseRatio)}</strong></div>
        <div><span>Cluster</span><strong>${formatPercent(derived.clusterAdjacencyRatio)}</strong></div>
        <div><span>Max cụm</span><strong>${derived.clusterSizeDistribution.max}</strong></div>
        <div><span>Release</span><strong>${formatNumber(derived.releaseAmountTarget)}</strong></div>
        <div><span>Beam</span><strong>${formatNumber(derived.beamWidth)}</strong></div>
      </div>
    </section>
  `;
}

export function renderGenerateResults(container, state, result = null) {
  const source = result?.source ?? analyzeGenerateSource(state);
  const meta = result?.meta ?? state.generationMeta ?? {};
  const derived = meta.derivedParameters ?? result?.settings?.autoDerivedParameters ?? null;
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
          <div><span>Trùng layer kề</span><strong>${Number.isFinite(meta.adjacentOverlapRatio) ? formatPercent(meta.adjacentOverlapRatio) : "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Tham số dẫn xuất</h3><span>${derived ? `Tune ${meta.autoTuningAttempt ?? 1}` : "-"}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Điểm khó</span><strong>${derived ? formatPercent(derived.difficultyScore) : "-"}</strong></div>
          <div><span>Safe Tail</span><strong>${derived?.safeTailLimit ?? "-"}</strong></div>
          <div><span>Noise</span><strong>${derived ? formatPercent(derived.noiseRatio) : "-"}</strong></div>
          <div><span>Carry-over</span><strong>${derived ? formatPercent(derived.carryOverRatio) : "-"}</strong></div>
          <div><span>High Pressure</span><strong>${derived ? formatPercent(derived.highPressureRatio) : "-"}</strong></div>
          <div><span>Release Cycle</span><strong>${derived?.releaseCycleCount ?? "-"}</strong></div>
          <div><span>Repair</span><strong>${derived?.repairIntensity ?? "-"}</strong></div>
          <div><span>Search/Beam</span><strong>${derived ? `${derived.searchDepth}/${derived.beamWidth}` : "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Cảnh báo & lỗi</h3><span>${issues.length}</span></header>
        <div class="generate-issue-list">${issueRows(issues)}</div>
      </section>
    </div>
  `;
}
