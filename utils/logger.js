/**
 * 日志工具库
 * 用于规范化日志输出
 */

const fs = require("fs");
const path = require("path");

class Logger {
  constructor(logFile = null) {
    this.logFile = logFile;
    this.logs = [];
  }

  /**
   * 打印成功信息
   */
  success(message) {
    this.log("✅ " + message, "success");
  }

  /**
   * 打印错误信息
   */
  error(message) {
    this.log("❌ " + message, "error");
  }

  /**
   * 打印警告信息
   */
  warn(message) {
    this.log("⚠️  " + message, "warn");
  }

  /**
   * 打印信息
   */
  info(message) {
    this.log("ℹ️  " + message, "info");
  }

  /**
   * 打印分隔线
   */
  separator() {
    console.log("═".repeat(60));
  }

  /**
   * 打印标题
   */
  title(text) {
    this.separator();
    console.log("  " + text);
    this.separator();
  }

  /**
   * 核心日志方法
   */
  log(message, type = "info") {
    const timestamp = this.getTimestamp();
    const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;

    // 打印到控制台
    console.log(logEntry);

    // 保存到日志数组
    this.logs.push({
      timestamp,
      type,
      message,
    });

    // 如果指定了日志文件，写入文件
    if (this.logFile) {
      try {
        fs.appendFileSync(this.logFile, logEntry + "\n");
      } catch (err) {
        console.error("无法写入日志文件:", err.message);
      }
    }
  }

  /**
   * 获取当前时间戳
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * 获取所有日志
   */
  getLogs() {
    return this.logs;
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
  }

  /**
   * 导出日志为 JSON
   */
  exportJson() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * 打印统计信息
   */
  stats() {
    console.log("\n" + "═".repeat(60));
    console.log("  📊 日志统计");
    console.log("═".repeat(60));

    const stats = {
      success: this.logs.filter((l) => l.type === "success").length,
      error: this.logs.filter((l) => l.type === "error").length,
      warn: this.logs.filter((l) => l.type === "warn").length,
      info: this.logs.filter((l) => l.type === "info").length,
      total: this.logs.length,
    };

    console.log(`  ✅ 成功: ${stats.success}`);
    console.log(`  ❌ 错误: ${stats.error}`);
    console.log(`  ⚠️  警告: ${stats.warn}`);
    console.log(`  ℹ️  信息: ${stats.info}`);
    console.log(`  📈 总计: ${stats.total}`);
    console.log("═".repeat(60) + "\n");
  }
}

module.exports = Logger;
