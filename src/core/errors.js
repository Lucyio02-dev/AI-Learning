// 统一错误码：导入、存储、任务、模型与同步的失败都映射到这里，
// 前端与后端用同一个代码表，避免把可恢复错误误报成数据损坏。
export const CODES = {
  E_IMPORT_PARSE: "备份不是有效的 JSON 文本",
  E_IMPORT_NOT_OBJECT: "备份内容不是学习数据对象",
  E_IMPORT_VERSION: "备份版本不受支持，未知版本不会按旧版读取",
  E_IMPORT_SCHEMA: "备份字段类型不符合 schema",
  E_IMPORT_EMPTY: "没有找到有效学习数据",
  E_STORAGE_QUOTA: "浏览器存储空间不足，保存未完成",
  E_STORAGE_CORRUPT: "浏览器存储中的数据无法解析",
  E_STORAGE_READONLY: "存储不可写，当前为只读模式",
  E_TASK_UNKNOWN: "任务不存在",
  E_TASK_SCRIPT: "实验脚本不在白名单内",
  E_TASK_TIMEOUT: "实验超时被终止",
  E_TASK_CANCELLED: "实验已取消",
  E_TASK_FAILED: "实验运行失败",
  E_MODEL_NO_BACKEND: "需要本地后端才能调用真实模型",
  E_MODEL_NO_KEY: "服务器未配置模型密钥",
  E_MODEL_HTTP: "模型服务返回错误",
  E_SYNC_CONFLICT: "同步冲突：同一字段在两端都被修改",
  E_SYNC_HTTP: "同步服务不可达",
  E_VALIDATION: "输入未通过校验",
};

export class AppError extends Error {
  constructor(code, detail = "") {
    super(`${CODES[code] || code}${detail ? "：" + detail : ""}`);
    this.code = code;
    this.detail = detail;
  }
}
export const isCode = (error, code) =>
  error instanceof AppError && error.code === code;
