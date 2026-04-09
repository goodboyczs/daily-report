<!--
作者: cui-zhsh
日期: 2026-04-09
描述: 项目 README，按当前实现更新并移除敏感示例信息
-->

# Daily Report Generator

一个基于 Node.js 的本地日报生成工具，用于从多个 Git 仓库提取指定作者的提交记录，按日期、仓库、分支和任务号聚合，并通过本地 Web 界面查看、补充备注和管理配置。

当前实现以 JSON 作为主数据源，Markdown 仅作为展示格式输出。

## 功能概览

- 支持多个本地 Git 仓库统一采集提交记录
- 按作者邮箱过滤提交
- 仅收集以 feat: 或 bugfix: 开头的提交
- 自动提取任务号并合并同任务下的多条描述
- 支持初始化历史日报与增量更新今日日报
- 提供本地 Web UI 查看日报、统计和配置
- 支持定时执行 update 脚本
- 输出日报统计信息，如增删行数和变更文件数

## 运行环境

- Node.js 18 及以上
- Git 已安装，且目标目录均为可访问的本地 Git 仓库
- Windows 环境下可直接使用 start.vbs 和 stop.cmd

## 快速开始

### 1. 准备配置文件

复制 config/config.example.json 为 config/config.json，并将内容改为你自己的本地环境。

示例配置中的邮箱、路径、项目名均为假的占位值：

```json
{
  "author_email": "dev-demo@example.com",
  "output_dir": "C:\\Work\\demo-daily-report\\data",
  "repositories": [
    {
      "path": "D:\\workspace\\demo-project-alpha",
      "name": "demo-project-alpha",
      "branch": "develop"
    },
    {
      "path": "D:\\workspace\\demo-project-beta",
      "name": "demo-project-beta",
      "branch": "main"
    }
  ],
  "scheduler": {
    "enabled": true,
    "interval": 0.5
  }
}
```

字段说明：

- author_email: 用于过滤提交作者
- output_dir: 日报和统计文件输出目录，通常建议指向 data 目录
- repositories: 需要扫描的仓库列表
- scheduler.enabled: 是否启用定时任务
- scheduler.interval: 定时执行间隔，单位为小时

### 2. 启动服务

方式一：双击启动

```powershell
start.vbs
```

方式二：命令行启动

```powershell
node server.js
```

默认访问地址：

```text
http://localhost:6688
```

### 3. 生成日报

可以通过 Web UI 执行，也可以直接运行脚本：

```powershell
node scripts/update.js
```

首次为历史数据建档时可运行：

```powershell
node scripts/init.js
```

如需通过命令行交互方式追加仓库：

```powershell
node scripts/add.js
```

## 提交识别规则

当前脚本只会处理符合以下条件的提交：

- 作者邮箱等于配置中的 author_email
- 提交标题以 feat: 或 bugfix: 开头

任务号识别规则：

- 会从提交标题中提取类似 RS7-1234 的任务号
- 同一仓库、同一天、同一任务号、同一类型的提交会被合并
- 未识别到任务号时会归类到 other

示例提交：

```text
feat: RS7-1024 完善日报卡片展示
bugfix: RS7-2048 修复统计接口空数据报错
feat: 调整首页布局
```

## 数据输出说明

### 主数据文件

当前主输出为 JSON 文件：

- data/reports_YYYYMM.json: 当前月份日报
- data/reports_YYYYMMDD_YYYYMMDD.json: 已归档月份日报
- data/stats.json: 代码统计结果
- data/history/reports.md: 历史 Markdown 备份

说明：

- 服务端读取 JSON 报表后再渲染成 Markdown 供前端展示
- 老的 reports\_\*.md 不再作为主流程输入
- 当月份切换时，旧月份 JSON 会自动归档

### data 目录的 Git 规则

仓库当前已配置忽略 data 目录中的内容，因此本地生成的数据、日志和统计文件默认不会提交到 Git。

## Web 界面能力

本地页面主要提供以下能力：

- 仪表盘：执行 update 和 init，查看基础统计
- 日报查看：浏览当前或归档日报内容
- 统计视图：查看代码增删行和文件变更数
- 配置管理：编辑仓库列表、作者邮箱和输出目录
- 定时任务：查看状态、启停任务、读取日志

