/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: 日报 JSON 存储与 Markdown 渲染工具
 */

const fs = require("fs");
const path = require("path");

const REPORT_VERSION = 1;

function getMonthKey(year, month) {
  return `${year}${String(month).padStart(2, "0")}`;
}

function getMonthLabel(monthKey) {
  return `${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}`;
}

function getCurrentMonthKey() {
  const now = new Date();
  return getMonthKey(now.getFullYear(), now.getMonth() + 1);
}

function getCurrentMonthReportPath(outputDir) {
  return path.join(outputDir, `reports_${getCurrentMonthKey()}.json`);
}

function getMonthReportPath(outputDir, year, month) {
  return path.join(outputDir, `reports_${getMonthKey(year, month)}.json`);
}

function getMonthDateRange(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
  };
}

function getArchiveReportFileName(year, month) {
  const { start, end } = getMonthDateRange(year, month);
  return `reports_${start.replace(/-/g, "")}_${end.replace(/-/g, "")}.json`;
}

function getArchiveReportPath(outputDir, year, month) {
  return path.join(outputDir, getArchiveReportFileName(year, month));
}

function createEmptyReport(monthKey) {
  return {
    version: REPORT_VERSION,
    month: getMonthLabel(monthKey),
    generatedAt: new Date().toISOString(),
    dates: [],
  };
}

function normalizeReportData(reportData, monthKey = getCurrentMonthKey()) {
  const safeData =
    reportData && typeof reportData === "object"
      ? JSON.parse(JSON.stringify(reportData))
      : createEmptyReport(monthKey);

  safeData.version = REPORT_VERSION;
  safeData.month = safeData.month || getMonthLabel(monthKey);
  safeData.generatedAt = safeData.generatedAt || new Date().toISOString();
  safeData.dates = Array.isArray(safeData.dates) ? safeData.dates : [];

  safeData.dates = safeData.dates
    .map((dateEntry) => ({
      date: dateEntry.date,
      remark: dateEntry.remark || "",
      repositories: Array.isArray(dateEntry.repositories)
        ? dateEntry.repositories.map((repoEntry) => ({
            name: repoEntry.name,
            branch: repoEntry.branch,
            items: Array.isArray(repoEntry.items)
              ? repoEntry.items.map((item) => ({
                  type: item.type,
                  taskId: item.taskId || "other",
                  messages: Array.isArray(item.messages)
                    ? item.messages.filter(Boolean)
                    : [],
                }))
              : [],
          }))
        : [],
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return safeData;
}

function readReport(filePath, monthKey = getCurrentMonthKey()) {
  if (!fs.existsSync(filePath)) {
    return createEmptyReport(monthKey);
  }

  return normalizeReportData(
    JSON.parse(fs.readFileSync(filePath, "utf-8")),
    monthKey,
  );
}

function writeReport(filePath, reportData, monthKey = null) {
  const normalized = normalizeReportData(
    reportData,
    monthKey || getCurrentMonthKey(),
  );
  normalized.generatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2), "utf-8");
}

function upsertDateEntry(reportData, nextDateEntry) {
  const existingIndex = reportData.dates.findIndex(
    (dateEntry) => dateEntry.date === nextDateEntry.date,
  );

  if (existingIndex >= 0) {
    reportData.dates[existingIndex] = nextDateEntry;
  } else {
    reportData.dates.push(nextDateEntry);
  }

  reportData.dates.sort((a, b) => b.date.localeCompare(a.date));
}

function getDateEntry(reportData, date) {
  return reportData.dates.find((dateEntry) => dateEntry.date === date) || null;
}

function upsertRemark(reportData, date, remark) {
  let dateEntry = getDateEntry(reportData, date);

  if (!dateEntry) {
    dateEntry = {
      date,
      remark: "",
      repositories: [],
    };
    reportData.dates.push(dateEntry);
  }

  dateEntry.remark = (remark || "").trim();
  reportData.dates.sort((a, b) => b.date.localeCompare(a.date));
  return dateEntry;
}

function renderReportMarkdown(reportData) {
  const normalized = normalizeReportData(reportData);
  const sections = normalized.dates.map((dateEntry) => {
    const lines = [`## ${dateEntry.date}`, ""];

    dateEntry.repositories.forEach((repoEntry) => {
      lines.push(`**${repoEntry.name} (${repoEntry.branch})**`, "");

      repoEntry.items.forEach((item) => {
        const content = item.messages.join("; ");
        if (item.taskId === "other") {
          lines.push(`- ${item.type}: ${content}`);
        } else {
          lines.push(`- ${item.type}: ${item.taskId} ${content}`);
        }
      });

      lines.push("");
    });

    if (dateEntry.remark) {
      lines.push(`- others: ${dateEntry.remark}`, "");
    }

    return lines.join("\n").trimEnd();
  });

  return sections.join("\n\n") + (sections.length ? "\n" : "");
}

function getReportDateRange(reportData) {
  const normalized = normalizeReportData(reportData);
  if (normalized.dates.length === 0) {
    return null;
  }

  return {
    startDate: normalized.dates[0].date.replace(/-/g, ""),
    endDate: normalized.dates[normalized.dates.length - 1].date.replace(
      /-/g,
      "",
    ),
  };
}

function listReportFiles(outputDir) {
  if (!fs.existsSync(outputDir)) {
    return [];
  }

  return fs
    .readdirSync(outputDir)
    .filter((file) => /^reports_.*\.json$/.test(file))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(outputDir, a)).mtime;
      const statB = fs.statSync(path.join(outputDir, b)).mtime;
      return statB - statA;
    });
}

module.exports = {
  getArchiveReportPath,
  getCurrentMonthKey,
  getCurrentMonthReportPath,
  getDateEntry,
  getMonthDateRange,
  getMonthKey,
  getMonthLabel,
  getMonthReportPath,
  getReportDateRange,
  listReportFiles,
  normalizeReportData,
  readReport,
  renderReportMarkdown,
  upsertDateEntry,
  upsertRemark,
  writeReport,
};
