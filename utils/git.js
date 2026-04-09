/**
 * Git 工具库
 * 用于封装 git 操作命令
 */

const { execSync } = require("child_process");
const path = require("path");

class GitUtil {
  /**
   * 获取仓库中特定日期范围内的提交
   * @param {string} repoPath - 仓库路径
   * @param {string} authorEmail - 作者邮箱
   * @param {string} since - 开始日期 (e.g., "2 days ago", "2026-03-10")
   * @param {string} until - 结束日期 (e.g., "now", "2026-03-12")
   * @returns {Array} 提交列表
   */
  static getCommits(repoPath, authorEmail, since = "1 day ago", until = "now") {
    try {
      const cmd = `cd "${repoPath}" && git log --since="${since}" --until="${until}" --author="${authorEmail}" --pretty=format:"%H|%s|%ae|%aI" --no-merges`;
      const output = execSync(cmd, { encoding: "utf8" });

      return output
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, subject, email, date] = line.split("|");
          return { hash, subject, email, date };
        });
    } catch (error) {
      console.error(`获取提交失败 (${repoPath}):`, error.message);
      return [];
    }
  }

  /**
   * 获取完整的提交历史
   * @param {string} repoPath - 仓库路径
   * @param {string} authorEmail - 作者邮箱
   * @returns {Array} 提交列表
   */
  static getAllCommits(repoPath, authorEmail) {
    try {
      const cmd = `cd "${repoPath}" && git log --author="${authorEmail}" --pretty=format:"%H|%s|%ae|%aI" --no-merges`;
      const output = execSync(cmd, { encoding: "utf8" });

      return output
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const [hash, subject, email, date] = line.split("|");
          return { hash, subject, email, date };
        });
    } catch (error) {
      console.error(`获取所有提交失败 (${repoPath}):`, error.message);
      return [];
    }
  }

  /**
   * 检查提交信息是否符合规范
   * @param {string} subject - 提交信息
   * @returns {boolean} 是否符合规范
   */
  static isValidCommit(subject) {
    return /^(feat|bugfix|fix):/i.test(subject);
  }

  /**
   * 获取提交中的任务 ID
   * @param {string} subject - 提交信息
   * @returns {string|null} 任务 ID
   */
  static extractTaskId(subject) {
    const match = subject.match(/(\w+-\d+)/);
    return match ? match[1] : null;
  }

  /**
   * 检查仓库是否存在
   * @param {string} repoPath - 仓库路径
   * @returns {boolean}
   */
  static isValidRepo(repoPath) {
    try {
      execSync(`cd "${repoPath}" && git rev-parse --git-dir`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取当前分支
   * @param {string} repoPath - 仓库路径
   * @returns {string} 分支名
   */
  static getCurrentBranch(repoPath) {
    try {
      return execSync(`cd "${repoPath}" && git rev-parse --abbrev-ref HEAD`, {
        encoding: "utf8",
      }).trim();
    } catch (error) {
      return "unknown";
    }
  }
}

module.exports = GitUtil;
