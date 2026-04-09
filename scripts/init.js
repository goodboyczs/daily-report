#!/usr/bin/env node

/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: 历史日报初始化脚本，按提交类型和任务号分组输出 JSON 报表内容
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { updateStatistics } = require("./stats");
const {
  getArchiveReportPath,
  getCurrentMonthKey,
  getCurrentMonthReportPath,
  writeReport,
} = require("../utils/report-storage");

const configPath = path.join(__dirname, "..", "config", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const AUTHOR_EMAIL = config.author_email;
const OUTPUT_DIR = config.output_dir;

console.log("📅 初始化日报历史...\n");

function groupByMonth(commits) {
  const monthGroups = {};

  commits.forEach((commit) => {
    const date = new Date(commit.timestamp);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const monthKey = `${year}${String(month).padStart(2, "0")}`;

    if (!monthGroups[monthKey]) {
      monthGroups[monthKey] = [];
    }

    monthGroups[monthKey].push(commit);
  });

  return monthGroups;
}

function getDateInChinaTimezone(date) {
  const chinaDate = new Date(
    date.getTime() + (date.getTimezoneOffset() + 8 * 60) * 60 * 1000,
  );
  return chinaDate.toISOString().split("T")[0];
}

function getAllCommits(repoPath, repoName) {
  try {
    const command = `git log --pretty=format:"%at|%s" --reverse --author="${AUTHOR_EMAIL}"`;
    const output = execSync(command, {
      encoding: "utf-8",
      cwd: repoPath,
      stdio: ["pipe", "pipe", "ignore"],
    });

    return output
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => {
        const [timestamp, subject] = line.split("|");
        return {
          repoName,
          repoPath,
          timestamp: parseInt(timestamp, 10) * 1000,
          subject: subject.trim(),
        };
      });
  } catch (err) {
    console.warn(`⚠️  从 ${repoName} 获取git log失败`);
    return [];
  }
}

function filterAndGroupCommits(commits) {
  const filtered = commits.filter((commit) =>
    /^(feat|bugfix):/i.test(commit.subject),
  );

  const grouped = {};
  filtered.forEach((commit) => {
    const typeMatch = commit.subject.match(/^(\w+):/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "feat";
    const taskMatch = commit.subject.match(/RS7-\d+/);
    const taskId = taskMatch ? taskMatch[0] : "other";
    const groupKey = `${taskId}::${type}`;

    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        type,
        taskId,
        messages: [],
      };
    }

    let description = commit.subject.replace(/^(\w+):\s*/i, "").trim();
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

function groupByDate(commits) {
  const dateGroups = {};

  commits.forEach((commit) => {
    const date = getDateInChinaTimezone(new Date(commit.timestamp));
    if (!dateGroups[date]) {
      dateGroups[date] = [];
    }
    dateGroups[date].push(commit);
  });

  return dateGroups;
}

function generateReport(dateGroups) {
  const dates = Object.keys(dateGroups).sort((a, b) => b.localeCompare(a));
  const report = { dates: [] };

  dates.forEach((date) => {
    const commits = dateGroups[date];
    const repoGroups = {};

    commits.forEach((commit) => {
      const key = `${commit.repoPath}|${commit.repoName}`;
      if (!repoGroups[key]) {
        repoGroups[key] = [];
      }
      repoGroups[key].push(commit);
    });

    const repositories = [];

    Object.entries(repoGroups).forEach(([key, repoCommits]) => {
      const repoName = key.split("|")[1];
      const grouped = filterAndGroupCommits(repoCommits);
      const items = groupedToReportItems(grouped);

      if (items.length > 0) {
        const repo = config.repositories.find(
          (currentRepo) => currentRepo.path === repoCommits[0].repoPath,
        );
        repositories.push({
          name: repoName,
          branch: repo ? repo.branch : "main",
          items,
        });
      }
    });

    if (repositories.length > 0) {
      report.dates.push({
        date,
        remark: "",
        repositories,
      });
    }
  });

  return report;
}

function main() {
  let allCommits = [];

  config.repositories.forEach((repo) => {
    const commits = getAllCommits(repo.path, repo.name);
    console.log(`  ✓ ${repo.name}: ${commits.length} 条提交`);
    allCommits = allCommits.concat(commits);
  });

  console.log(`\n📊 总计: ${allCommits.length} 条提交`);

  const monthGroups = groupByMonth(allCommits);
  console.log(`📅 跨越: ${Object.keys(monthGroups).length} 个月\n`);

  const monthKeys = Object.keys(monthGroups).sort();
  const currentMonthKey = getCurrentMonthKey();
  let totalDays = 0;

  monthKeys.forEach((monthKey) => {
    const year = parseInt(monthKey.substring(0, 4), 10);
    const month = parseInt(monthKey.substring(4, 6), 10);
    const monthCommits = monthGroups[monthKey];
    const dateGroups = groupByDate(monthCommits);
    const report = generateReport(dateGroups);

    totalDays += report.dates.length;

    if (report.dates.length === 0) {
      return;
    }

    report.month = `${year}-${String(month).padStart(2, "0")}`;

    if (monthKey === currentMonthKey) {
      const outputFile = getCurrentMonthReportPath(OUTPUT_DIR);
      writeReport(outputFile, report, monthKey);
      console.log(`✅ ${year}-${month} 月份日报已生成: ${outputFile}`);
      return;
    }

    const archiveFilePath = getArchiveReportPath(OUTPUT_DIR, year, month);
    writeReport(archiveFilePath, report, monthKey);
    console.log(`📦 已归档 ${year}-${month} 月份日报: ${archiveFilePath}`);
  });

  console.log(`📝 总计: ${totalDays} 个日报条目`);

  console.log("\n📊 生成统计数据...");
  let successCount = 0;

  const allDates = [];
  Object.values(monthGroups).forEach((monthCommits) => {
    const dateGroups = groupByDate(monthCommits);
    Object.keys(dateGroups).forEach((date) => allDates.push(date));
  });

  const uniqueDates = [...new Set(allDates)].sort();
  uniqueDates.forEach((date) => {
    try {
      updateStatistics(config, date);
      successCount++;
    } catch (err) {
      console.warn(`  ⚠️ ${date} 的统计数据生成失败:`, err.message);
    }
  });

  console.log(`✅ 统计数据已生成: ${successCount}/${uniqueDates.length} 天`);
}

main();