## 项目结构

```text
daily-report/
├─ config/
│  ├─ config.example.json
│  └─ config.json
├─ data/
│  ├─ history/
│  └─ ...generated files
├─ scripts/
│  ├─ add.js
│  ├─ init.js
│  ├─ stats.js
│  ├─ update.js
│  └─ migrate-reports-to-json.js
├─ ui/
│  ├─ index.html
│  └─ assets/
├─ utils/
│  ├─ file.js
│  ├─ git.js
│  ├─ logger.js
│  ├─ report-storage.js
│  └─ scheduler.js
├─ server.js
├─ start.vbs
└─ stop.cmd
```

## 常用操作

启动服务：

```powershell
node server.js
```

停止服务：

```powershell
stop.cmd
```

注意：当前 stop.cmd 会尝试关闭系统中的 node.exe 进程，使用前请确认没有其他需要保留的 Node.js 服务。

## 安全与隐私建议

- 不要把真实邮箱、真实仓库路径、真实内网项目名写入公开文档
- config/config.json 应视为本地私有配置文件
- 对外分享仓库时，优先提供 config/config.example.json 作为模板
- 如需公开演示，建议使用假的邮箱、假的磁盘路径和假的项目名

## 故障排查

如果页面无法访问：

- 确认 node server.js 已正常启动
- 确认 6688 端口未被其他程序占用
- 检查 config/config.json 是否为合法 JSON

如果日报为空：

- 确认 author_email 与 Git 提交作者一致
- 确认目标仓库路径存在且可读取
- 确认当日提交标题符合 feat: 或 bugfix: 规则

如果统计数据为空：

- 确认目标日期确实存在匹配提交
- 确认仓库中可以正常执行 git log 和 git show

## 说明

本项目适合在本地个人环境或小团队内部环境中使用，默认面向 Windows 桌面场景设计。

```
📅 生成日报...
  ✓ app-wis: 3 条提交
  ✓ app-wis-i18n: 2 条提交
✅ 日报已更新
```

## 🔧 修改配置

### 方式 1：通过 UI（推荐）

1. 启动服务：双击 `start.vbs`
2. 点击"配置设置"标签页
3. 编辑相关信息
4. 点击"保存"

### 方式 2：编辑配置文件

1. 打开 `config/config.json`
2. 修改配置项
3. 重新启动服务或刷新浏览器

### 方式 3：通过命令行添加（如果只是添加仓库）

```bash
cd C:\Users\Administrator\Desktop\daily-report
node add.cmd
```

---

## 🌐 Web 服务器说明

### 为什么需要 Web 服务器？

浏览器使用 `file://` 协议打开本地 HTML 时，有安全限制：

- ❌ 无法使用 `fetch()` 加载其他文件
- ❌ 无法跨域访问数据
- ❌ 无法正确加载 JSON 配置

使用 `http://` 协议则可以正常加载所有文件。

### 服务器特性

| 特性         | 说明                  |
| ------------ | --------------------- |
| **端口**     | 6688（可修改）        |
| **协议**     | HTTP                  |
| **地址**     | http://localhost:6688 |
| **静态文件** | 完整支持              |
| **CORS**     | 已启用                |
| **缓存**     | 禁用（开发模式）      |

### 访问路径

当服务器启动后，可以访问以下路径：

| 路径                                       | 说明        |
| ------------------------------------------ | ----------- |
| `http://localhost:6688/`                   | 重定向到 UI |
| `http://localhost:6688/ui/`                | Web UI 界面 |
| `http://localhost:6688/config/config.json` | 配置文件    |
| `http://localhost:6688/data/reports.md`    | 日报文件    |
| `http://localhost:6688/README.md`          | 项目文档    |

### 如何停止服务

**在后台运行时：**

1. Win + R 打开任务管理器（taskmgr）
2. 找到 `node.exe` 进程
3. 右键选择"结束任务"

**或通过命令行：**

```bash
taskkill /f /im node.exe
```

---

## 🔍 常见问题

### Q1: 启动后看不到仓库提交

