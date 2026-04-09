/**
 * 归档数据统计处理
 * 作者：cui-zhsh
 * 日期：2026-04-03
 * 功能：从已归档的报告文件中提取统计数据，支持按月/按年统计
 */

class ArchiveStatsProcessor {
  constructor() {
    this.monthlyStats = {}; // { "2026-03": { month: "2026-03", ... } }
    this.yearlyStats = {}; // { "2026": { year: "2026", ... } }
    this.config = null;
  }

  /**
   * 初始化数据处理
   */
  async init() {
    await this.loadConfig();
    await this.loadAllArchiveData();
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const response = await fetch("/config/config.json");
      if (response.ok) {
        this.config = await response.json();
      }
    } catch (err) {
      console.error("加载配置失败:", err);
    }
  }

  /**
   * 加载所有归档数据
   */
  async loadAllArchiveData() {
    try {
      const response = await fetch("/api/get-archive-months");
      if (response.ok) {
        const months = await response.json();

        for (const month of months) {
          await this.loadArchiveMonth(month);
        }
        console.log("归档数据已加载");
      }
    } catch (err) {
      console.error("加载归档数据失败:", err);
    }
  }

  /**
   * 加载指定月份的归档数据
   */
  async loadArchiveMonth(monthStr) {
    try {
      const response = await fetch(`/api/get-archive-data?month=${monthStr}`);
      if (response.ok) {
        const data = await response.json();
        this.processMonthData(monthStr, data);
      }
    } catch (err) {
      console.error(`加载月份 ${monthStr} 失败:`, err);
    }
  }

  /**
   * 处理月份数据
   */
  processMonthData(monthStr, dailyData) {
    const [year, month] = monthStr.split("-");

    let monthlyAggr = {
      month: monthStr,
      year: year,
      displayDate: this.formatMonthDisplay(monthStr),
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      daysCount: 0,
      daysList: [],
    };

    if (Array.isArray(dailyData)) {
      dailyData.forEach((day) => {
        const dayStats = this.aggregateDayData(day);
        monthlyAggr.additions += dayStats.additions;
        monthlyAggr.deletions += dayStats.deletions;
        monthlyAggr.filesChanged += dayStats.filesChanged;
        monthlyAggr.daysCount++;
        monthlyAggr.daysList.push(dayStats);
      });
    }

    this.monthlyStats[monthStr] = monthlyAggr;

    // 更新年度数据
    if (!this.yearlyStats[year]) {
      this.yearlyStats[year] = {
        year: year,
        displayDate: year,
        additions: 0,
        deletions: 0,
        filesChanged: 0,
        monthsCount: 0,
        monthsList: [],
      };
    }

    this.yearlyStats[year].additions += monthlyAggr.additions;
    this.yearlyStats[year].deletions += monthlyAggr.deletions;
    this.yearlyStats[year].filesChanged += monthlyAggr.filesChanged;
    this.yearlyStats[year].monthsList.push(monthlyAggr);
    this.yearlyStats[year].monthsCount = new Set(
      this.yearlyStats[year].monthsList.map((m) => m.month),
    ).size;
  }

  /**
   * 聚合单日数据
   */
  aggregateDayData(dayData) {
    let dayStats = {
      date: dayData.date || "",
      additions: 0,
      deletions: 0,
      filesChanged: 0,
      repos: [],
    };

    if (dayData.repositories && Array.isArray(dayData.repositories)) {
      dayData.repositories.forEach((repo) => {
        dayStats.additions += repo.additions || 0;
        dayStats.deletions += repo.deletions || 0;
        dayStats.filesChanged += repo.filesChanged || 0;
        dayStats.repos.push(repo);
      });
    }

    return dayStats;
  }

  /**
   * 获取所有月份列表
   */
  getMonthsList() {
    return Object.keys(this.monthlyStats)
      .sort()
      .map((key) => this.monthlyStats[key]);
  }

  /**
   * 获取所有年份列表
   */
  getYearsList() {
    return Object.keys(this.yearlyStats)
      .sort()
      .map((key) => this.yearlyStats[key]);
  }

  /**
   * 获取指定月份的日数据
   */
  getMonthDays(monthStr) {
    return this.monthlyStats[monthStr]?.daysList || [];
  }

  /**
   * 获取指定月份的数据
   */
  getMonthData(monthStr) {
    return this.monthlyStats[monthStr];
  }

  /**
   * 获取指定年份的数据
   */
  getYearData(year) {
    return this.yearlyStats[year];
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

// 全局暴露
window.ArchiveStatsProcessor = ArchiveStatsProcessor;
