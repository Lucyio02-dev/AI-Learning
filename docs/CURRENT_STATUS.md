# 当前状态

更新日期：2026-11-18（Asia/Shanghai）。本页是接手、验收和汇报时的唯一当前状态入口；历史验收、路线图和交接清单保留为背景。

## 1. 线上现在是什么

| 范围 | 当前事实 |
| --- | --- |
| 正式网址 | <https://lucyio02-dev.github.io/AI-Learning/> |
| 线上版本 | `3.1.0`（未提升 schema，仍为 v3） |
| 本轮发布代码基线 | `0c4b11cc59878d6495d1432cd3b8f3ee7a911858`（PR #4–#8 加一次后端缺陷修复后的 `main`） |
| 线上能力 | GitHub Pages 静态学习：课程、笔记、诊断、地图、资料、规则实验、浏览器仿真 |
| 线上不提供 | 公网模型、真实 embedding、Python 任务、账户同步（需 H01–H03 的计算服务） |

线上 `release.json` 是发布状态的唯一权威来源：

```sh
curl -s https://lucyio02-dev.github.io/AI-Learning/release.json
```

它给出 `commit`、`assetDirectory`、`builtAt`。**本页自身的更新也会再触发一次部署**，所以本页不写死 `builtAt`；核对时以 `release.json` 为准，并确认 `commit` 等于当前 `main` 的 HEAD。

## 2. 本轮交付（H04–H08）

| 任务 | 状态 | 证据 |
| --- | --- | --- |
| H04 发布校验与回滚 | 已上线 | `verify → build → deploy` 强制依赖；三套托管配置只发布 `dist/`；`scripts/verify-release.mjs` 校验版本、提交、资源目录与禁止目录；`docs/DEPLOYMENT.md` |
| H06 保存语义与验收来源 | 已上线 | `update()` 结果驱动提示；失败保留内容并可重试/导出；`src/app/evidence.js` 区分自报/程序检查/模型建议/人工复核；阶段勾选不再等同“验收通过” |
| H05 项目证据与归档 | 已上线 | `src/app/history.js` 检索筛选与 20 条渐进加载；`src/app/project-runs.js` 显式关联活跃+归档运行；报告导出含配置/指标/产物/缺失 ID |
| H07 浏览器端到端 | 已上线 | Playwright 三项目（静态源码 / 生产构建 / 临时后端）8 条用例；CI 已接入并实际跑通；`docs/TESTING.md` |
| H08 文档与状态统一 | 本页 | README、交接清单、路线图、验收记录、维护指南统一指向本页 |

### 本地执行结果

```text
npm run check          checked 38 frontend modules
npm test               58 passed, 0 failed
npm run pycheck        passed
npm run e2e            8 passed
npm run build:site     dist built
npm run verify:release Release OK
```

### 远程与线上结果

- 五个堆叠分支的 `Validate learning lab` 全部 `success`（首次在 CI 中运行 Playwright 套件）。
- 后续两次直接推送（文档更新 `91b6f3e`、后端修复 `0c4b11c`）中，`91b6f3e` 的校验因上面那条缺陷失败并如实留在历史里；修复后 `0c4b11c` 的校验与部署均为 `success`。
- 线上核对：`release.json.commit` = `0c4b11c…`，`index.html` 指向 `releases/3.1.0-2359412d098f`（前端资源未变，故目录名不变），入口与 `src/app/*.js`（含本轮新增的 `evidence.js`、`history.js`、`project-runs.js`）全部 200。
- 线上浏览器冒烟：首页、课程页、实验室、项目页、设置页均正常渲染；实验室历史区出现本轮新增的检索/筛选控件；项目页出现“证据/关联”区。
- 唯一的 404 是浏览器探测 `/api/health`，这是静态模式的预期结果（前端已有降级提示），不是缺陷。

### CI 抓到并修复的真实缺陷

第一次在远程 CI 跑 E2E 时，`[full] 完整模式缺少训练数据时明确失败` 偶发红：任务提交后界面一直停在 `running`（重试时是 `queued`）。本地复现后确认不是测试不稳，而是 `server/src/tasks.js` 的真实缺陷：

- `spawn("python", …)` 失败（例如 `python` 不在 `PATH`）只会在 `ChildProcess` 上抛 `error` 事件，原实现没有任何监听 → 未处理事件直接终止服务进程；
- 即使补上监听，挂在 `await` 之后也来不及，事件在下一个 tick 就已发出。

改为 `spawn` 之后立即挂 `close`/`error` 并等待同一个 outcome，任务因此必有唯一终态；`pump()` 同时兜住启动阶段异常，避免任务永久停在 `queued`。新增回归：`PATH` 指向空目录启动独立服务，断言两个任务都进入 `failed` 且队列被释放（`npm test` 58 例）。

测试数量只是本次证据，不写死为永久验收标准。任何后续改动都必须重新运行对应范围。

## 3. 发布与推送通道

2026-11-18 当天，本机到 `github.com:443` 的直连超时、HTTP 代理对 CONNECT 返回 502，但 `api.github.com` 与 `ssh.github.com:443` 可达。因此本轮先用 GitHub Git Data API（`blobs → trees → commits → refs`）把本地提交原样搬上去，再创建 PR #4–#8 并依次合并。

- 提交对象的 `tree` 与 `author/committer/message` 逐字节复刻，因此远程提交 SHA 与本地完全相同（`1709972`、`5dbe634`、`8c865d0`、`2894993`、`3559052`、`f5dbf49`），可以直接用 `git rev-parse` 对比验证。
- 合并顺序是堆叠的：每次先合并前一个 PR，再把后一个 PR 的 base 改回 `main`；**不要在子 PR 改基之前删除父分支**，GitHub 会因此关闭子 PR（本轮踩过：#4 合并后删除分支导致 #5 被关闭，靠重建分支并重新打开才恢复）。
- 通道恢复后 `git fetch` / `git push` 已可用；后续优先用普通 `git push`，只在网络再次阻断时回退到 API 方案。

## 4. 未验证项与外部条件

- 仓库分支保护、必需检查（Rulesets）：需要仓库设置权限，本轮未启用，也不声称已启用。
- 线上回滚演练：步骤写在 `docs/DEPLOYMENT.md`，但未实际执行一次；下次发布异常时再验证。
- 真实第二台物理设备、付费模型回答质量、完整外部 Notebook、真实用户研究：仍未执行。
- 公网模型、embedding、Python 训练与账户同步：需要独立计算服务与持久存储，属 H01–H03，不能以静态站点通过代替验收。
- 数千条运行记录下的渲染性能、多标签页并发写入、浏览器配额极限：本地回归为合成数据与桩模拟，未做真实压力验证。

## 5. 下一步

1. H09：课程示例与引用的质量核对（外链扩充到案例与项目，固定 commit/tag 快照）。
2. H10：自选资料上传与索引管理界面（当前只能粘贴文本）。
3. H01–H03：在线计算服务、权限与故障控制、跨设备同步与备份恢复，需要先确定托管与预算。
4. 后续每次发布：合并后核对 `release.json.commit`，然后更新本页第 1 节与第 4 节。
