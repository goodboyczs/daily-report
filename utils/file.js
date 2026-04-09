/**
 * 文件操作工具库
 */

const fs = require("fs");
const path = require("path");

class FileUtil {
  /**
   * 读取 JSON 文件
   */
  static readJson(filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`读取 JSON 文件失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 写入 JSON 文件
   */
  static writeJson(filePath, data, pretty = true) {
    try {
      const content = pretty
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data);
      this.ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, content, "utf8");
      return true;
    } catch (error) {
      throw new Error(`写入 JSON 文件失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 读取文本文件
   */
  static readText(filePath) {
    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      throw new Error(`读取文本文件失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 写入文本文件
   */
  static writeText(filePath, content) {
    try {
      this.ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, content, "utf8");
      return true;
    } catch (error) {
      throw new Error(`写入文本文件失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 追加文本到文件
   */
  static appendText(filePath, content) {
    try {
      this.ensureDir(path.dirname(filePath));
      fs.appendFileSync(filePath, content, "utf8");
      return true;
    } catch (error) {
      throw new Error(`追加文本失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 确保目录存在
   */
  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * 检查文件是否存在
   */
  static exists(filePath) {
    return fs.existsSync(filePath);
  }

  /**
   * 删除文件
   */
  static delete(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (error) {
      throw new Error(`删除文件失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 获取文件大小（字节）
   */
  static getSize(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.size;
    } catch (error) {
      throw new Error(`获取文件大小失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 获取文件修改时间
   */
  static getModifyTime(filePath) {
    try {
      const stats = fs.statSync(filePath);
      return stats.mtime;
    } catch (error) {
      throw new Error(`获取文件修改时间失败 (${filePath}): ${error.message}`);
    }
  }

  /**
   * 列出目录下的文件
   */
  static listFiles(dirPath, filter = null) {
    try {
      const files = fs.readdirSync(dirPath);
      if (filter) {
        return files.filter((file) => filter(file));
      }
      return files;
    } catch (error) {
      throw new Error(`列出目录文件失败 (${dirPath}): ${error.message}`);
    }
  }

  /**
   * 复制文件
   */
  static copy(src, dest) {
    try {
      this.ensureDir(path.dirname(dest));
      fs.copyFileSync(src, dest);
      return true;
    } catch (error) {
      throw new Error(`复制文件失败 (${src} -> ${dest}): ${error.message}`);
    }
  }

  /**
   * 备份文件
   */
  static backup(filePath) {
    try {
      if (!this.exists(filePath)) {
        return null;
      }
      const backupPath = filePath + ".backup." + Date.now();
      this.copy(filePath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`备份文件失败 (${filePath}): ${error.message}`);
    }
  }
}

module.exports = FileUtil;