**检查项：**

- [ ] 邮箱是否与 `git config --global user.email` 一致？
- [ ] 仓库路径是否正确且包含 `.git` 文件夹？
- [ ] Commit message 是否以 `feat:` 或 `bugfix:` 开头？
- [ ] 日期范围是否正确？（默认只显示当天的提交）

**验证邮箱一致：**

```bash
# 查看配置的邮箱
git config --global user.email

# 然后在 UI 的"配置设置"中检查是否一致
```

### Q2: 网页打不开

**排查步骤：**

1. 确认已双击 `start.vbs`
2. 浏览器输入 `http://localhost:6688`
3. 如果还是无法访问，检查命令行：

```bash
node server.js
```

查看是否有错误信息。

### Q3: 修改配置后没有生效

**原因和解决方案：**

- ❌ 如果通过 UI 修改 - 点击"保存"按钮
- ❌ 如果直接编辑文件 - 刷新浏览器（Ctrl+F5）或重启服务

### Q4: 日报文件很大或生成很慢

**原因：**

- 使用了 `init.cmd` 生成完整历史
- 项目提交记录太多

**解决方案：**

- 用 `update.cmd` 生成每日日报（更快）
- 在 `config.json` 中限制仓库数量或分支

### Q5: 如何删除仓库？

**通过 UI：**

1. 点击"仓库管理"
2. 找到要删除的仓库
3. 点击"删除"按钮
4. 确认删除

**或直接编辑：**

打开 `config/config.json`，找到 `repositories` 数组，删除对应的仓库项。

---

## 📊 项目完成情况

### 已完成的功能

✅ **Web UI 界面**

- 响应式网页设计
- 5 个功能模块（仪表盘、仓库管理、日报查看、配置设置、关于）
- 模态框和对话框
- Markdown 渲染

✅ **后端脚本**

- 从 Git 获取提交信息
- 按日期、任务 ID 聚合
- 生成 Markdown 格式的日报
- 配置管理和验证

✅ **工具库**

- `git.js` - Git 操作工具
- `logger.js` - 日志工具
- `file.js` - 文件操作工具

✅ **优化的目录结构**

- 配置文件专用目录
- 数据输出专用目录
- Web UI 独立目录
- 工具库专用目录

✅ **完整的文档**

- 快速开始指南
- 详细的功能说明
- API 文档
- 常见问题解答

✅ **后台服务**

- 无窗口启动脚本
- Web 服务器集成
- 完整的日志记录

---

## 🛠️ 开发信息（针对开发者）

### 文件变更历史

使用 Git 查看项目的完整变更历史：

```bash
git log --oneline
```

### 项目依赖

**零外部依赖！** 项目使用 100% 原生 Node.js，没有 npm 包依赖。

### 扩展性

项目设计充分考虑了扩展性：

- 工具库模块化，易于添加新工具
- 脚本独立，可单独运行或组合
- UI 采用模块化设计，易于添加新功能
- 配置文件清晰，易于管理

---

## 🎨 UI 详细指南

### UI 文件结构

```
ui/
├── index.html              🏠 主 HTML 文件（400+ 行）
├── assets/
│   ├── css/
│   │   └── style.css       🎨 样式表（600+ 行）
│   └── js/
│       └── app.js          ⚙️ 应用逻辑（600+ 行）
└── README.md               📖 使用指南（已整合到本文件）
```

### 技术栈

| 技术                   | 用途     | 说明                   |
| ---------------------- | -------- | ---------------------- |
| **HTML5**              | 页面结构 | 语义化标签，无框架依赖 |
| **CSS3**               | 样式表现 | 现代样式和响应式设计   |
| **Vanilla JavaScript** | 应用逻辑 | 纯原生 JS，无框架依赖  |
| **Font Awesome**       | 图标库   | CDN 引入，提供丰富图标 |
| **LocalStorage**       | 本地存储 | 可选的配置缓存         |

### UI 使用建议

#### 日常使用流程

1. **打开 UI**

   ```
   双击 start.vbs 或在浏览器访问 http://localhost:6688
   ```

