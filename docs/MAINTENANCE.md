# 维护指南

## 日常检查

```sh
npm run check      # 语法检查（改动后必跑）
npm test           # 47 个回归测试
npm run pycheck    # Python 实验语法
node scripts/link-check.mjs   # 课程外链可达性（建议每月）
```

## 内容更新

- **课程**：`src/content/courses-*.js`。课程 `id` 是稳定身份——**不要改已有 ID**（进度/笔记/运行记录都按 ID 关联）；改名/调顺序安全。教材章节只写在 `sourceRef` 与 `references`。
- **引用核对**：修改资源后运行 link-check；每条引用带 `verified: { date, env }` 字段，更新时同步日期。
- **评测集**：RAG 标注集在 `src/labs/term.js` 的 `evalSet`。新增题目标注 `unseen: true` 表示未见样例——调试 Prompt/检索时不得使用。
- **实验引擎**：`src/labs/*` 是纯函数模块（浏览器/Node 双端一致），引擎与视图分离，改引擎先跑 `npm test`。

## 后端运维

- 数据目录 `server/data/`（账户/任务/索引/产物），**不在 git 中**；备份=整目录复制。
- 任务执行器：白名单与参数范围在 `server/src/tasks.js`（新增实验脚本必须登记并定义参数规则）；任务串行运行于 `server/data/tasks/<id>/artifacts`，每个任务独立留存，成功产物按账户发布到 `server/data/artifacts/<userId>/` 供后续实验读取；日志按任务落盘 `server/data/tasks/<id>/run.log`。局域网绑定时任务、模型调用、RAG 查询和同步需账户令牌；任务和产物按账户隔离，静态服务只开放前端资源。
- 服务重启：排队任务自动重新入队；运行中任务标记 failed（可重跑），UI 与服务端状态一致。
- 密钥轮换：只改服务器环境变量，前端无感知。
- 模型提供商：`server/src/llm.js` 的 `PROVIDERS`（OpenAI 兼容协议均可接入）。

## 数据迁移

- schema 版本在 `src/core/schema.js`（当前 v3）。新增字段时：
  1. 更新 `fresh()` 与 `normalize`（旧数据缺字段给默认值）；
  2. 在 `tests/core.test.js` 加一条迁移测试；
  3. 递增 `SCHEMA_VERSION` 只在破坏性变更时进行，并写 `fromV<n>` 迁移函数。
- 迁移纪律：旧数据不冒充新能力（v2 打卡→自报的先例）；原始副本进 `legacy`。

## 升级与回滚

- 静态站点无构建：`git pull` 即完成升级；旧 service worker 已退役脚本化，不会缓存旧代码。
- 后端升级：停进程 → `git pull` → `npm run check && npm test` → 启动。回滚 = `git checkout <旧tag>` + 数据目录不动。
- 数据库式数据（server/data）向前兼容：schema 字段只增不改语义。

## 已知限制（如实）

- RAG 内置语料为 6 份校园教学材料；实验室支持粘贴自选资料并用于词项/向量检索和生成。尚无文件上传、索引管理界面；生成结果只核对引用 ID 是否存在于上下文，事实支持仍需人工阅读核验。
- 云端公网部署、真实第二台设备联调、原教材 Notebook 逐个执行：见 `docs/ACCEPTANCE.md` 第 6 节。
- 2D 仿真无动力学；VLA 不承诺普通电脑实时运行。
