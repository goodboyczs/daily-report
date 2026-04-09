#!/usr/bin/env node

/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: Daily Report Generator Web 服务器，统一从 JSON 报表读取数据
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const Scheduler = require("./utils/scheduler");
const {
  getCurrentMonthKey,
  getDateEntry,
  listReportFiles,
  readReport,
  upsertRemark,
  writeReport,
} = require("./utils/report-storage");

const PORT = 6688;
const ROOT_DIR = __dirname;

// 初始化定时任务管理器
let scheduler = null;
function initScheduler() {
  try {
    const configPath = path.join(__dirname, "config", "config.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    scheduler = new Scheduler({
      dataDir: config.output_dir,
      scheduler: config.scheduler || { enabled: true, interval: 1 },
    });

    console.log("✅ 定时任务管理器已初始化");

    // 如果配置中enabled不是false，则启动定时任务（默认开启）
    if (config.scheduler?.enabled !== false) {
      scheduler.start();
      const intervalMinutes = (config.scheduler?.interval || 0.5) * 60;
      console.log(`✅ 定时任务已启动 (间隔: ${intervalMinutes}分钟)`);
    } else {
      console.log("ℹ️ 定时任务已禁用");
    }
  } catch (error) {
    console.error("❌ 初始化定时任务管理器失败:", error.message);
    console.error("错误详情:", error);
  }
}

// MIME 类型映射
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// 提供文件的函数（在 createServer 外部定义，避免重复定义）
function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("500 Internal Server Error");
      return;
    }

    // 获取文件扩展名
    const ext = path.extname(filePath);
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // 设置响应头
    res.writeHead(200, {
      "Content-Type": mimeType,
      "Content-Length": data.length,
      "Cache-Control": "no-cache",
    });

    res.end(data);
  });
}

