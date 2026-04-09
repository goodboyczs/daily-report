/**
 * 代码统计视图 - 完全版本（三维度统计 + 折线图）
 * 作者：cui-zhsh
 * 日期：2026-04-03
 * 功能：支持按日、按月、按年的统计展示，包含折线图
 */

class StatsViewV2 {
  constructor() {
    this.config = null;
    this.statsData = null;
    this.monthsData = [];
    this.monthsDetailedData = {};
    this.yearsData = {};
    this.currentMonth = null;
    this.currentRepo = "";
    this.chart = null; // 按日图表实例
    this.monthChart = null; // 按月图表实例
    this.yearChart = null; // 按年图表实例
    this.isDataLoaded = false;
  }

  /**
   * 初始化统计视图
   */
  async init() {
    await this.loadConfig();
    this.setupEventListeners();
    await this.loadMonthsList();
    this.selectDefaultMonth();
    await this.loadAllMonthsData();
    this.isDataLoaded = true; // 标记数据已加载
    this.renderDayContent();
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const response = await fetch("/config/config.json");
      if (response.ok) {
        this.config = await response.json();
        this.updateRepositoryFilters();
      }
    } catch (err) {
      console.error("加载配置失败:", err);
    }
  }

  /**
   * 更新仓库筛选下拉菜单
   */
  updateRepositoryFilters() {
    const repos = this.config?.repositories || [];
    let optionsHtml = '<option value="">全部仓库</option>';

    repos.forEach((repo) => {
      const uniqueId = `${repo.name}|${repo.branch}`;
      optionsHtml += `<option value="${uniqueId}">${repo.name} (${repo.branch})</option>`;
    });

    const dayRepoSelect = document.getElementById("day-repo-filter");
    if (dayRepoSelect) {
      dayRepoSelect.innerHTML = optionsHtml;
      dayRepoSelect.addEventListener("change", (e) => {
        this.currentRepo = e.target.value;
        this.renderDayContent();
      });
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    document.querySelectorAll(".stats-tab").forEach((tab) => {
      tab.addEventListener("click", (e) => {
        const tabName = e.currentTarget.dataset.tab;
        this.switchTab(tabName);
      });
    });

    const monthSelect = document.getElementById("day-month-select");
    if (monthSelect) {
      monthSelect.addEventListener("change", (e) => {
        this.currentMonth = e.target.value;
        this.renderDayContent();
      });
    }

    const reloadBtn = document.getElementById("btn-reload-months");
    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        this.renderMonthContent();
      });
    }
  }

  /**
   * 切换标签页
   */
  switchTab(tabName) {
    document.querySelectorAll(".stats-tab").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add("active");

    document.querySelectorAll(".stats-tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(`tab-${tabName}`).classList.add("active");

    // 等待数据加载完成后再渲染
    if (!this.isDataLoaded) {
      console.warn("数据还在加载中，请稍候...");
      return;
    }

    if (tabName === "by-day") {
      this.renderDayContent();
    } else if (tabName === "by-month") {
      this.renderMonthContent();
    } else if (tabName === "by-year") {
      this.renderYearContent();
    }
  }

  /**
   * 加载月份列表
   */
  async loadMonthsList() {
    try {
      const response = await fetch("/api/get-archive-months");
      if (response.ok) {
        const months = await response.json();
        this.monthsData = months;
        console.log("已加载月份列表:", months);

        const select = document.getElementById("day-month-select");
        if (select) {
          let optionsHtml = '<option value="">选择月份...</option>';
          months.forEach((month) => {
            const date = new Date(`${month}-01`);
            const displayMonth = date.toLocaleDateString("zh-CN", {
              year: "numeric",
              month: "long",
            });
            optionsHtml += `<option value="${month}">${displayMonth}</option>`;
          });
          select.innerHTML = optionsHtml;
        }
      }
    } catch (err) {
      console.error("加载月份列表失败:", err);
    }
  }

  /**
   * 选择默认月份
   */
  selectDefaultMonth() {
    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}`;

    if (this.monthsData.includes(currentMonth)) {
      this.currentMonth = currentMonth;
    } else if (this.monthsData.length > 0) {
      this.currentMonth = this.monthsData[this.monthsData.length - 1];
    }

    const select = document.getElementById("day-month-select");
    if (select && this.currentMonth) {
      select.value = this.currentMonth;
    }
  }

  /**
   * 一次性加载所有月份的详细数据
   */
  async loadAllMonthsData() {
    console.log("开始加载所有月份数据...");
    const promises = this.monthsData.map((month) =>
      this.loadMonthDataToCache(month),
    );

    try {
      await Promise.all(promises);
      console.log("所有月份数据加载完成");
      this.aggregateYearsData();
      console.log("年份数据聚合完成");
    } catch (err) {
      console.error("加载所有月份失败:", err);
    }
  }

  /**
   * 加载单个月份数据到缓存
   */
  async loadMonthDataToCache(month) {
    try {
      const response = await fetch(`/api/get-archive-data?month=${month}`);
      if (response.ok) {
        const dayData = await response.json();
        this.monthsDetailedData[month] = dayData;
        console.log(`月份 ${month} 数据已加载: ${dayData.length} 天`);
      } else {
        console.warn(`月份 ${month} 返回状态 ${response.status}`);
      }
    } catch (err) {
      console.warn(`加载月份 ${month} 失败:`, err);
      this.monthsDetailedData[month] = [];
    }
  }

  /**
   * 聚合年份数据
   */
  aggregateYearsData() {
    this.yearsData = {};

    Object.entries(this.monthsDetailedData).forEach(([month, dayData]) => {
      const [year] = month.split("-");

      if (!this.yearsData[year]) {
        this.yearsData[year] = {
          year,
          displayDate: year,
          additions: 0,
          deletions: 0,
          filesChanged: 0,
          monthCount: new Set(),
        };
      }

      let monthAdditions = 0;
      let monthDeletions = 0;
      let monthFilesChanged = 0;

      if (Array.isArray(dayData)) {
        dayData.forEach((day) => {
          day.repositories?.forEach((repo) => {
            monthAdditions += repo.additions || 0;
            monthDeletions += repo.deletions || 0;
            monthFilesChanged += repo.filesChanged || 0;
          });
        });
      }

      this.yearsData[year].additions += monthAdditions;
      this.yearsData[year].deletions += monthDeletions;
      this.yearsData[year].filesChanged += monthFilesChanged;
      this.yearsData[year].monthCount.add(month);
    });
  }

  /**
   * 获取当前月的数据
   */
  getCurrentMonthData() {
    if (!this.currentMonth) return [];
    return this.monthsDetailedData[this.currentMonth] || [];
  }

  /**
   * 渲染按日标签页内容
   */
  renderDayContent() {
    const dayData = this.getCurrentMonthData();

    if (!dayData || dayData.length === 0) {
      document.getElementById("day-table-body").innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">暂无数据</td></tr>';
      this.clearChart();
      return;
    }

    // 按日期倒序排列
    const sortedData = [...dayData].sort((a, b) =>
      b.date.localeCompare(a.date),
    );

    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalFiles = new Set();
    const chartData = {};

    const tableBody = document.getElementById("day-table-body");
    tableBody.innerHTML = "";

    sortedData.forEach((dayItem) => {
      if (!dayItem.repositories) return;

      if (!chartData[dayItem.date]) {
        chartData[dayItem.date] = { additions: 0, deletions: 0 };
      }

      dayItem.repositories.forEach((repo) => {
        totalAdditions += repo.additions || 0;
        totalDeletions += repo.deletions || 0;
        chartData[dayItem.date].additions += repo.additions || 0;
        chartData[dayItem.date].deletions += repo.deletions || 0;

        if (repo.filesChanged) {
          totalFiles.add(`${dayItem.date}-${repo.name}-${repo.branch}`);
        }

        if (
          this.currentRepo &&
          `${repo.name}|${repo.branch}` !== this.currentRepo
        ) {
          return;
        }

        const row = document.createElement("tr");
        const changes = (repo.additions || 0) + (repo.deletions || 0);
        row.innerHTML = `
          <td>${dayItem.date}</td>
          <td>${repo.name}</td>
          <td>${repo.branch}</td>
          <td><span class="badge badge-success">${repo.additions || 0}</span></td>
          <td><span class="badge badge-danger">${repo.deletions || 0}</span></td>
          <td><span class="badge badge-info">${changes}</span></td>
          <td>${repo.filesChanged || 0}</td>
        `;
        tableBody.appendChild(row);
      });
    });

    if (tableBody.innerHTML === "") {
      tableBody.innerHTML =
        '<tr><td colspan="7" class="text-center text-muted">暂无数据</td></tr>';
    }

    document.getElementById("day-total-additions").textContent =
      totalAdditions.toLocaleString();
    document.getElementById("day-total-deletions").textContent =
      totalDeletions.toLocaleString();
    document.getElementById("day-total-files").textContent =
      totalFiles.size.toLocaleString();

    this.renderChart(chartData);
  }

  /**
   * 绘制按日折线图
   */
  renderChart(chartData) {
    const dates = Object.keys(chartData).sort();
    this.chart = this.renderLineChart(
      "stats-chart",
      this.chart,
      dates,
      dates.map((d) => chartData[d].additions),
      dates.map((d) => chartData[d].deletions),
    );
  }

  /**
   * 清除图表
   */
  clearChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * 通用折线图绘制
   */
  renderLineChart(
    canvasId,
    existingInstance,
    labels,
    additionsData,
    deletionsData,
  ) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;

    if (existingInstance) {
      existingInstance.destroy();
    }

    return new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "新增行数",
            data: additionsData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#10b981",
          },
          {
            label: "删除行数",
            data: deletionsData,
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#ef4444",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { usePointStyle: true, padding: 15 },
          },
        },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }

  /**
   * 渲染按月标签页内容
   */
  renderMonthContent() {
    const tableBody = document.getElementById("month-table-body");
    tableBody.innerHTML = "";

    const monthsDetailed = [];

    Object.entries(this.monthsDetailedData).forEach(([month, dayData]) => {
      const monthStats = {
        month,
        displayDate: this.formatMonthDisplay(month),
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        dayCount: 0,
      };

      if (Array.isArray(dayData)) {
        dayData.forEach((day) => {
          day.repositories?.forEach((repo) => {
            monthStats.additions += repo.additions || 0;
            monthStats.deletions += repo.deletions || 0;
            monthStats.filesChanged += repo.filesChanged || 0;
          });
          if (day.repositories && day.repositories.length > 0) {
            monthStats.dayCount++;
          }
        });
      }

      monthsDetailed.push(monthStats);
    });

    monthsDetailed.sort((a, b) => b.month.localeCompare(a.month));

    // 绘制按月折线图（正序）
    const chartMonths = [...monthsDetailed].reverse();
    this.monthChart = this.renderLineChart(
      "month-chart",
      this.monthChart,
      chartMonths.map((m) => m.displayDate),
      chartMonths.map((m) => m.additions),
      chartMonths.map((m) => m.deletions),
    );

    monthsDetailed.forEach((monthData) => {
      const row = document.createElement("tr");
      const changes = monthData.additions + monthData.deletions;
      row.innerHTML = `
        <td>${monthData.displayDate}</td>
        <td><span class="badge badge-success">${monthData.additions.toLocaleString()}</span></td>
        <td><span class="badge badge-danger">${monthData.deletions.toLocaleString()}</span></td>
        <td><span class="badge badge-info">${changes.toLocaleString()}</span></td>
        <td>${monthData.filesChanged.toLocaleString()}</td>
        <td>${monthData.dayCount}</td>
      `;
      tableBody.appendChild(row);
    });

    if (monthsDetailed.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">暂无数据</td></tr>';
    }

    console.log("按月统计已渲染:", monthsDetailed.length, "个月");
  }

  /**
   * 渲染按年标签页内容
   */
  renderYearContent() {
    const tableBody = document.getElementById("year-table-body");
    tableBody.innerHTML = "";

    const years = Object.keys(this.yearsData).sort().reverse();

    // 绘制按年折线图（正序）
    const chartYears = [...years].reverse();
    this.yearChart = this.renderLineChart(
      "year-chart",
      this.yearChart,
      chartYears,
      chartYears.map((y) => this.yearsData[y].additions),
      chartYears.map((y) => this.yearsData[y].deletions),
    );

    years.forEach((year) => {
      const yearData = this.yearsData[year];
      const row = document.createElement("tr");
      const changes = yearData.additions + yearData.deletions;
      const monthCount = yearData.monthCount.size;

      row.innerHTML = `
        <td>${yearData.displayDate}</td>
        <td><span class="badge badge-success">${yearData.additions.toLocaleString()}</span></td>
        <td><span class="badge badge-danger">${yearData.deletions.toLocaleString()}</span></td>
        <td><span class="badge badge-info">${changes.toLocaleString()}</span></td>
        <td>${yearData.filesChanged.toLocaleString()}</td>
        <td>${monthCount}</td>
      `;
      tableBody.appendChild(row);
    });

    if (years.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="6" class="text-center text-muted">暂无数据</td></tr>';
    }

    console.log("按年统计已渲染:", years.length, "个年份");
  }

  /**
   * 格式化月份显示
   */
  formatMonthDisplay(monthStr) {
    const [year, month] = monthStr.split("-");
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
    });
  }
}

// 页面加载时初始化
document.addEventListener("DOMContentLoaded", () => {
  window.statsView = new StatsViewV2();
  window.statsView.init();
});
