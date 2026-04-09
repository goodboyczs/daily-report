#!/usr/bin/env node

/**
 * 代码统计模块
 * 负责计算每个仓库的代码修改行数统计
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * 获取指定日期的代码修改统计
 * @param {string} repoPath - 仓库路径
 * @param {string} date - 日期 (YYYY-MM-DD)
 * @param {string} authorEmail - 作者邮箱
 * @returns {object} 统计结果 {additions: number, deletions: number, filesChanged: number}
 */
function getStatsForDate(repoPath, date, authorEmail) {
  try {
    // 检查仓库路径是否存在
    if (!fs.existsSync(repoPath)) {
      console.warn(`  ⚠️  仓库路径不存在: ${repoPath}`);
      return { additions: 0, deletions: 0, filesChanged: 0 };
    }

    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    // 获取该日期的所有commit哈希值（过滤合并提交）
    const command = `git log --since="${startOfDay}" --until="${endOfDay}" --pretty=format:"%H" --author="${authorEmail}" --no-merges`;
    const commits = execSync(command, {
      encoding: "utf-8",
      cwd: repoPath,
      stdio: ["pipe", "pipe", "ignore"],
    })
      .trim()
      .split("\n")
      .filter((c) => c.length > 0);

    if (commits.length === 0) {
      return { additions: 0, deletions: 0, filesChanged: 0 };
    }

    let totalAdditions = 0;
    let totalDeletions = 0;
    let filesChanged = new Set();

    // 对每个commit计算diff统计
    commits.forEach((commit) => {
      try {
        // 使用 git show --numstat 获取精确的行数统计（支持第一个提交）
        const diffOutput = execSync(
          `git show --numstat --format="" "${commit}"`,
          {
            encoding: "utf-8",
            cwd: repoPath,
            stdio: ["pipe", "pipe", "pipe"],
          },
        );

        // 解析 numstat 输出: additions\tdeletions\tfilename
        const lines = diffOutput.split("\n");
        lines.forEach((line) => {
          if (!line.trim()) return;
          const parts = line.split("\t");
          if (parts.length >= 3) {
            const additions = parseInt(parts[0]) || 0;
            const deletions = parseInt(parts[1]) || 0;
            const filename = parts[2];

            if (additions > 0 || deletions > 0) {
              totalAdditions += additions;
              totalDeletions += deletions;
              filesChanged.add(filename);
            }
          }
        });
      } catch (e) {
        // 忽略单个commit的错误
      }
    });

    return {
      additions: totalAdditions,
      deletions: totalDeletions,
      filesChanged: filesChanged.size,
    };
  } catch (err) {
    console.warn(`  ⚠️  从 ${repoPath} 获取统计信息失败:`, err.message);
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }
}

/**
 * 获取中国时区的日期
 */
function getDateInChinaTimezone() {
  const now = new Date();
  const chinaDate = new Date(
    now.getTime() + (now.getTimezoneOffset() + 8 * 60) * 60 * 1000,
  );
  return chinaDate.toISOString().split("T")[0];
}

/**
 * 更新统计数据
 * @param {object} config - 配置对象
 * @param {string} date - 日期 (YYYY-MM-DD)
 */
function updateStatistics(config, date = null) {
  if (!date) {
    date = getDateInChinaTimezone();
  }

  console.log(`📊 开始统计 ${date} 的数据`);

  // 读取或创建统计文件
  const statsPath = path.join(config.output_dir, "stats.json");
  let stats = { statistics: [] };

  if (fs.existsSync(statsPath)) {
    stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
  }

  // 检查该日期是否已存在
  let dayRecord = stats.statistics.find((s) => s.date === date);
  if (!dayRecord) {
    dayRecord = {
      date: date,
      repositories: [],
    };
    stats.statistics.push(dayRecord);
  }

  // 为每个仓库获取统计信息
  config.repositories.forEach((repo) => {
    console.log(`  处理仓库: ${repo.name} (${repo.branch})`);
    console.log(`    路径: ${repo.path}`);

    const repoStats = getStatsForDate(repo.path, date, config.author_email);

    console.log(
      `    统计: +${repoStats.additions}  -${repoStats.deletions}  文件数: ${repoStats.filesChanged}`,
    );

    // 更新或添加该仓库的记录
    let repoRecord = dayRecord.repositories.find(
      (r) => r.name === repo.name && r.branch === repo.branch,
    );
    if (!repoRecord) {
      repoRecord = {
        name: repo.name,
        branch: repo.branch,
      };
      dayRecord.repositories.push(repoRecord);
    }

    // 更新统计数据
    repoRecord.additions = repoStats.additions;
    repoRecord.deletions = repoStats.deletions;
    repoRecord.filesChanged = repoStats.filesChanged;
  });

  // 保存统计文件
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2), "utf-8");

  console.log(`✅ 统计完成，共 ${dayRecord.repositories.length} 个仓库\n`);

  return dayRecord;
}

module.exports = {
  getStatsForDate,
  getDateInChinaTimezone,
  updateStatistics,
};