2. **点击"更新今日日报"**
   - 生成或更新最近一天的提交日报
   - 只需点击一个按钮，自动执行脚本

3. **查看"日报查看"获取结果**
   - 实时预览生成的报告
   - Markdown 格式渲染

4. **复制报告内容到其他地方**
   - 直接复制或下载报告

#### 定期检查清单

- [ ] **每周** - 检查一次配置是否正确
- [ ] **每周** - 确保所有仓库都被监听
- [ ] **每周** - 验证邮箱是否匹配
- [ ] **每月** - 检查日报文件大小是否过大

#### 批量操作

| 操作             | 方法                                              | 适用场景               |
| ---------------- | ------------------------------------------------- | ---------------------- |
| **添加多个仓库** | 使用 `add.cmd` 逐个添加，或直接编辑 `config.json` | 项目刚开始使用         |
| **生成完整历史** | 点击"初始化历史"或双击 `init.cmd`                 | 首次使用，需要历史数据 |
| **日常更新**     | 点击"更新今日日报"或双击 `update.cmd`             | 每天下班时             |

### UI 故障排查表

| 症状                           | 可能原因                   | 解决方案                                  |
| ------------------------------ | -------------------------- | ----------------------------------------- |
| **看不到提交**                 | 邮箱不匹配                 | 检查 `git config --global user.email`     |
| **报错：Not a git repository** | 仓库路径错误               | 验证路径是否存在且包含 `.git` 文件夹      |
| **日报没有更新**               | commit message 格式错误    | 确保 message 以 `feat:` 或 `bugfix:` 开头 |
| **UI 无法加载**                | 浏览器不兼容               | 使用 Chrome/Firefox/Edge 等现代浏览器     |
| **点击按钮无反应**             | JavaScript 错误            | 打开 F12 开发者工具检查 Console 标签      |
| **配置保存失败**               | 开发者工具未打开或权限问题 | 检查浏览器控制台是否有错误                |

### UI 进阶用法

#### 1. 自定义输出位置

在"配置设置"或直接编辑 `config/config.json` 的 `output_dir` 字段：

```json
"output_dir": "C:\\Users\\Administrator\\Desktop\\reports"
```

#### 2. 多分支监听同一项目

同一项目可以配置不同的分支，使用不同的 `name` 区分：

```json
{
  "path": "D:\\project",
  "name": "project-main",    // 区分名称
  "branch": "main"
},
{
  "path": "D:\\project",
  "name": "project-develop",  // 区分名称
  "branch": "develop"
}
```

#### 3. 批量添加仓库

直接编辑 `config/config.json` 的 `repositories` 数组，一次性添加多个仓库：

```json
"repositories": [
  {"path": "D:\\project1", "name": "project1", "branch": "main"},
  {"path": "D:\\project2", "name": "project2", "branch": "develop"},
  {"path": "D:\\project3", "name": "project3", "branch": "feature"}
]
```

#### 4. 导出和分享配置

- **导出配置** - 备份 `config/config.json`
- **导入配置** - 将备份的配置复制到新机器
- **分享给团队** - 所有成员使用相同的配置文件

#### 5. 定时执行任务

使用 Windows 计划任务自动执行脚本（可选）：

1. Win + R 打开"任务计划程序"
2. 创建新任务，设置触发器为"每天下班时间"
3. 操作设置为运行 `scripts/update.cmd`

---

## 📞 获取帮助

### 遇到问题？

1. 查看"常见问题"部分
2. 检查浏览器开发工具（F12）的控制台是否有错误
3. 查看服务器日志：`server.log` 文件
4. 查看 UI 界面的"日志"部分

### 需要修改？

1. **配置相关** - 编辑 `config/config.json`
2. **UI 样式** - 修改 `ui/assets/css/style.css`
3. **UI 功能** - 修改 `ui/assets/js/app.js`
4. **脚本逻辑** - 修改 `scripts/` 下的脚本文件
5. **工具库** - 修改 `utils/` 下的工具文件

### 浏览器兼容性

- ✅ Chrome 80+
- ✅ Firefox 75+
- ✅ Edge 80+
- ✅ Safari 2020+

---

**祝你使用愉快！** 🎉
