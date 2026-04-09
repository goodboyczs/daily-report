#!/usr/bin/env node

/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: 今日日报更新脚本，按提交类型和任务号分组输出 JSON 报表内容
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { updateStatistics } = require("./stats");
const {
  getArchiveReportPath,
  getCurrentMonthKey,
  getCurrentMonthReportPath,
  getDateEntry,
  readReport,
  upsertDateEntry,
  writeReport,
} = require("../utils/report-storage");

const configPath = path.join(__dirname, "..", "config", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const AUTHOR_EMAIL = config.author_email;
const OUTPUT_DIR = config.output_dir;

console.log("📅 生成日报...\n");

function getCurrentMonthOutputFile() {
  return getCurrentMonthReportPath(OUTPUT_DIR);
}

function archiveOldMonthReport(year, month, reportData) {
  const monthKey = `${year}${String(month).padStart(2, "0")}`;
  const archiveFilePath = getArchiveReportPath(OUTPUT_DIR, year, month);
  writeReport(archiveFilePath, reportData, monthKey);
  console.log(
    `📦 已归档 ${year}-${month} 月份日报: ${path.basename(archiveFilePath)}`,
  );
}

function checkAndArchiveOldMonthReport() {
  const currentMonthKey = getCurrentMonthKey();
  const files = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
  const oldMonthFiles = files.filter((file) => {
    if (file === `reports_${currentMonthKey}.json`) return false;
    return /^reports_\d{6}\.json$/.test(file);
  });

  oldMonthFiles.forEach((file) => {
    const monthKey = file.replace("reports_", "").replace(".json", "");
    const year = parseInt(monthKey.substring(0, 4), 10);
    const month = parseInt(monthKey.substring(4, 6), 10);
    const filePath = path.join(OUTPUT_DIR, file);
    const reportData = readReport(filePath, monthKey);

    archiveOldMonthReport(year, month, reportData);
    fs.unlinkSync(filePath);
    console.log(`🗑️  已删除旧月份文件: ${file}`);
  });
}

function getDateInChinaTimezone() {
  const now = new Date();
  const chinaDate = new Date(
    now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60 * 1000,
  );
  return chinaDate.toISOString().split("T")[0];
}

function getTodayCommits(repoPath) {
  try {
    const date = getDateInChinaTimezone();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const command = `git log --since="${startOfDay}" --until="${endOfDay}" --pretty=format:"%s" --reverse --author="${AUTHOR_EMAIL}"`;
    const output = execSync(command, {
      encoding: "utf-8",
      cwd: repoPath,
      stdio: ["pipe", "pipe", "ignore"],
    });

    return output
      .trim()
      .split("\n")
      .filter((line) => line.length > 0);
  } catch (err) {
    console.warn(`  ⚠️  从 ${repoPath} 获取git log失败: ${err.message}`);
    return [];
  }
}

function filterAndGroupCommits(commits) {
  const filtered = commits.filter((commit) => /^(feat|bugfix):/i.test(commit));
  const grouped = {};

  filtered.forEach((commit) => {
    const typeMatch = commit.match(/^(\w+):/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "feat";
    const taskMatch = commit.match(/RS7-\d+/);
    const taskId = taskMatch ? taskMatch[0] : "other";
    const groupKey = `${taskId}::${type}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        type,
        taskId,
        messages: [],
      };
    }

    let description = commit.replace(/^(\w+):\s*/i, "").trim();
    if (taskMatch) {
      const taskIndex = description.indexOf(taskId);
      description = description.substring(taskIndex + taskId.length).trim();
    }

    if (description) {
      grouped[groupKey].messages.push(description);
    }
  });

  return grouped;
}

function groupedToReportItems(grouped) {
  const typePriority = {
    bugfix: 0,
    feat: 1,
  };

  return Object.values(grouped)
    .sort((groupA, groupB) => {
      if (groupA.taskId === "other") return 1;
      if (groupB.taskId === "other") return -1;

      if (groupA.taskId !== groupB.taskId) {
        return groupB.taskId.localeCompare(groupA.taskId);
      }

      return (
        (typePriority[groupA.type] ?? 99) - (typePriority[groupB.type] ?? 99)
      );
    })
    .map(({ type, taskId, messages }) => ({
      type,
      taskId,
      messages,
    }));
}

function buildRepositoryEntry(repoName, branch, commits) {
  if (commits.length === 0) {
    return null;
  }

  const grouped = filterAndGroupCommits(commits);
  const items = groupedToReportItems(grouped);

  if (items.length === 0) {
    return null;
  }

  return {
    name: repoName,
    branch,
    items,
  };
}

function main() {
  checkAndArchiveOldMonthReport();

  const date = getDateInChinaTimezone();
  let hasContent = false;
  let totalCommits = 0;

  console.log("📊 仓库扫描结果:");

  const repositories = [];
  config.repositories.forEach((repo) => {
    const commits = getTodayCommits(repo.path);
    totalCommits += commits.length;

    if (commits.length > 0) {
      console.log(`  ✓ ${repo.name}: ${commits.length} 条提交`);
      const entry = buildRepositoryEntry(repo.name, repo.branch, commits);
      if (entry) {
        repositories.push(entry);
        hasContent = true;
      }
    } else {
      console.log(`  - ${repo.name}: 无新提交`);
    }
  });

  console.log(
    `\n📈 统计: 共扫描 ${config.repositories.length} 个仓库，找到 ${totalCommits} 条提交`,
  );

  if (!hasContent) {
    console.log("⏭️  当天没有 feat 或 bugfix 提交，跳过更新");
    return;
  }

  const outputFile = getCurrentMonthOutputFile();
  const currentMonthKey = getCurrentMonthKey();
  const reportData = readReport(outputFile, currentMonthKey);
  const existingDateEntry = getDateEntry(reportData, date);

  if (fs.existsSync(outputFile)) {
    if (existingDateEntry) {
      console.log(`ℹ️  日期 ${date} 已存在，更新其内容`);
    } else {
      console.log(`✨ 日期 ${date} 为新日期`);
    }
  } else {
    console.log("🆕 日报文件不存在，创建新文件");
  }

  upsertDateEntry(reportData, {
    date,
    remark: existingDateEntry ? existingDateEntry.remark : "",
    repositories,
  });

  writeReport(outputFile, reportData, currentMonthKey);
  console.log(`✅ 日报已更新: ${outputFile}`);

  try {
    console.log("📊 更新代码统计...");
    updateStatistics(config);
    console.log("✅ 统计数据已更新");
  } catch (err) {
    console.warn("⚠️  统计数据更新失败:", err.message);
  }
}

main();
