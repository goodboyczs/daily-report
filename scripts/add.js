#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const readline = require("readline");

// 读取配置文件（从 config 目录）
const configPath = path.join(__dirname, "..", "config", "config.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("\n=== 添加新仓库 ===\n");

  const repoPath = await askQuestion("输入仓库路径 (例如: D:\\my-project): ");
  const repoName = await askQuestion("输入仓库名称 (用于日报显示): ");
  const branch =
    (await askQuestion("输入分支名称 (默认: develop-core): ")) ||
    "develop-core";

  if (!repoPath || !repoName) {
    console.log("\n❌ 错误: 路径和名称不能为空");
    rl.close();
    return;
  }

  // 检查路径是否存在
  if (!fs.existsSync(repoPath)) {
    console.log(`\n❌ 错误: 路径不存在: ${repoPath}`);
    rl.close();
    return;
  }

  // 检查是否是git仓库
  const gitPath = path.join(repoPath, ".git");
  if (!fs.existsSync(gitPath)) {
    console.log(`\n❌ 错误: 该路径不是git仓库: ${repoPath}`);
    rl.close();
    return;
  }

  // 检查是否已存在
  const exists = config.repositories.some((r) => r.path === repoPath);
  if (exists) {
    console.log(`\n⚠️  警告: 该仓库已存在，正在更新配置...\n`);
    const index = config.repositories.findIndex((r) => r.path === repoPath);
    config.repositories[index] = { path: repoPath, name: repoName, branch };
  } else {
    config.repositories.push({ path: repoPath, name: repoName, branch });
    console.log(`\n✅ 成功添加仓库: ${repoName}`);
  }

  // 保存配置
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log(`✅ 配置已保存到: ${configPath}`);

  console.log("\n当前配置的仓库:");
  config.repositories.forEach((repo, index) => {
    console.log(`  ${index + 1}. ${repo.name} (${repo.path}) - ${repo.branch}`);
  });

  rl.close();
}

main();
