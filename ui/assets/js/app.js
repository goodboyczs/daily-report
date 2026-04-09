/**
 * 作者: cui-zhsh
 * 日期: 2026-04-08
 * 描述: Daily Report Generator 前端 UI 逻辑
 */

class DailyReportApp {
  constructor() {
    this.config = null;
    this.currentCommand = null;
    this.editingRepoIndex = null;
    this.currentReportData = null; // 保存原始日报数据，用于展示和复制功能
    this.init();
  }

  /**
   * 初始化应用
   */
  init() {
    this.setupEventListeners();
    this.loadConfig(); // 异步加载，完成后会调用 updateDashboard
    this.startSchedulerStatusUpdate(); // 启动定时任务状态更新
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 导航菜单
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.switchView(item.getAttribute("data-view"));
      });
    });

    // 仪表盘快速操作
    document
      .getElementById("btn-update")
      .addEventListener("click", () => this.executeCommand("update"));
    document
      .getElementById("btn-init")
      .addEventListener("click", () => this.executeCommand("init"));
    document
      .getElementById("btn-add")
      .addEventListener("click", () => this.showAddRepoModal());

    // 配置编辑
    document
      .getElementById("btn-save-config")
      .addEventListener("click", () => this.saveConfig());
    document
      .getElementById("btn-reset-config")
      .addEventListener("click", () => this.loadConfig());

    // 仓库管理
    document
      .getElementById("btn-add-repo")
      .addEventListener("click", () => this.showAddRepoModal());
    document
      .getElementById("btn-refresh-report")
      .addEventListener("click", () => this.loadReport());

    // 补充信息弹窗
    const btnOpenSupplement = document.getElementById("btn-open-supplement");
    if (btnOpenSupplement) {
      btnOpenSupplement.addEventListener("click", () =>
        this.openSupplementModal(),
      );
    }

    // 备注功能
    const btnSaveRemark = document.getElementById("btn-save-remark");
    if (btnSaveRemark) {
      btnSaveRemark.addEventListener("click", () => this.saveRemark());
    }
    const btnClearRemark = document.getElementById("btn-clear-remark");
    if (btnClearRemark) {
      btnClearRemark.addEventListener("click", () => this.clearRemark());
    }
    const remarkDateInput = document.getElementById("remark-date-input");
    if (remarkDateInput) {
      remarkDateInput.addEventListener("change", (e) =>
        this.loadRemarkForDate(e.target.value),
      );
    }

    // 定时任务控制
    const btnSchedulerToggle = document.getElementById("btn-scheduler-toggle");
    if (btnSchedulerToggle) {
      btnSchedulerToggle.addEventListener("click", () =>
        this.toggleScheduler(),
      );
    }

    const btnSchedulerExecute = document.getElementById(
      "btn-scheduler-execute",
    );
    if (btnSchedulerExecute) {
      btnSchedulerExecute.addEventListener("click", () =>
        this.executeSchedulerNow(),
      );
    }

    const btnSchedulerClearLogs = document.getElementById(
      "btn-scheduler-clear-logs",
    );
    if (btnSchedulerClearLogs) {
      btnSchedulerClearLogs.addEventListener("click", () =>
        this.clearSchedulerLogs(),
      );
    }

    const btnSchedulerRefreshLogs = document.getElementById(
      "btn-scheduler-refresh-logs",
    );
    if (btnSchedulerRefreshLogs) {
      btnSchedulerRefreshLogs.addEventListener("click", () =>
        this.updateSchedulerLogs(),
      );
    }

    // 模态框
    this.setupModalListeners();

    // 快捷键
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeAllModals();
      }
    });
  }

  /**
   * 设置模态框监听器
   */
  setupModalListeners() {
    const modal = document.getElementById("modal-add-repo");
    const closeBtn = modal.querySelector(".modal-close");
    const cancelBtn = document.getElementById("modal-close-btn");
    const addBtn = document.getElementById("modal-add-btn");

    closeBtn.addEventListener("click", () => this.closeModal(modal));
    cancelBtn.addEventListener("click", () => this.closeModal(modal));
    addBtn.addEventListener("click", () => this.addRepository());

    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        this.closeModal(modal);
      }
    });

    // 补充信息弹窗
    const supplementModal = document.getElementById("supplement-modal");
    const supplementCloseBtn = document.getElementById(
      "supplement-modal-close",
    );
    const supplementCloseBtnFooter = document.getElementById(
      "btn-close-supplement",
    );

    if (supplementModal && supplementCloseBtn) {
      supplementCloseBtn.addEventListener("click", () =>
        this.closeModal(supplementModal),
      );
    }

    if (supplementModal && supplementCloseBtnFooter) {
      supplementCloseBtnFooter.addEventListener("click", () =>
        this.closeModal(supplementModal),
      );
    }

    if (supplementModal) {
      supplementModal.addEventListener("click", (e) => {
        if (e.target === supplementModal) {
          this.closeModal(supplementModal);
        }
      });
    }
  }

  /**
   * 打开补充信息弹窗
   */
  openSupplementModal() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(now.getDate()).padStart(2, "0")}`;
    this.openSupplementModalForDate(today);
  }

  openSupplementModalForDate(date) {
    const modal = document.getElementById("supplement-modal");
    if (modal) {
      modal.classList.add("show");
      const remarkDateInput = document.getElementById("remark-date-input");
      if (remarkDateInput) {
        remarkDateInput.value = date;
        this.loadRemarkForDate(date);
      }
    }
  }

  /**
   * 加载配置文件
   */
  async loadConfig() {
    try {
      // 从服务器加载配置文件
      const response = await fetch("/config/config.json");
      if (response.ok) {
        this.config = await response.json();
        this.addLog("配置已加载", "success");
      } else {
        this.addLog("加载配置失败: " + response.status, "error");
        this.config = this.getDefaultConfig();
      }
    } catch (error) {
      this.addLog("加载配置失败: " + error.message, "error");
      this.config = this.getDefaultConfig();
    }
    this.updateConfigForm();
    this.updateRepositoriesView();
    this.updateDashboard();
    this.loadSchedulerStatus(); // 同时加载定时任务状态
    this.loadReport(); // 初始化日报查看页面
  }

  /**
   * 获取默认配置
   */
  getDefaultConfig() {
    return {
      author_email: "user@example.com",
      output_dir: "C:\Users\Administrator\Desktop\daily-report\data",
      scheduler: {
        enabled: true,
        interval: 0.5,
      },
      repositories: [],
    };
  }

  /**
   * 更新仪表盘信息
   */
  updateDashboard() {
    if (!this.config) return;

    document.getElementById("repo-count").textContent =
      this.config.repositories.length || "0";
    document.getElementById("author-email").textContent =
      this.config.author_email || "-";
    document.getElementById("output-dir").textContent =
      this.config.output_dir || "-";

    // 获取最后更新时间（通过获取当前月份日报文件）
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const currentMonthFile = `reports_${currentMonthKey}.json`;

    fetch(`/data/${currentMonthFile}`, { method: "HEAD" })
      .then((response) => {
        if (response.ok) {
          const lastModified = response.headers.get("date");
          if (lastModified) {
            const date = new Date(lastModified);
            const updateTime = date.toLocaleString("zh-CN");
            document.getElementById("last-update").textContent = updateTime;
          } else {
            document.getElementById("last-update").textContent = "无法读取时间";
          }
        } else {
          document.getElementById("last-update").textContent = "报告未生成";
        }
      })
      .catch((error) => {
        document.getElementById("last-update").textContent = "无法读取";
      });
  }

  /**
   * 更新配置表单
   */
  updateConfigForm() {
    if (!this.config) return;

    document.getElementById("input-author-email").value =
      this.config.author_email;
    document.getElementById("input-output-dir").value = this.config.output_dir;
    document.getElementById("input-repositories").value = JSON.stringify(
      this.config.repositories,
      null,
      2,
    );

    // 加载定时任务配置
    const scheduler = this.config.scheduler || { enabled: true, interval: 0.5 };
    document.getElementById("input-scheduler-enabled").checked =
      scheduler.enabled;
    document.getElementById("input-scheduler-interval").value =
      scheduler.interval || 0.5;

    document.getElementById("config-raw").value = JSON.stringify(
      this.config,
      null,
      2,
    );
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      // 收集所有配置字段
      this.config.author_email = document
        .getElementById("input-author-email")
        .value.trim();
      this.config.output_dir = document
        .getElementById("input-output-dir")
        .value.trim();

      // 解析仓库配置
      try {
        const reposJson = document
          .getElementById("input-repositories")
          .value.trim();
        if (reposJson) {
          this.config.repositories = JSON.parse(reposJson);
        } else {
          this.config.repositories = [];
        }
      } catch (e) {
        this.showNotification("❌ 仓库 JSON 格式错误: " + e.message, "error");
        return;
      }

      // 保存定时任务配置
      const intervalInput = document.getElementById(
        "input-scheduler-interval",
      ).value;
      const interval = parseFloat(intervalInput);

      if (isNaN(interval) || interval <= 0) {
        this.showNotification("❌ 执行间隔必须是正数", "error");
        return;
      }

      if (interval < 0.1) {
        this.showNotification("❌ 执行间隔最小值为 0.1 小时（6分钟）", "error");
        return;
      }

      this.config.scheduler = {
        enabled: document.getElementById("input-scheduler-enabled").checked,
        interval: interval,
      };

      // 验证配置 - 必填字段
      if (!this.config.author_email) {
        this.showNotification("❌ 作者邮箱不能为空", "error");
        return;
      }

      if (!this.config.output_dir) {
        this.showNotification("❌ 输出目录不能为空", "error");
        return;
      }

      console.log("📝 准备保存配置:", this.config);

      // 发送到后端保存
      const response = await fetch("/api/save-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.config),
      });

      const result = await response.json();

      if (result.success) {
        console.log("✅ 配置已保存到服务器");

        // 更新config-raw显示
        document.getElementById("config-raw").value = JSON.stringify(
          this.config,
          null,
          2,
        );

        this.showNotification("✅ 配置已保存成功", "success");

        // 重新加载定时任务状态
        this.loadSchedulerStatus();

        // 延迟后刷新页面，让用户看到成功提示
        setTimeout(() => {
          location.reload();
        }, 1500);
      } else {
        this.showNotification(
          "❌ 保存失败: " + (result.error || "未知错误"),
          "error",
        );
        console.error("保存失败:", result);
      }
    } catch (error) {
      this.showNotification("❌ 保存配置失败: " + error.message, "error");
      console.error("保存配置异常:", error);
    }
  }

  /**
   * 更新仓库列表视图
   */
  updateRepositoriesView() {
    const container = document.getElementById("repositories-list");
    container.innerHTML = "";

    if (!this.config || this.config.repositories.length === 0) {
      container.innerHTML =
        '<p class="text-muted" style="padding: 20px; text-align: center;">暂无仓库配置</p>';
      return;
    }

    this.config.repositories.forEach((repo, index) => {
      const item = document.createElement("div");
      item.className = "repository-item";
      item.innerHTML = `
                <div class="repository-info">
                    <h4>${repo.name}</h4>
                    <p>📂 路径: <code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px;">${repo.path}</code></p>
                    <p>🌿 分支: <code style="background: rgba(0,0,0,0.05); padding: 2px 4px; border-radius: 3px;">${repo.branch}</code></p>
                </div>
                <div class="repository-actions">
                    <button class="btn btn-sm btn-secondary" onclick="app.editRepository(${index})">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteRepository(${index})">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            `;
      container.appendChild(item);
    });
  }

  /**
   * 显示添加仓库模态框
   */
  showAddRepoModal() {
    document.getElementById("modal-repo-path").value = "";
    document.getElementById("modal-repo-name").value = "";
    document.getElementById("modal-repo-branch").value = "";
    this.editingRepoIndex = null; // 清除编辑模式
    this.openModal("modal-add-repo");
  }

  /**
   * 添加或编辑仓库
   */
  async addRepository() {
    const path = document.getElementById("modal-repo-path").value.trim();
    const name = document.getElementById("modal-repo-name").value.trim();
    const branch = document.getElementById("modal-repo-branch").value.trim();

    if (!path || !name || !branch) {
      this.showNotification("所有字段都是必填的", "error");
      return;
    }

    if (!this.config.repositories) {
      this.config.repositories = [];
    }

    // 判断是编辑还是添加
    if (this.editingRepoIndex !== null && this.editingRepoIndex !== undefined) {
      // 编辑模式
      this.config.repositories[this.editingRepoIndex] = { path, name, branch };
    } else {
      // 添加模式
      this.config.repositories.push({ path, name, branch });
    }

    // 保存到服务器
    try {
      const response = await fetch("/api/save-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(this.config),
      });

      const result = await response.json();

      if (result.success) {
        this.updateRepositoriesView();
        this.updateConfigForm();
        this.updateDashboard();
        this.closeModal(document.getElementById("modal-add-repo"));
        const message =
          this.editingRepoIndex !== null
            ? "仓库已更新并保存"
            : "仓库已添加并保存";
        this.showNotification(message, "success");
        this.editingRepoIndex = null; // 清除编辑模式
      } else {
        // 如果保存失败，回滚改动
        if (this.editingRepoIndex === null) {
          this.config.repositories.pop();
        }
        this.showNotification("操作失败: " + result.error, "error");
      }
    } catch (error) {
      // 如果网络错误，回滚改动
      if (this.editingRepoIndex === null) {
        this.config.repositories.pop();
      }
      this.showNotification("操作失败: " + error.message, "error");
    }
  }

  /**
   * 删除仓库
   */
  deleteRepository(index) {
    this.showConfirm(
      "删除仓库",
      `确定要删除仓库 "${this.config.repositories[index].name}" 吗?`,
      async () => {
        try {
          this.config.repositories.splice(index, 1);

          // 保存到服务器
          const response = await fetch("/api/save-config", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(this.config),
          });

          const result = await response.json();

          if (result.success) {
            this.updateRepositoriesView();
            this.updateConfigForm();
            this.updateDashboard();
            this.showNotification("仓库已删除并保存", "success");
          } else {
            // 如果保存失败，可考虑恢复（这里简化，不恢复）
            this.showNotification("仓库删除失败: " + result.error, "error");
          }
        } catch (error) {
          this.showNotification("仓库删除失败: " + error.message, "error");
        }
      },
    );
  }

  /**
   * 编辑仓库
   */
  editRepository(index) {
    const repo = this.config.repositories[index];
    document.getElementById("modal-repo-path").value = repo.path;
    document.getElementById("modal-repo-name").value = repo.name;
    document.getElementById("modal-repo-branch").value = repo.branch;
    this.editingRepoIndex = index; // 标记编辑模式
    this.openModal("modal-add-repo");
  }

  /**
   * 初始化日报文件选择器
   */
  async initReportSelector() {
    try {
      const response = await fetch("/api/list-reports");
      const result = await response.json();

      if (result.success && result.reports.length > 0) {
        const selector = document.getElementById("report-file-selector");
        selector.innerHTML = "";

        result.reports.forEach((fileName) => {
          const option = document.createElement("option");
          option.value = fileName;
          option.textContent = fileName;
          selector.appendChild(option);
        });

        // 设置事件监听器
        if (!selector.hasListener) {
          selector.addEventListener("change", (e) => {
            this.loadReportByFile(e.target.value);
          });
          selector.hasListener = true;
        }

        // 加载当月日报（默认为 reports_YYYYMM.json）
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const currentMonthFile = `reports_${currentMonthKey}.json`;

        if (result.reports.includes(currentMonthFile)) {
          selector.value = currentMonthFile;
        } else if (result.reports.length > 0) {
          selector.value = result.reports[0];
        }

        this.loadReportByFile(selector.value);
      } else {
        document.getElementById("report-content").innerHTML =
          '<p class="text-muted">暂无日报文件。请先执行生成命令。</p>';
      }
    } catch (error) {
      document.getElementById("report-content").innerHTML =
        `<p class="text-muted">加载日报列表失败: ${error.message}</p>`;
    }
  }

  /**
   * 加载指定的日报文件
   */
  async loadReportByFile(fileName) {
    if (!fileName) {
      document.getElementById("report-content").innerHTML =
        '<p class="text-muted">请选择日报文件。</p>';
      return;
    }

    // 补充按钮仅在查看当前月份日报时显示
    const btnOpenSupplement = document.getElementById("btn-open-supplement");
    if (btnOpenSupplement) {
      // 检查是否是当前月份的日报文件（格式为 reports_YYYYMM.json）
      const isCurrentMonthReport = /^reports_\d{6}\.json$/.test(fileName);
      if (isCurrentMonthReport) {
        btnOpenSupplement.style.display = "";
      } else {
        btnOpenSupplement.style.display = "none";
      }
    }

    try {
      const response = await fetch(
        `/api/get-report?file=${encodeURIComponent(fileName)}`,
      );
      const result = await response.json();

      if (result.success) {
        const viewer = document.getElementById("report-content");
        this.currentReportData = this.prepareReportForDisplay(
          result.report,
          fileName,
        );
        viewer.innerHTML = this.renderReportHtml(this.currentReportData);
      } else {
        document.getElementById("report-content").innerHTML =
          `<p class="text-muted">加载日报失败: ${result.error}</p>`;
      }
    } catch (error) {
      document.getElementById("report-content").innerHTML =
        `<p class="text-muted">加载日报失败: ${error.message}</p>`;
    }
  }

  /**
   * 加载日报内容（兼容旧代码，现在指向初始化选择器）
   */
  async loadReport() {
    this.initReportSelector();
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  getTodayString() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  isCurrentMonthReportFile(fileName) {
    return (
      fileName ===
      `reports_${this.getTodayString().slice(0, 7).replace("-", "")}.json`
    );
  }

  prepareReportForDisplay(report, fileName) {
    const safeReport =
      report && typeof report === "object"
        ? JSON.parse(JSON.stringify(report))
        : { dates: [] };

    safeReport.dates = Array.isArray(safeReport.dates) ? safeReport.dates : [];

    if (this.isCurrentMonthReportFile(fileName)) {
      const today = this.getTodayString();
      const hasToday = safeReport.dates.some(
        (dateEntry) => dateEntry.date === today,
      );

      if (!hasToday) {
        safeReport.dates.push({
          date: today,
          remark: "",
          repositories: [],
        });
      }
    }

    safeReport.dates.sort((a, b) => b.date.localeCompare(a.date));
    return safeReport;
  }

  renderReportHtml(report) {
    if (!report || !Array.isArray(report.dates) || report.dates.length === 0) {
      return '<p class="text-muted">暂无日报内容。请先执行生成命令。</p>';
    }

    const dateSections = report.dates
      .map((dateEntry) => {
        const repoSections = (dateEntry.repositories || [])
          .map((repoEntry) => {
            const itemsHtml = (repoEntry.items || [])
              .map((item) => {
                const prefix =
                  item.taskId && item.taskId !== "other"
                    ? `${this.escapeHtml(item.type)}: ${this.escapeHtml(item.taskId)} `
                    : `${this.escapeHtml(item.type)}: `;
                const content = (item.messages || [])
                  .map((message) => this.escapeHtml(message))
                  .join("; ");
                return `<div style="margin: 8px 0; line-height: 1.7;"><span style="font-weight: 600; color: #222;">${prefix}</span><span>${content}</span></div>`;
              })
              .join("");

            return `
              <section style="margin-top: 16px; padding: 14px 16px; background: #fafafa; border: 1px solid #ececec; border-radius: 8px;">
                <div style="font-weight: 700; color: #1f1f1f; margin-bottom: 10px;">${this.escapeHtml(repoEntry.name)} (${this.escapeHtml(repoEntry.branch)})</div>
                ${itemsHtml || '<div class="text-muted">暂无条目</div>'}
              </section>
            `;
          })
          .join("");

        const remarkHtml = dateEntry.remark
          ? `<div style="margin-top: 14px; padding: 12px 14px; background: #fff7e6; border: 1px solid #ffe7ba; border-radius: 8px;"><span style="font-weight: 600; color: #ad6800;">others:</span> ${this.escapeHtml(dateEntry.remark)}</div>`
          : "";
        const emptyStateHtml =
          repoSections || remarkHtml
            ? ""
            : '<div class="text-muted" style="margin-top: 14px; padding: 12px 14px; background: #fafafa; border: 1px dashed #d9d9d9; border-radius: 8px;">当天暂无 Git 日报内容，可通过补充按钮手动填写。</div>';

        return `
          <section style="margin-bottom: 24px;">
            <div style="border-bottom: 1px solid #eee; position: relative; margin: 24px 0 8px 0; padding: 3px 0 8px 0; font-size: 18px; display: flex; font-weight: bold; align-items: center; width: 100%;">
              ${this.escapeHtml(dateEntry.date)}
              <div style="position: absolute; right: 0; top: 50%; transform: translateY(-50%); display: flex; gap: 12px; align-items: center; white-space: nowrap;">
                <button onclick="app.copyDailyReport('${this.escapeHtml(dateEntry.date)}')" title="复制此日期的日报内容" style="background: none; border: none; color: #0066cc; cursor: pointer; text-decoration: underline; font-size: 14px; padding: 0;">
                  复制
                </button>
                <button onclick="app.openSupplementModalForDate('${this.escapeHtml(dateEntry.date)}')" title="补充此日期的日报内容" style="background: none; border: none; color: #d46b08; cursor: pointer; text-decoration: underline; font-size: 14px; padding: 0;">
                  补充
                </button>
              </div>
            </div>
            ${repoSections}
            ${remarkHtml}
            ${emptyStateHtml}
          </section>
        `;
      })
      .join("");

    return dateSections;
  }

  buildDailyReportText(dateEntry) {
    const lines = [];

    (dateEntry.repositories || []).forEach((repoEntry) => {
      lines.push(`${repoEntry.name} (${repoEntry.branch})`);

      (repoEntry.items || []).forEach((item) => {
        const prefix =
          item.taskId && item.taskId !== "other"
            ? `${item.type}: ${item.taskId} `
            : `${item.type}: `;
        lines.push(`${prefix}${(item.messages || []).join("; ")}`.trim());
      });
    });

    if (dateEntry.remark) {
      lines.push(`others: ${dateEntry.remark}`);
    }

    return lines.filter(Boolean).join("\n").trim();
  }

  /**
   * 复制指定日期的日报内容到剪贴板
   * @param {string} date - 日期，格式为 YYYY-MM-DD
   */
  async copyDailyReport(date) {
    if (
      !this.currentReportData ||
      !Array.isArray(this.currentReportData.dates)
    ) {
      alert("日报内容未加载");
      return;
    }

    const dateEntry = this.currentReportData.dates.find(
      (currentDate) => currentDate.date === date,
    );

    if (!dateEntry) {
      alert(`未找到日期 ${date} 的日报内容`);
      return;
    }

    let reportText = this.buildDailyReportText(dateEntry);

    if (!reportText) {
      this.showNotification("当天暂无可复制内容", "error");
      return;
    }

    if (reportText && !reportText.endsWith("。")) {
      reportText += "。";
    }

    try {
      // 使用 Clipboard API 复制到剪贴板
      await navigator.clipboard.writeText(reportText);
      // 显示复制成功的提示
      this.showCopySuccess(date);
    } catch (err) {
      console.error("复制失败:", err);
      alert(`复制失败: ${err.message}`);
    }
  }

  /**
   * 显示复制成功提示
   */
  showCopySuccess(date) {
    // 创建临时提示元素
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background-color: #52c41a;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 9999;
      font-size: 14px;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = `✓ ${date} 的日报内容已复制到剪贴板`;
    document.body.appendChild(toast);

    // 2秒后移除
    setTimeout(() => {
      toast.style.animation = "slideOut 0.3s ease-out";
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 2000);
  }

  /**
   * 执行命令
   */
  async executeCommand(command) {
    this.currentCommand = command;
    this.switchView("dashboard");
    this.clearLog();

    // update 命令不需要确认，直接执行
    if (command === "update") {
      this.performCommand(command);
      return;
    }

    let title = "";
    let message = "";
    let confirmText = "执行";

    switch (command) {
      case "init":
        title = "初始化历史";
        message = "这将从 Git 历史生成完整日报，会覆盖现有报告。确定继续?";
        confirmText = "继续 (谨慎)";
        break;
      case "add":
        title = "添加新仓库";
        message = "这将打开交互式向导添加新的仓库。确定继续?";
        break;
    }

    this.showConfirm(
      title,
      message,
      () => {
        this.performCommand(command);
      },
      confirmText,
    );
  }

  /**
   * 执行实际命令
   */
  async performCommand(command) {
    try {
      this.addLog(`正在执行 ${command}.js...`, "info");

      // 调用后端 API 执行脚本
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: command }),
      });

      const result = await response.json();

      if (result.success) {
        // 解析输出日志
        const lines = result.output.split("\n").filter((line) => line.trim());
        lines.forEach((line) => {
          if (line.includes("✓") || line.includes("✅")) {
            this.addLog(line, "success");
          } else if (line.includes("⚠️") || line.includes("❌")) {
            this.addLog(line, "error");
          } else if (line.includes("📅") || line.includes("正在")) {
            this.addLog(line, "info");
          } else {
            this.addLog(line, "info");
          }
        });

        this.addLog("✓ 命令执行成功", "success");
        this.updateDashboard();
        this.loadReport();
        this.showNotification("命令执行成功", "success");
      } else {
        this.addLog(`✗ 执行失败: ${result.error}`, "error");
        if (result.output) {
          this.addLog(result.output, "error");
        }
        this.showNotification("命令执行失败: " + result.error, "error");
      }
    } catch (error) {
      this.addLog(`✗ 执行异常: ${error.message}`, "error");
      this.showNotification("命令执行异常: " + error.message, "error");
    }
  }

  /**
   * 切换视图
   */
  switchView(viewName) {
    // 隐藏所有视图
    document.querySelectorAll(".view-panel").forEach((panel) => {
      panel.classList.remove("active");
    });

    // 更新导航状态
    document.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.remove("active");
    });

    // 显示选中的视图
    const targetPanel = document.getElementById(viewName);
    if (targetPanel) {
      targetPanel.classList.add("active");
    }

    // 更新导航高亮
    document
      .querySelector(`[data-view="${viewName}"]`)
      ?.classList.add("active");

    // 执行特定视图的加载逻辑
    if (viewName === "reports") {
      this.loadReport();
    } else if (viewName === "repositories") {
      this.updateRepositoriesView();
    } else if (viewName === "statistics") {
      // 初始化统计视图
      if (window.statsView) {
        window.statsView.init();
      }
    }
  }

  /**
   * 打开模态框
   */
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("show");
      modal.style.display = "flex";
    }
  }

  /**
   * 关闭模态框
   */
  closeModal(modal) {
    modal.classList.remove("show");
    // 移除内联样式，由CSS的.modal和.modal.show来控制display
    modal.style.display = "";
  }

  /**
   * 关闭所有模态框
   */
  closeAllModals() {
    document.querySelectorAll(".modal").forEach((modal) => {
      this.closeModal(modal);
    });
  }

  /**
   * 显示确认对话框
   */
  showConfirm(title, message, onConfirm, confirmText = "确认") {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    document.getElementById("confirm-ok").textContent = confirmText;

    const dialog = document.getElementById("confirm-dialog");
    dialog.style.display = "flex";

    const cleanUp = () => {
      dialog.style.display = "none";
      document
        .getElementById("confirm-ok")
        .removeEventListener("click", onConfirmClick);
      document
        .getElementById("confirm-cancel")
        .removeEventListener("click", onCancelClick);
    };

    const onConfirmClick = () => {
      onConfirm();
      cleanUp();
    };

    const onCancelClick = () => {
      cleanUp();
    };

    document
      .getElementById("confirm-ok")
      .addEventListener("click", onConfirmClick);
    document
      .getElementById("confirm-cancel")
      .addEventListener("click", onCancelClick);

    // 按 ESC 键关闭
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        onCancelClick();
        document.removeEventListener("keydown", handleEsc);
      }
    };
    document.addEventListener("keydown", handleEsc);
  }

  /**
   * 添加日志
   */
  addLog(message, type = "info") {
    const logContainer = document.getElementById("execution-log");
    const logEntry = document.createElement("p");
    logEntry.className = `log-text log-${type}`;
    logEntry.textContent = message;
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * 清除日志
   */
  clearLog() {
    document.getElementById("execution-log").innerHTML = "";
  }

  /**
   * 显示通知
   */
  showNotification(message, type = "info") {
    // 可以使用更高级的通知库，这里简单实现
    const notification = document.createElement("div");
    notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === "success" ? "#28a745" : type === "error" ? "#dc3545" : "#0066cc"};
            color: white;
            border-radius: 6px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 9999;
            animation: slideIn 0.3s ease;
            font-size: 14px;
        `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = "slideOut 0.3s ease";
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  /**
   * 启动定时任务状态更新
   */
  startSchedulerStatusUpdate() {
    // DOM初始化后立即加载状态（与server.js默认启动逻辑同步）
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        this.loadSchedulerStatus();
        this.updateSchedulerLogs();
      });
    } else {
      this.loadSchedulerStatus();
      this.updateSchedulerLogs();
    }
  }

  /**
   * 加载定时任务状态
   */
  async loadSchedulerStatus() {
    // 检查scheduler面板是否存在
    const statusDiv = document.getElementById("scheduler-status");
    if (!statusDiv) return;

    try {
      const response = await fetch("/api/scheduler/status");
      if (!response.ok) {
        console.error(`API错误: ${response.status}`);
        return;
      }
      const result = await response.json();

      if (result.success) {
        const status = result.status;
        const btnToggle = document.getElementById("btn-scheduler-toggle");
        const statusDiv = document.getElementById("scheduler-status");

        if (btnToggle) {
          if (status.isRunning) {
            btnToggle.textContent = "⏹️ 停止定时任务";
            btnToggle.className = "btn btn-danger";
          } else {
            btnToggle.textContent = "▶️ 启动定时任务";
            btnToggle.className = "btn btn-primary";
          }
        }

        if (statusDiv) {
          const statusHtml = `
            <div class="status-item">
              <span>状态:</span>
              <strong>${status.isRunning ? "✅ 运行中" : "⏹️ 已停止"}</strong>
            </div>
            <div class="status-item">
              <span>间隔:</span>
              <strong>${status.interval} 分钟</strong>
            </div>
            <div class="status-item">
              <span>下次执行:</span>
              <strong>${status.nextExecutionTime}</strong>
            </div>
          `;
          statusDiv.innerHTML = statusHtml;
        }
      }
    } catch (error) {
      console.error("加载定时任务状态失败:", error);
    }
  }

  /**
   * 切换定时任务开启/关闭
   */
  async toggleScheduler() {
    try {
      const response = await fetch("/api/scheduler/status");
      if (!response.ok) {
        this.showNotification("获取状态失败", "error");
        return;
      }
      const result = await response.json();

      if (result.success) {
        const isRunning = result.status.isRunning;
        const url = isRunning ? "/api/scheduler/stop" : "/api/scheduler/start";

        const response2 = await fetch(url, { method: "POST" });
        if (!response2.ok) {
          this.showNotification("操作失败", "error");
          return;
        }
        const result2 = await response2.json();

        if (result2.success) {
          this.showNotification(result2.message, "success");
          this.loadSchedulerStatus();
        } else {
          this.showNotification(result2.message, "error");
        }
      }
    } catch (error) {
      this.showNotification("操作失败: " + error.message, "error");
    }
  }

  /**
   * 立即执行定时任务
   */
  async executeSchedulerNow() {
    try {
      const response = await fetch("/api/scheduler/execute", {
        method: "POST",
      });
      if (!response.ok) {
        this.showNotification("执行失败", "error");
        return;
      }
      const result = await response.json();

      if (result.success && result.result.success) {
        const msg = `执行完成 (耗时: ${result.result.duration}ms)`;
        this.showNotification(msg, "success");
      } else {
        const msg = result.result?.error || "执行失败";
        this.showNotification(msg, "error");
      }

      // 刷新状态和日志
      this.loadSchedulerStatus();
      this.updateSchedulerLogs();
      this.updateDashboard();
      this.loadReport();
    } catch (error) {
      this.showNotification("执行失败: " + error.message, "error");
    }
  }

  /**
   * 更新定时任务日志
   */
  async updateSchedulerLogs() {
    // 检查logs容器是否存在
    const logsDiv = document.getElementById("scheduler-logs");
    if (!logsDiv) return;

    try {
      const response = await fetch("/api/scheduler/logs?lines=50");
      if (!response.ok) {
        console.error(`日志API错误: ${response.status}`);
        return;
      }
      const result = await response.json();

      if (result.success) {
        // 获取日志内容
        const logs = result.logs || "暂无日志";

        // 按行分割，然后倒序排列（最新的在上面）
        const logLines = logs.split("\n").filter((line) => line.trim());
        const reversedLogs = logLines.reverse().join("\n");

        logsDiv.textContent = reversedLogs;
        // 自动滚动到顶部
        logsDiv.scrollTop = 0;
      }
    } catch (error) {
      console.error("加载日志失败:", error);
    }
  }

  /**
   * 清空定时任务日志
   */
  async clearSchedulerLogs() {
    this.showConfirm("清空日志", "确定要清空定时任务日志吗?", async () => {
      try {
        const response = await fetch("/api/scheduler/clear-logs", {
          method: "POST",
        });
        if (!response.ok) {
          this.showNotification("清空失败", "error");
          return;
        }
        const result = await response.json();

        if (result.success) {
          this.showNotification("日志已清空", "success");
          this.updateSchedulerLogs();
        } else {
          this.showNotification("清空失败: " + result.message, "error");
        }
      } catch (error) {
        this.showNotification("清空失败: " + error.message, "error");
      }
    });
  }

  /**
   * 加载指定日期的备注
   */
  async loadRemarkForDate(date) {
    if (!date) return;
    try {
      const response = await fetch(
        `/api/get-remark?date=${encodeURIComponent(date)}`,
      );
      const result = await response.json();
      if (result.success) {
        document.getElementById("remark-input").value = result.remark || "";
      }
    } catch (error) {
      console.error("加载备注失败:", error);
    }
  }

  /**
   * 保存补充信息
   */
  async saveRemark() {
    const date = document.getElementById("remark-date-input").value;
    const remark = document.getElementById("remark-input").value;

    if (!date) {
      this.showNotification("请选择日期", "error");
      return;
    }

    try {
      const response = await fetch("/api/save-remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, remark }),
      });
      const result = await response.json();
      if (result.success) {
        this.showNotification(result.message, "success");
        this.loadReportByFile(
          document.getElementById("report-file-selector").value,
        );
      } else {
        this.showNotification(result.error || "保存失败", "error");
      }
    } catch (error) {
      this.showNotification("保存失败: " + error.message, "error");
    }
  }

  /**
   * 清除备注
   */
  async clearRemark() {
    const date = document.getElementById("remark-date-input").value;
    if (!date) {
      this.showNotification("请选择日期", "error");
      return;
    }

    this.showConfirm(
      `清除 ${date} 的补充`,
      "确定要清除补充信息吗?",
      async () => {
        try {
          const response = await fetch("/api/save-remark", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date, remark: "" }),
          });
          const result = await response.json();
          if (result.success) {
            document.getElementById("remark-input").value = "";
            this.showNotification("补充已清除", "success");
            this.loadReportByFile(
              document.getElementById("report-file-selector").value,
            );
          } else {
            this.showNotification(result.error || "清除失败", "error");
          }
        } catch (error) {
          this.showNotification("清除失败: " + error.message, "error");
        }
      },
    );
  }
}

// 添加动画样式
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// 初始化应用
let app;
document.addEventListener("DOMContentLoaded", () => {
  app = new DailyReportApp();
});
