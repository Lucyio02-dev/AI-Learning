# 架构决策记录（ADR）

日期：2026-11-16 · 状态：已实施 · 决策人：接续开发代理（按交接清单执行）

本文件记录完整版开发中"前端、内容管理、数据持久化、模型接入、实验执行与部署之间的边界"的最终决策。每个决策说明它解决的具体问题。

## 1. 总体形态：静态优先 + 本地可选后端

**决策**：保留无构建 ES Modules 前端（GitHub Pages / Netlify / Vercel 可直接托管）；新增 `server/` 目录下的可选 Node 后端。前端启动时探测 `/api/health`，探测成功进入"完整模式"，失败进入"本地模式"（不隐藏功能入口，只把需要后端的能力标注为需要启动后端）。

**解决的问题**：
- 原版只有纯静态站点，无法承担密钥隔离、真实模型调用、实验任务执行与账户同步。
- 若整体迁移到重型框架则丢失现有 GitHub Pages 部署身份。静态优先 + 可选后端同时保留两条路径。
- 用户数据（localStorage）在两种模式下都可用；完整模式增加服务端持久化与同步。

**边界**：
- 前端：页面、路由、交互、本地数据（课程进度、笔记、草稿）。绝不保存服务端密钥。
- 后端：密钥代理（模型调用）、实验任务执行（隔离子进程）、账户与数据同步、embedding 索引服务。
- 内容：`src/content/` 数据模块，纯数据 + 校验，构建时不需网络。

## 2. 数据与 schema：v3 正式 schema + 迁移链

**决策**：`src/core/schema.js` 定义 v3 实体（profile、goal、diagnostic、enrollment、progress、notes、runs、experiments、projects、reports、resources、accounts/sync 状态），全部使用稳定 ID（`stableId()` 前缀化 UUID）。教材章节编号只作为 `sourceRef` 属性，不再充当课程主键。`src/core/store.js` 提供 `migrateState`（v1→v2→v3 幂等迁移）、导入预检（`inspectImport` 显示范围与冲突）、统一错误码（`src/core/errors.js`，如 `E_IMPORT_VERSION`、`E_STORAGE_QUOTA`）。

**解决的问题**：课程改名/改顺序后旧数据仍通过 ID 找到；v1/v2 数据可重复验证迁移；不同主题不被误合并（迁移保留原始副本 `legacy` 与旧 ID 映射表）。

## 3. 模型接入：后端代理 + 提供商适配

**决策**：`server/src/llm.js` 提供 OpenAI 兼容代理（默认 DeepSeek `deepseek-chat`，可配置 GLM `glm-4-flash`）。密钥只存在于服务器环境变量（`DEEPSEEK_API_KEY` / `GLM_API_KEY`），前端只看到会话句柄与响应。所有调用记录模型版本、参数、耗时、token 用量与费用估算（按可公开的定价常数估算，标记为"估计"）。

**解决的问题**：密钥不落前端；真实模型实验可重复（记录采样/种子/版本）；费用可审计。

## 4. 实验执行：任务运行器 + 隔离子进程

**决策**：`server/src/tasks.js` 实现任务生命周期（queued → running → succeeded/failed/cancelled/timeout），每个任务在独立临时目录以子进程运行 `experiments/` 下受白名单限制的 Python 脚本，带超时、取消（kill）、日志流式落盘（`server/data/tasks/<id>/`）、退出码与产物清单。前端通过轮询读取状态，UI 与服务端状态一致。**不在应用主进程执行任意上传代码**；白名单外的脚本名直接拒绝。

**解决的问题**：`inference.py`、RAG embedding 构建、BC 训练等真实实验需要分钟级运行与可追溯日志；浏览器无法直接管理子进程。

## 5. RAG：本地 embedding + 词项基线双轨

**决策**：`experiments/rag_embed.py` 用 `BAAI/bge-small-zh-v1.5`（CPU、约 100MB、Apache-2.0）计算语料向量；后端 `/api/rag/*` 在 `server/data/rag/` 保存索引，提供分块、向量检索（numpy 余弦排序）与词项检索基线并列。生成回答经第 3 条模型代理，要求回答引用资料 ID；当前自动检查只确认引用 ID 存在于实际上下文，并展示上下文供人工核对，不声称自动完成事实蕴含或原文支持验证。

**解决的问题**：原版 RAG 只有词项匹配；embedding 真实可用且零边际成本（本地模型，不按 token 计费）；网络不可用时可退回词项基线（不伪造 embedding 结果）。

## 6. 具身：Python 闭环仿真 + BC 训练 + 前端轨迹回放

**决策**：`experiments/embodied/` 提供 2D 差速驱动机器人仿真（含噪声、执行偏差、遮挡故障注入）、BC（行为克隆）训练脚本（torch CPU，数分钟内完成）、评测脚本（成功率/位置误差/新条件泛化）。前端保留并扩展 2D 交互演示（参考系、单位、位姿、时间对齐诊断），新增轨迹回放器（JSONL 逐帧播放、暂停、同一时间轴显示观察/状态/指令/动作/成功条件）。

**解决的问题**：二维数学正确不能替代整个具身模块验收；真实闭环 + 训练产物（权重、轨迹、指标日志）提供可复现证据；不承诺需要 GPU/真机的前沿 VLA 训练。

## 7. 账户与同步：本地账户 + 版本化合并

**决策**：`server/src/accounts.js` 提供本地注册/登录（scrypt 加盐哈希，会话 token），每用户独立数据文件（`server/data/users/`），同步端点带 `revision` 版本号；前端离线队列 + 双向合并（无冲突自动合并，同字段冲突给出选择 UI）。退出登录时明确本机数据处理选项（保留/清除）。

**解决的问题**：跨设备恢复课程、笔记、项目和实验；隔离用真实第二账户验证；云端托管属于外部条件，本地后端先满足同步语义。

## 8. 部署

**决策**：静态部分维持 GitHub Pages / Netlify / Vercel 配置（`.github/workflows`、`netlify.toml`、`vercel.json`）；后端通过 `npm run server` 在自有机器/服务器运行，`server/.env.example` 列出全部环境变量；CI 在合并前运行 check + test。旧 service worker 保持退役脚本，避免旧缓存遮蔽修复。

## 9. 不做的事

- 不引入支付、排行榜、社交信息流。
- 不承诺云端 GPU、真实机器人或前沿 VLA 实时运行；设备限制如实标注。
- 不把演示/规则模拟标为真实模型或真实训练结果。
