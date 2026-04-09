#!/usr/bin/env node

/**
 * Daily Report Generator - 定时任务管理器
 * 管理update脚本的定期执行
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

class Scheduler {
  constructor(config) {
    this.config = config;
    this.isRunning = false;
    this.timer = null;
    this.logsFile = path.join(config.dataDir || "./data", "scheduler.log");
  }

  /**
   * 启动定时任务
   */
  start() {
    if (this.isRunning) {
      this.log("定时任务已启动，不需要重复启动");
      return false;
    }

    const interval = (this.config.scheduler?.interval || 0.5) * 60 * 60 * 1000; // 转换为毫秒（小时→分→秒→毫秒）
    this.isRunning = true;

    const intervalMinutes = (this.config.scheduler?.interval || 0.5) * 60;
    this.log(`✅ 定时任务启动 (间隔: ${intervalMinutes}分钟)`);

    // 不立即执行，直接按间隔执行
    this.timer = setInterval(() => {
      this.executeUpdate();
    }, interval);

    return true;
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (!this.isRunning) {
      this.log("定时任务未运行");
      return false;
    }

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.isRunning = false;
    this.log("⏹️ 定时任务已停止");
    return true;
  }

  /**
   * 执行update脚本并收集详细日志
   */
  executeUpdate() {
    const startTime = new Date();
    const startTimeStr = startTime.toLocaleString("zh-CN");

    try {
      const scriptPath = path.join(__dirname, "..", "scripts", "update.js");

      this.log(`\n${"=".repeat(60)}`);
      this.log(`[${startTimeStr}] 开始执行更新任务...`);

      const output = execSync(`node "${scriptPath}"`, {
        encoding: "utf-8",
        cwd: path.join(__dirname, ".."),
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024, // 10MB 缓冲区
      });

      const endTime = new Date();
      const duration = endTime - startTime;
      const endTimeStr = endTime.toLocaleString("zh-CN");

      // 记录脚本的详细输出
      const outputLines = output.trim().split("\n");
      this.log("\n📋 执行详情:");
      outputLines.forEach((line) => {
        if (line.length > 0) {
          this.log(line);
        }
      });

      this.log(`\n[${endTimeStr}] 更新任务执行完成 (耗时: ${duration}ms)`);
      this.log(`✅ 状态: 成功`);
      this.log(`${"=".repeat(60)}\n`);

      return {
        success: true,
        startTime: startTimeStr,
        endTime: endTimeStr,
        duration: duration,
        output: output,
      };
    } catch (error) {
      const endTime = new Date();
      const duration = endTime - startTime;
      const endTimeStr = endTime.toLocaleString("zh-CN");

      const errorMsg = error.stdout ? error.stdout.toString() : error.message;

      this.log(`\n${"=".repeat(60)}`);
      this.log(`[${endTimeStr}] 更新任务执行失败 (耗时: ${duration}ms)`);
      this.log(`❌ 错误: ${error.message}`);

      if (errorMsg) {
        this.log(`\n📋 执行输出:`);
        const errorLines = errorMsg.trim().split("\n");
        errorLines.forEach((line) => {
          if (line.length > 0) {
            this.log(line);
          }
        });
      }
      this.log(`${"=".repeat(60)}\n`);

      return {
        success: false,
        startTime: startTimeStr,
        endTime: endTimeStr,
        duration: duration,
        error: error.message,
        output: errorMsg,
      };
    }
  }

  /**
   * 写入日志
   */
  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `${message}\n`;

    try {
      fs.appendFileSync(this.logsFile, logEntry, "utf-8");
    } catch (error) {
      console.error("写入日志失败:", error);
    }
  }

  /**
   * 获取日志内容
   */
  getLogs(lines = 100) {
    try {
      if (!fs.existsSync(this.logsFile)) {
        return "暂无日志";
      }

      const content = fs.readFileSync(this.logsFile, "utf-8");
      const allLines = content.split("\n");

      // 返回最后N行
      const lastLines = allLines.slice(-lines);
      return lastLines.join("\n");
    } catch (error) {
      return `获取日志失败: ${error.message}`;
    }
  }

  /**
   * 清空日志
   */
  clearLogs() {
    try {
      fs.writeFileSync(this.logsFile, "", "utf-8");
      this.log("📝 日志已清空");
      return true;
    } catch (error) {
      console.error("清空日志失败:", error);
      return false;
    }
  }

  /**
   * 获取状态
   */
  getStatus() {
    const intervalMinutes = (this.config.scheduler?.interval || 0.5) * 60;
    return {
      isRunning: this.isRunning,
      interval: intervalMinutes,
      nextExecutionTime: this.isRunning
        ? new Date(
            Date.now() +
              (this.config.scheduler?.interval || 0.5) * 60 * 60 * 1000,
          ).toLocaleString("zh-CN")
        : "未启动",
    };
  }

  /**
   * 更新配置（重新计算间隔）
   */
  updateConfig(newConfig) {
    const wasRunning = this.isRunning;

    // 如果正在运行，先停止
    if (wasRunning) {
      this.stop();
    }

    // 更新配置
    this.config = newConfig;

    // 如果之前运行，重新启动（使用新配置）
    if (wasRunning) {
      this.start();
    }

    return true;
  }
}

module.exports = Scheduler;
