# AI Learning · 学习实验室（3.1）

面向大学生与自学者的大模型、具身智能学习工作台：理解原理、运行真实实验、定位失败环节、验证修改。

**后续开发入口**：[AI 接续开发清单（3.1 之后）](./docs/AI_HANDOFF_NEXT.md)，包含优先级、源码问题、任务依赖和验收标准。

**在线入口**：[GitHub Pages 学习工作台](https://lucyio02-dev.github.io/AI-Learning/)。3.1 在 3.0 工作台上整合课程案例、数据修复与在线发布，沿用 v3 学习数据。整合范围、版本关系和剩余工作见 [版本整合记录](./docs/VERSION_INTEGRATION.md)。两条主线（大模型 / 具身智能）的已有验收证据见 [docs/ACCEPTANCE.md](./docs/ACCEPTANCE.md)；仍未完成的范围继续保留在 [交接清单](./docs/GLM_HANDOFF_CHECKLIST.md) 与 [路线图](./docs/ROADMAP.md)。

## 启动（冷启动）

要求：Node.js 20+（后端），Python 3.10+ 与约 2GB 磁盘（真实实验，可选）。

```sh
# 1. 前端 + 后端（一条命令）
npm run dev
# 打开 http://127.0.0.1:8787 —— 页面会显示"完整模式 · N 个模型已配置"

# 2. 真实实验环境（可选，首次运行会下载权重/模型）
python -m pip install -r experiments/requirements.lock.txt
python experiments/inference.py --check          # 依赖检查（不下载）
python experiments/inference.py                  # 真实 CPU 推理（约 270MB 权重）

# 3. 静态模式（无后端，GitHub Pages 场景）
npm run static        # http://127.0.0.1:4173，规则实验与本地数据可用
```

环境变量（后端，见 `server/.env.example`）：
- `PORT`（默认 8787）、`AI_LEARNING_HOST`（第二设备同步时设 `0.0.0.0`）、`AI_LEARNING_DATA`（数据目录，默认 `server/data`）
- `DEEPSEEK_API_KEY` / `GLM_API_KEY`（模型代理；**只在服务器环境变量中，前端永远接触不到**）

## 检查与测试

```sh
npm run check        # 全部 JS 语法检查（前端 31 模块 + 后端）
npm test             # 自动化回归（迁移/引擎/API/隔离/冲突/缓存升级/发布模块完整性）
npm run pycheck      # Python 实验脚本语法检查
node scripts/link-check.mjs   # 课程引用链接可达性核对
```

## 两种模式

| 能力 | 本地模式（纯静态） | 完整模式（本地后端） |
| --- | --- | --- |
| 课程/笔记/诊断/地图/搜索 | ✅ | ✅ |
| 规则实验、词项检索、2D 仿真、Q-learning | ✅ | ✅ |
| 真实模型调用（Prompt/RAG 生成/助教） | 显示需要后端 | ✅ 密钥隔离在服务端 |
| 真实 embedding 检索 | — | ✅ bge-small-zh，CPU |
| 实验/训练任务（推理/BC/评测） | — | ✅ 子进程隔离执行 |
| 账户与跨设备同步 | — | ✅ 本地账户体系 |

## 数据与迁移

- 本地数据存于浏览器 localStorage（键 `ai-learning-lab-v3`），导出/导入带预检与冲突展示；导入前自动落双备份（本机存储 + 下载文件）。
- v1/v2 旧数据自动迁移：笔记与实验文本保留，旧打卡降级为"自报"，不冒充能力证据；原始副本完整保留在 `legacy` 字段。
- 同步：设置页注册/登录后推送/拉取；按版本号乐观并发，冲突时可选合并/覆盖/下载。
- 容量：实验记录超 100 条自动**归档**（不丢弃），可导出。

## 目录结构

```
app.js                  入口（路由装配 + 全局事件）
src/core/               schema v3、迁移链、错误码、存储
src/content/            24 门课程（问题情境/预测/公式/代码/陷阱/修改/验证/深度/引用）
src/labs/               实验引擎（Prompt/RAG词项/Agent工具契约/运动学/Q-learning）
src/app/                状态、API 客户端、路由、视图（views/）
server/                 Node 后端（纯标准库）：模型代理/任务执行器/账户同步/RAG 服务
experiments/            Python 真实实验（inference/rag_embed/basics/embodied）
tests/                  自动化测试
docs/                   ADR、验收记录、链接核对、复现实例
```

## 部署

- **静态托管**（GitHub Pages / Netlify / Vercel）：运行 `npm run build:site` 生成 `dist/`；GitHub Pages 由 `.github/workflows/pages.yml` 自动构建并发布 `dist/`。所有应用模块和样式位于同一个内容版本目录，根目录保留首页、发布信息与旧缓存退役脚本。线上为浏览器学习模式，学习数据保存在访问者的浏览器。
- **完整模式**：在自有机器/服务器运行 `npm run server`，静态站点与后端同源部署（把 `dist/` 指向前端托管，或直接用后端的静态服务）。模型调用、任务执行和账户同步需要后端支持。
- **迭代**：功能分支提交 → PR 校验 → 合并 `main` → Pages 校验、构建并发布。`main` 代表通过校验的发布版本，可以持续重构；3.0 的功能和原始计划保留在提交历史与文档中。每个正式版本以 Git 标签记录，`release.json` 可核对线上版本与源码提交。发布门槛、版本核对和回滚步骤见 [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)。

## 真实性边界

- Prompt/RAG/Agent 实验室明确标注规则演示与真实调用的区别；真实调用记录模型版本、参数、耗时、token 与费用估算。
- BC 训练标注 `kind=own-training`（自己训练），与"运行官方预训练策略"严格区分；2D 仿真无动力学，不代表真实设备。
- 助教不伪造来源：课程资料未覆盖时明确声明"基于通用知识"。

原教材来源：[Lordog/dive-into-llms](https://github.com/Lordog/dive-into-llms)。主题映射核对日期 2026-11-16（37/37 链接可达，见 `artifacts/logs/link-check.txt`）；外部 Notebook 的依赖与算力要求以原教材说明为准，平台仅作引用与扩展，不复制整本教材。
