import { GENERATE_PRESETS, GENERATE_SETTING_FIELDS, normalizeGenerateSettings } from "../generate/generate-settings.js";
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
  if (meta?.status === "Error") return "Error";
  if (meta?.status === "Generated" && state.fileDirty) return "Modified";
  if (meta?.status === "Generated") return "Generated";
  return "Not Generated";
}

function issueRows(issues) {
  if (!issues?.length) return `<div class="generate-issue ok"><strong>OK</strong><span>No generator issue.</span></div>`;
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
    <details class="generate-settings-group" ${group === "Distribution" ? "open" : ""}>
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

export function renderGenerateControls(container, state, uiState = {}) {
  const settings = normalizeGenerateSettings(state.generateSettings);
  const source = analyzeGenerateSource(state);
  const status = statusOf(state);
  const search = uiState.search ?? "";
  const filter = uiState.filter ?? "all";
  const sort = uiState.sort ?? "name";
  const files = (uiState.folderFiles ?? []).filter((file) => file.status === "valid");
  const visibleFiles = files
    .filter((file) => {
      const nameMatch = file.name.toLowerCase().includes(search.toLowerCase());
      const statusMatch = filter === "all" || status === filter;
      return nameMatch && statusMatch;
    })
    .sort((a, b) => sort === "id" ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.name.localeCompare(b.name));

  container.innerHTML = `
    <section class="control-section">
      <div class="section-heading"><h2>Generate Levels</h2><span>${escapeHtml(status)}</span></div>
      <div class="generate-level-tools">
        <input id="generateLevelSearch" type="search" placeholder="Search level" value="${escapeHtml(search)}">
        <select id="generateStatusFilter">
          ${["all", "Not Generated", "Generated", "Modified", "Error"].map((value) => `<option value="${escapeHtml(value)}" ${filter === value ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}
        </select>
        <select id="generateSortSelect">
          <option value="name" ${sort === "name" ? "selected" : ""}>Sort by name</option>
          <option value="id" ${sort === "id" ? "selected" : ""}>Sort by level ID</option>
        </select>
      </div>
      <div class="generate-level-list">
        <button class="generate-level-row active" type="button" data-generate-current-level>
          <strong>${escapeHtml(state.fileName ?? "untitled-level.json")}</strong>
          <span>${escapeHtml(status)} · current</span>
        </button>
        ${visibleFiles.map((file) => `
          <button class="generate-level-row" type="button" data-generate-open-file="${escapeHtml(file.name)}">
            <strong>${escapeHtml(file.name)}</strong>
            <span>Loaded from folder</span>
          </button>
        `).join("")}
        ${files.length === 0 ? `<div class="generate-empty">Open a folder in DataJson to list more levels.</div>` : ""}
      </div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Source Data</h2><span>Read only</span></div>
      <div class="generate-source-grid">
        <div><span>Layers</span><strong>${source.stats.layers}</strong></div>
        <div><span>Trays</span><strong>${source.stats.trays}</strong></div>
        <div><span>Need</span><strong>${source.stats.totalRequired}</strong></div>
        <div><span>Valid Slots</span><strong>${source.stats.totalValidSlots}</strong></div>
      </div>
      <div class="generate-source-note">Path, tray, start, delivery, priority and element data are locked here. Edit source in LevelDes.</div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Distribution</h2><span>Seeded</span></div>
      <div class="generate-field-grid">
        <label class="generate-field"><span>Seed</span><input type="number" data-generate-setting="seed" min="0" step="1" value="${settings.seed}"></label>
        <label class="generate-field"><span>Retries</span><input type="number" data-generate-setting="maxRetries" min="1" max="500" step="1" value="${settings.maxRetries}"></label>
        <label class="generate-field wide"><span>Multi Branch</span>
          <select data-generate-setting="multiBranchMode">
            ${["balanced", "spread", "clustered"].map((value) => `<option value="${value}" ${settings.multiBranchMode === value ? "selected" : ""}>${value}</option>`).join("")}
          </select>
        </label>
      </div>
    </section>

    <section class="control-section">
      <div class="section-heading"><h2>Difficulty</h2><span>Preset</span></div>
      <div class="generate-preset-list">
        ${Object.keys(GENERATE_PRESETS).map((preset) => `<button class="generate-preset ${settings.difficultyPreset === preset ? "active" : ""}" type="button" data-generate-preset="${preset}">${preset}</button>`).join("")}
      </div>
      ${["Distribution", "Tail Pressure", "Progression", "Noise", "Item & Route", "Collision"].map((group) => settingsGroupHtml(settings, group)).join("")}
      <div class="generate-field-grid">
        <label class="generate-field wide"><span>Pressure Curve</span>
          <select data-generate-setting="pressureCurve">${["Flat", "Ramp", "Sawtooth", "PeakLate"].map((value) => `<option value="${value}" ${settings.pressureCurve === value ? "selected" : ""}>${value}</option>`).join("")}</select>
        </label>
      </div>
    </section>
  `;
}

export function renderGenerateResults(container, state, result = null) {
  const source = result?.source ?? analyzeGenerateSource(state);
  const meta = result?.meta ?? state.generationMeta ?? {};
  const issues = result?.issues?.length ? result.issues : source.issues;
  const status = result?.ok ? "Preview Ready" : statusOf(state);
  const totalGenerated = result?.generatedItems?.length ?? state.generatedItems?.length ?? 0;
  container.innerHTML = `
    <header class="panel-header">
      <div class="panel-title"><span class="panel-accent green"></span><div><h2>Generate Result</h2><p>${escapeHtml(status)}</p></div></div>
      <span class="generate-status-badge ${escapeHtml(status.toLowerCase().replaceAll(" ", "-"))}">${escapeHtml(status)}</span>
    </header>
    <div class="generate-result-scroll">
      <section class="generate-result-card">
        <header><h3>Item Result</h3><span>${totalGenerated}/${source.stats.totalRequired}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Required</span><strong>${source.stats.totalRequired}</strong></div>
          <div><span>Generated</span><strong>${totalGenerated}</strong></div>
          <div><span>Missing</span><strong>${Math.max(0, source.stats.totalRequired - totalGenerated)}</strong></div>
          <div><span>Branches</span><strong>${meta.branchCount ?? "-"}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Difficulty Metrics</h3><span>${meta.generatorVersion ?? "draft"}</span></header>
        <div class="generate-source-grid compact">
          <div><span>Clusters</span><strong>${meta.clusterCount ?? "-"}</strong></div>
          <div><span>Cluster Ratio</span><strong>${Number.isFinite(meta.actualClusterRatio) ? formatPercent(meta.actualClusterRatio) : "-"}</strong></div>
          <div><span>Avg Tail</span><strong>${meta.avgTailLength ?? "-"}</strong></div>
          <div><span>Slots</span><strong>${source.stats.totalValidSlots}</strong></div>
        </div>
      </section>
      <section class="generate-result-card">
        <header><h3>Warnings & Errors</h3><span>${issues.length}</span></header>
        <div class="generate-issue-list">${issueRows(issues)}</div>
      </section>
    </div>
  `;
}
