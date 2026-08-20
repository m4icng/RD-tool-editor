import { DERIVED_GENERATE_PARAMETER_ALIASES, DERIVED_GENERATE_SETTING_FIELDS, GENERATE_PRESETS, GENERATE_SETTING_FIELDS, MULTI_BRANCH_MODE_LABELS, PRESET_LABELS, normalizeGenerateSettings } from "../generate/generate-settings.js";
import { analyzeAdaptiveLevel, estimateDerivedGenerateParameters } from "../generate/adaptive-parameters.js";
import { buildAutoGenerateProfile } from "../generate/auto-generate-profile.js";
import { analyzeGenerateSource } from "../generate/generate-source.js";
import { ITEM_LAYER_LOCKED, getItemLayerLockRows } from "../generate/item-layer-locks.js";

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
  if (meta?.status === "Need Review") return "Cần review";
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
    "Cần review": "need-review",
    "Chưa sinh": "not-generated"
  }[status] ?? "not-generated";
}

function issueRows(issues) {
  if (!issues?.length) return `<div class="generate-issue ok"><strong>Ổn</strong><span>Không có lỗi bộ sinh.</span></div>`;
  return issues.map((issue) => `
    <div class="generate-issue ${escapeHtml(issue.severity ?? "error")}">
      <strong>${escapeHtml(issue.code)}${issue.errorGroup ? ` · ${escapeHtml(issue.errorGroup)}` : ""}</strong>
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

function itemLayerLockRowsHtml(state) {
  const rows = getItemLayerLockRows(state);
  if (!rows.length) return `<div class="generate-layer-lock-empty">Chưa có Item Layer.</div>`;
  return rows.map((row) => {
    const locked = row.mode === ITEM_LAYER_LOCKED;
    return `
      <div class="generate-layer-lock-row ${locked ? "locked" : "auto"}">
        <div>
          <strong>Layer ${row.layerIndex}</strong>
          <span>${row.itemCount} Items</span>
        </div>
        <button class="generate-layer-lock-toggle" type="button" data-generate-layer-lock="${row.layerIndex}" aria-pressed="${locked}">
          ${locked ? "Locked" : "Auto"}
        </button>
      </div>
    `;
  }).join("");
}

function applyDerivedDisplayOverrides(derivedParameters, settings, overrideKeys) {
  const next = {
    ...derivedParameters,
    clusterSizeDistribution: { ...(derivedParameters.clusterSizeDistribution ?? {}) }
  };
  overrideKeys.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(next, key)) {
      next[key] = settings[key];
      return;
    }
    const alias = DERIVED_GENERATE_PARAMETER_ALIASES[key];
    if (!alias) return;
    if (alias === "clusterSizeDistribution.min") {
      const min = Number(settings[key]);
      const max = Math.max(Number(next.clusterSizeDistribution.max ?? min), min);
      next.clusterSizeDistribution = {
        ...next.clusterSizeDistribution,
        min,
        preferred: Math.min(Math.max(Number(next.clusterSizeDistribution.preferred ?? min), min), max),
        max
      };
      return;
    }
    if (alias === "clusterSizeDistribution.max") {
      const max = Number(settings[key]);
      const min = Math.min(Number(next.clusterSizeDistribution.min ?? 1), max);
      next.clusterSizeDistribution = {
        ...next.clusterSizeDistribution,
        min,
        preferred: Math.min(Math.max(Number(next.clusterSizeDistribution.preferred ?? max), min), max),
        max
      };
      return;
    }
    next[alias] = settings[key];
  });
  return next;
}

const DERIVED_SUMMARY_CARDS = Object.freeze([
  { key: "avgTailLengthTarget", label: "Avg Tail", value: (derived) => derived.targetAverageTail },
  { key: "targetPeakTail", label: "Peak Tail", value: (derived) => derived.targetPeakTail },
  { key: "tailLengthCap", label: "Safe Tail", value: (derived) => derived.safeTailLimit },
  { key: "noiseRatio", label: "Noise", value: (derived) => derived.noiseRatio },
  { key: "clusterRatio", label: "Cluster", value: (derived) => derived.clusterAdjacencyRatio },
  { key: "minClusterSizePerBranch", label: "Min cụm", value: (derived) => derived.clusterSizeDistribution.min },
  { key: "maxClusterSizePerBranch", label: "Max cụm", value: (derived) => derived.clusterSizeDistribution.max },
  { key: "releaseAmountTarget", label: "Release", value: (derived) => derived.releaseAmountTarget },
  { key: "beamWidth", label: "Beam", value: (derived) => derived.beamWidth }
]);

function derivedSummaryCardsHtml(settings, derived, overrideKeys) {
  return DERIVED_SUMMARY_CARDS.map((card) => {
    const field = DERIVED_GENERATE_SETTING_FIELDS.find((entry) => entry.key === card.key);
    if (!field) return "";
    const rawValue = overrideKeys.has(card.key) ? settings[card.key] : card.value(derived);
    const value = field.type === "percent" ? Math.round(Number(rawValue) * 100) : rawValue;
    return `
      <div class="generate-derived-card ${overrideKeys.has(card.key) ? "overridden" : ""}" title="${escapeHtml(field.tip)}">
        <span>${escapeHtml(card.label)}<i title="${escapeHtml(field.tip)}">?</i></span>
        <strong>${escapeHtml(value)}${field.type === "percent" ? "%" : ""}</strong>
      </div>
    `;
  }).join("");
}

function autoBalanceGridHtml(profile, derived) {
  const cluster = derived?.clusterSizeDistribution ?? {};
  return `
    <div class="generate-source-grid compact">
      <div><span>Map Capacity</span><strong>${profile.map.effectiveCapacity}</strong></div>
      <div><span>Auto Layers</span><strong>${profile.layer.autoLayers}</strong></div>
      <div><span>Remaining</span><strong>${Object.values(profile.tray.remainingColorDemand).reduce((sum, value) => sum + value, 0)}</strong></div>
      <div><span>Density</span><strong>${formatPercent(profile.map.requiredDensity)}</strong></div>
      <div><span>Tray Layers</span><strong>${profile.tray.trayLayerCount}</strong></div>
      <div><span>Adaptive Cluster</span><strong>${cluster.min ?? "-"}-${cluster.max ?? "-"}</strong></div>
      <div><span>Safe Tail</span><strong>${derived?.safeTailLimit ?? "-"}</strong></div>
      <div><span>Regions</span><strong>${profile.map.usableRegions ?? "-"}</strong></div>
    </div>
  `;
}

export function renderGenerateControls(container, state) {
  const settings = normalizeGenerateSettings(state.generateSettings);
  const source = analyzeGenerateSource(state);
  const analysis = analyzeAdaptiveLevel(state, source);
  const derivedEstimate = estimateDerivedGenerateParameters(source, analysis, settings);
  const overrideKeys = new Set(settings.derivedOverrideKeys ?? []);
  const derived = applyDerivedDisplayOverrides(derivedEstimate.derivedParameters, settings, overrideKeys);
  const profile = buildAutoGenerateProfile(state, source, analysis, derived);

  container.innerHTML = `
    <section class="control-section">
      <div class="section-heading"><h2>Dữ liệu nguồn</h2><span>Chỉ đọc</span></div>
      <div class="generate-source-grid">
        <div><span>Lớp</span><strong>${source.stats.layers}</strong></div>
        <div><span>Khay</span><strong>${source.stats.trays}</strong></div>
        <div><span>Cần sinh</span><strong>${source.stats.totalRequired}</strong></div>
        <div><span>Đã khóa</span><strong>${source.stats.lockedItems}</strong></div>
        <div><span>Path usable</span><strong>${source.stats.effectiveItemCells}</strong></div>
        <div><span>Layer slots</span><strong>${source.stats.totalValidSlots}</strong></div>
      </div>
      <div class="generate-source-note">Đường ray, khay, điểm bắt đầu, điểm giao, điểm ưu tiên và đối tượng đặc biệt chỉ được đọc. Muốn sửa nguồn hãy mở tab LevelDes.</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Item Layers</h2><span>Lock</span></div>
      <div class="generate-layer-lock-list">${itemLayerLockRowsHtml(state)}</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Độ khó</h2><span>Intent</span></div>
      <div class="generate-preset-list">
        ${Object.keys(GENERATE_PRESETS).map((preset) => `<button class="generate-preset ${settings.difficultyPreset === preset ? "active" : ""}" type="button" data-generate-preset="${preset}">${PRESET_LABELS[preset]}</button>`).join("")}
      </div>
      <div class="generate-field-grid">${intentFieldsHtml(settings)}</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Auto Balance</h2><span>Chỉ đọc</span></div>
      ${autoBalanceGridHtml(profile, derived)}
      <div class="generate-derived-grid">
        ${derivedSummaryCardsHtml(settings, derived, overrideKeys)}
      </div>
    </section>
  `;
}

export function renderGenerateResults(container, state, result = null) {
  const source = result?.source ?? analyzeGenerateSource(state);
  const meta = result?.meta ?? state.generationMeta ?? {};
  const derived = meta.derivedParameters ?? result?.settings?.autoDerivedParameters ?? null;
  const profile = meta.autoGenerateProfile ?? result?.profile ?? null;
  const issues = result?.issues?.length ? result.issues : source.issues;
  const status = result ? (result.ok ? "Sẵn sàng xem trước" : result.preview ? "Cần review" : statusOf(state)) : statusOf(state);
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
        <header><h3>Auto Balance</h3><span>${meta.finalStatus ?? profile?.repair?.activeErrorGroup ?? "Runtime"}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Map Capacity</span><strong>${profile?.map?.effectiveCapacity ?? source.stats.effectiveItemCells ?? "-"}</strong></div>
          <div><span>Restricted</span><strong>${profile?.map?.restrictedCells ?? source.stats.restrictedItemCells ?? "-"}</strong></div>
          <div><span>Density</span><strong>${profile?.map ? formatPercent(profile.map.requiredDensity) : "-"}</strong></div>
          <div><span>Density Class</span><strong>${profile?.map?.densityClass ?? "-"}</strong></div>
          <div><span>Current Attempt</span><strong>${profile?.repair?.currentAttempt ?? meta.autoTuningAttempt ?? "-"}</strong></div>
          <div><span>Repair</span><strong>${profile?.repair?.activeErrorGroup ?? "-"}</strong></div>
          <div><span>Best Score</span><strong>${meta.bestCandidateScore ?? "-"}</strong></div>
          <div><span>Tray/Item Ratio</span><strong>${profile?.tray?.trayLayerPerItemLayerRatio ?? "-"}</strong></div>
        </div>
      </section>
      ${meta.autoRepairStatus?.length ? `
        <section class="generate-result-card">
          <header><h3>Lịch sử Auto Repair</h3><span>${meta.autoRepairStatus.length}</span></header>
          <div class="generate-issue-list">
            ${meta.autoRepairStatus.slice(-6).map((entry) => `
              <div class="generate-issue warning">
                <strong>${escapeHtml(entry.code)} · ${escapeHtml(entry.errorGroup)}</strong>
                <span>${escapeHtml(entry.status)}</span>
                <small>${escapeHtml(entry.action)}</small>
              </div>
            `).join("")}
          </div>
        </section>
      ` : ""}
      <section class="generate-result-card">
        <header><h3>Cảnh báo & lỗi</h3><span>${issues.length}</span></header>
        <div class="generate-issue-list">${issueRows(issues)}</div>
      </section>
    </div>
  `;
}
