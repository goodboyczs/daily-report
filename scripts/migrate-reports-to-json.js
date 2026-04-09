#!/usr/bin/env node

/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: 将历史 Markdown 日报迁移为 JSON 报表文件，保留原始 MD 文件不删除
 */

const fs = require("fs");
const path = require("path");
const { writeReport } = require("../utils/report-storage");

const configPath = path.join(__dirname, "..", "config", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
const outputDir = config.output_dir;

function getMonthKeyFromFileName(fileName) {
  let match = fileName.match(/^reports_(\d{6})\.md$/);
  if (match) {
    return match[1];
  }

  match = fileName.match(/^reports_(\d{4})(\d{2})\d{2}_\d{8}\.md$/);
  if (match) {
    return `${match[1]}${match[2]}`;
  }

  return null;
}

function parseRepoHeader(line) {
  let match = line.match(/^\*\*(.+?)\s*\((.+?)\)\*\*$/);
  if (match) {
    return {
      name: match[1].trim(),
      branch: match[2].trim(),
    };
  }

  match = line.match(/^###\s+(.+?)\s*\((.+?)\)$/);
  if (match) {
    return {
      name: match[1].trim(),
      branch: match[2].trim(),
    };
  }

  return null;
}

function parseItemLine(line) {
  const itemMatch = line.match(/^\-\s+(feat|bugfix):\s*(.*)$/i);
  if (!itemMatch) {
    return null;
  }

  const body = itemMatch[2].trim();
  const taskMatch = body.match(/^(RS7-\d+)\s+(.*)$/);
  const taskId = taskMatch ? taskMatch[1] : "other";
  const messageText = taskMatch ? taskMatch[2] : body;

  return {
    type: itemMatch[1].toLowerCase(),
    taskId,
    messages: messageText
      .split("; ")
      .map((message) => message.trim())
      .filter(Boolean),
  };
}

function parseMarkdownReport(content) {
  const lines = content.split(/\r?\n/);
  const report = { dates: [] };

  let currentDateEntry = null;
  let currentRepository = null;

  function ensureDateEntry(date) {
    currentDateEntry = {
      date,
      remark: "",
      repositories: [],
    };
    report.dates.push(currentDateEntry);
    currentRepository = null;
  }

  function ensureRepository(repoInfo) {
    if (!currentDateEntry) {
      return;
    }

    currentRepository = {
      name: repoInfo.name,
      branch: repoInfo.branch,
      items: [],
    };
    currentDateEntry.repositories.push(currentRepository);
  }

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const dateMatch = line.match(/^##\s+(\d{4}-\d{2}-\d{2})$/);
    if (dateMatch) {
      ensureDateEntry(dateMatch[1]);
      return;
    }

    const repoInfo = parseRepoHeader(line);
    if (repoInfo) {
      ensureRepository(repoInfo);
      return;
    }

    const remarkMatch = line.match(/^\-\s+others:\s*(.*)$/i);
    if (remarkMatch && currentDateEntry) {
      currentDateEntry.remark = remarkMatch[1].trim();
      return;
    }

    const item = parseItemLine(line);
    if (item && currentRepository) {
      currentRepository.items.push(item);
    }
  });

  report.dates.sort((a, b) => b.date.localeCompare(a.date));
  return report;
}

function main() {
  if (!fs.existsSync(outputDir)) {
    console.log("ℹ️ 输出目录不存在，无需迁移");
    return;
  }

  const markdownFiles = fs
    .readdirSync(outputDir)
    .filter((file) => /^reports_.*\.md$/.test(file));

  if (markdownFiles.length === 0) {
    console.log("ℹ️ 未找到需要迁移的 Markdown 日报文件");
    return;
  }

  let migratedCount = 0;
  markdownFiles.forEach((fileName) => {
    const monthKey = getMonthKeyFromFileName(fileName);
    if (!monthKey) {
      console.warn(`⚠️ 跳过无法识别的文件: ${fileName}`);
      return;
    }

    const mdPath = path.join(outputDir, fileName);
    const jsonPath = path.join(outputDir, fileName.replace(/\.md$/, ".json"));
    const content = fs.readFileSync(mdPath, "utf-8");
    const report = parseMarkdownReport(content);

    if (report.dates.length === 0) {
      console.warn(`⚠️ 跳过空内容文件: ${fileName}`);
      return;
    }

    report.month = `${monthKey.slice(0, 4)}-${monthKey.slice(4, 6)}`;
    writeReport(jsonPath, report, monthKey);
    migratedCount++;
    console.log(`✅ 已迁移: ${fileName} -> ${path.basename(jsonPath)}`);
  });

  console.log(`🎉 迁移完成，共生成 ${migratedCount} 个 JSON 日报文件`);
}

main();