// 创建服务器
const server = http.createServer((req, res) => {
  // 解析 URL
  const parsedUrl = url.parse(req.url, true);

  // 处理 API 执行命令
  if (parsedUrl.pathname === "/api/execute" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const command = data.command;

        if (!command) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "缺少 command 参数" }));
          return;
        }

        // 验证命令白名单（安全考虑）
        const allowedCommands = ["update", "init"];
        if (!allowedCommands.includes(command)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "不支持的命令" }));
          return;
        }

        // 执行脚本
        const { execSync } = require("child_process");
        const scriptPath = path.join(__dirname, "scripts", `${command}.js`);

        try {
          const output = execSync(`node "${scriptPath}"`, {
            encoding: "utf-8",
            cwd: __dirname,
            stdio: ["pipe", "pipe", "pipe"],
          });

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true, output: output }));
        } catch (execError) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: execError.message,
              output: execError.stdout ? execError.stdout.toString() : "",
            }),
          );
        }
      } catch (parseError) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "JSON 格式错误" }));
      }
    });
    return;
  }

  // 处理保存配置
  if (parsedUrl.pathname === "/api/save-config" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        const config = JSON.parse(body);
        const configPath = path.join(__dirname, "config", "config.json");

        // 验证必要字段
        if (!config.author_email || !config.output_dir) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "缺少必要的配置字段" }));
          return;
        }

        // 写入配置文件
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

        // 如果定时任务配置改变，则更新scheduler
        if (scheduler && config.scheduler) {
          scheduler.updateConfig({
            dataDir: config.output_dir,
            scheduler: config.scheduler,
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: "配置已保存",
            config: config,
          }),
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: error.message,
          }),
        );
      }
    });
    return;
  }

  // 处理定时任务 - 启动
  if (parsedUrl.pathname === "/api/scheduler/start" && req.method === "POST") {
    if (!scheduler) {
      initScheduler();
    }

    if (scheduler.start()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "定时任务已启动" }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "定时任务已启动" }));
    }
    return;
  }

  // 处理定时任务 - 停止
  if (parsedUrl.pathname === "/api/scheduler/stop" && req.method === "POST") {
    if (!scheduler) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, message: "定时任务管理器未初始化" }),
      );
      return;
    }

    if (scheduler.stop()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "定时任务已停止" }));
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "定时任务未启动" }));
    }
    return;
  }

  // 处理定时任务 - 获取状态
  if (parsedUrl.pathname === "/api/scheduler/status" && req.method === "GET") {
    if (!scheduler) {
      initScheduler();
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, status: scheduler.getStatus() }));
    return;
  }

  // 处理定时任务 - 获取日志
  if (parsedUrl.pathname === "/api/scheduler/logs" && req.method === "GET") {
    if (!scheduler) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, message: "定时任务管理器未初始化" }),
      );
      return;
    }

    const lines = parsedUrl.query.lines ? parseInt(parsedUrl.query.lines) : 100;
    const logs = scheduler.getLogs(lines);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: true, logs: logs }));
    return;
  }

  // 处理定时任务 - 清空日志
  if (
    parsedUrl.pathname === "/api/scheduler/clear-logs" &&
    req.method === "POST"
  ) {
    if (!scheduler) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, message: "定时任务管理器未初始化" }),
      );
      return;
    }

    if (scheduler.clearLogs()) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, message: "日志已清空" }));
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, message: "清空日志失败" }));
    }
    return;
  }

  // 处理定时任务 - 立即执行
  if (
    parsedUrl.pathname === "/api/scheduler/execute" &&
    req.method === "POST"
  ) {
    if (!scheduler) {
      initScheduler();
    }

    const result = scheduler.executeUpdate();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: result.success, result: result }));
    return;
  }

  // 处理列出所有日报文件
  if (parsedUrl.pathname === "/api/list-reports" && req.method === "GET") {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );
      const dataDir = config.output_dir;
      const currentMonthFile = `reports_${getCurrentMonthKey()}.json`;
      const reports = listReportFiles(dataDir);

      if (!reports.includes(currentMonthFile)) {
        reports.unshift(currentMonthFile);
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          reports,
        }),
      );
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
      );
    }
    return;
  }

  // 处理获取指定日报文件内容
  if (parsedUrl.pathname === "/api/get-report" && req.method === "GET") {
    try {
      const fileName = parsedUrl.query.file;

      if (!fileName) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少 file 参数" }));
        return;
      }

      // 防止路径遍历攻击
      if (
        fileName.includes("..") ||
        fileName.includes("/") ||
        fileName.includes("\\")
      ) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "非法的文件名" }));
        return;
      }

      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );
      const filePath = path.join(config.output_dir, fileName);
      const currentMonthFile = `reports_${getCurrentMonthKey()}.json`;

      // 验证文件存在
      if (
        !/^reports_.*\.json$/.test(fileName) ||
        (!fs.existsSync(filePath) && fileName !== currentMonthFile)
      ) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "文件不存在" }));
        return;
      }
      const monthKeyMatch = fileName.match(/^reports_(\d{6})\.json$/);
      const monthKey = monthKeyMatch ? monthKeyMatch[1] : getCurrentMonthKey();
      const report = readReport(filePath, monthKey);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          fileName: fileName,
          report,
        }),
      );
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
      );
    }
    return;
  }

  // 处理获取统计数据
  if (parsedUrl.pathname === "/api/get-stats" && req.method === "GET") {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );
      const statsPath = path.join(config.output_dir, "stats.json");

      // 读取统计文件
      if (!fs.existsSync(statsPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, statistics: [] }));
        return;
      }

      let stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));

      // 处理查询参数 - 日期范围
      const startDate = parsedUrl.query.startDate;
      const endDate = parsedUrl.query.endDate;
      const repository = parsedUrl.query.repository;

      if (startDate || endDate) {
        stats.statistics = stats.statistics.filter((stat) => {
          let inRange = true;
          if (startDate && stat.date < startDate) inRange = false;
          if (endDate && stat.date > endDate) inRange = false;
          return inRange;
        });
      }

      // 按仓库筛选
      if (repository) {
        stats.statistics.forEach((stat) => {
          stat.repositories = stat.repositories.filter(
            (repo) => repo.name === repository,
          );
        });
      }

      // 按日期排序
      stats.statistics.sort((a, b) => a.date.localeCompare(b.date));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, ...stats }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
      );
    }
    return;
  }

  // 处理获取补充内容
  if (parsedUrl.pathname === "/api/get-remark" && req.method === "GET") {
    try {
      const date = parsedUrl.query.date;
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "无效的日期参数" }));
        return;
      }

      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );

      // 解析日期，确定对应的月份日报文件
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const monthKey = `${year}${month}`;
      const reportPath = path.join(
        config.output_dir,
        `reports_${monthKey}.json`,
      );

      if (!fs.existsSync(reportPath)) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, remark: "" }));
        return;
      }
      const reportData = readReport(reportPath, monthKey);
      const dateEntry = getDateEntry(reportData, date);
      const remark = dateEntry ? dateEntry.remark || "" : "";

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, remark }));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: false, error: error.message }));
    }
    return;
  }

  // 处理保存补充内容
  if (parsedUrl.pathname === "/api/save-remark" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        const { date, remark } = JSON.parse(body);

        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "无效的日期参数" }));
          return;
        }

        const config = JSON.parse(
          fs.readFileSync(
            path.join(__dirname, "config", "config.json"),
            "utf-8",
          ),
        );

        // 解析日期，确定对应的月份日报文件
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, "0");
        const monthKey = `${year}${month}`;
        const reportPath = path.join(
          config.output_dir,
          `reports_${monthKey}.json`,
        );

        if (!fs.existsSync(config.output_dir)) {
          fs.mkdirSync(config.output_dir, { recursive: true });
        }

        const trimmedRemark = (remark || "").trim();
        const reportData = readReport(reportPath, monthKey);
        upsertRemark(reportData, date, trimmedRemark);
        writeReport(reportPath, reportData, monthKey);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: true,
            message: trimmedRemark ? "补充内容已保存" : "补充内容已清除",
          }),
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // 处理获取已归档月份列表
  if (
    parsedUrl.pathname === "/api/get-archive-months" &&
    req.method === "GET"
  ) {
    try {
      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );
      const dataDir = config.output_dir;

      const files = listReportFiles(dataDir);
      const months = new Set();

      files.forEach((file) => {
        let match = file.match(/^reports_(\d{4})(\d{2})\.json$/);
        if (match) {
          const month = `${match[1]}-${match[2]}`;
          months.add(month);
          return;
        }

        match = file.match(
          /^reports_(\d{4})(\d{2})\d{2}_(\d{4})(\d{2})\d{2}\.json$/,
        );
        if (match) {
          const month = `${match[1]}-${match[2]}`;
          months.add(month);
          return;
        }
      });

      // 排序
      const monthsList = Array.from(months).sort();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(monthsList));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  // 处理获取指定月份的日详细数据
  if (parsedUrl.pathname === "/api/get-archive-data" && req.method === "GET") {
    try {
      const month = parsedUrl.query.month;
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "无效的月份参数" }));
        return;
      }

      const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, "config", "config.json"), "utf-8"),
      );

      // 首先从stats.json中获取该月份的所有日期数据
      const statsPath = path.join(config.output_dir, "stats.json");
      const [year, monthNum] = month.split("-");
      const dayData = [];

      if (fs.existsSync(statsPath)) {
        const stats = JSON.parse(fs.readFileSync(statsPath, "utf-8"));
        const monthStats = stats.statistics.filter((stat) => {
          return stat.date.startsWith(`${year}-${monthNum}-`);
        });
        dayData.push(...monthStats);
      }

      // 按日期排序
      dayData.sort((a, b) => a.date.localeCompare(b.date));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(dayData));
    } catch (error) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
    return;
  }

  if (parsedUrl.pathname === "/") {
    res.writeHead(302, { Location: "/ui/" });
    res.end();
    return;
  }

  let filePath = path.join(ROOT_DIR, parsedUrl.pathname);

  // 防止路径遍历攻击
  const realPath = path.resolve(filePath);
  if (!realPath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("403 Forbidden");
    return;
  }

  // 检查文件是否存在
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    // 如果是目录，尝试找 index.html
    if (stats.isDirectory()) {
      // 没有尾部斜杠时重定向，避免相对路径解析错误
      if (!parsedUrl.pathname.endsWith("/")) {
        res.writeHead(302, { Location: parsedUrl.pathname + "/" });
        res.end();
        return;
      }
      filePath = path.join(filePath, "index.html");
      // 重新检查 index.html 是否存在
      fs.stat(filePath, (err, stats) => {
        if (err) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("404 Not Found: index.html");
          return;
        }
        serveFile(res, filePath);
      });
      return;
    }

    serveFile(res, filePath);
  });
});

// 初始化定时任务
initScheduler();

// 启动服务器
server.listen(PORT, "localhost", () => {
  console.log("\n" + "═".repeat(60));
  console.log("  🚀 Daily Report Generator Web 服务器");
  console.log("═".repeat(60));
  console.log(`\n  ✅ 服务器已启动`);
  console.log(`  📍 地址: http://localhost:${PORT}`);
  console.log(`  🌐 UI: http://localhost:${PORT}/ui/`);
  console.log(`  📁 根目录: ${ROOT_DIR}`);
  console.log(`\n  💡 提示:`);
  console.log(`     1. 在浏览器中打开上面的地址`);
  console.log(`     2. 或直接访问: http://localhost:${PORT}`);
  console.log(`     3. 按 Ctrl+C 关闭服务器`);
  console.log(`\n` + "═".repeat(60) + "\n");
});

// 优雅关闭
process.on("SIGINT", () => {
  console.log("\n\n⛔ 服务器已关闭");
  process.exit(0);
});

// 错误处理
server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ 错误: 端口 ${PORT} 已被占用`);
    console.error(`   请关闭占用该端口的其他程序，然后重试`);
  } else {
    console.error("❌ 服务器错误:", err.message);
  }
  process.exit(1);
});
