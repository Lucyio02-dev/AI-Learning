# 验收记录（完整版 3.0 统一验收）

日期：2026-11-16 ~ 2026-11-17（Asia/Shanghai）
验收人：接续开发代理（按 docs/GLM_HANDOFF_CHECKLIST.md 合同执行）
原则：只有功能实际运行并通过对应验收后才勾选；外部阻塞集中列出。

## 1. 真实运行证据（模型/仿真/训练）

| 实验 | 命令 | 结果 | 产物 |
| --- | --- | --- | --- |
| SmolLM2-135M CPU 推理 | `python experiments/inference.py` | ✅ 权重下载+生成成功 | `artifacts/logs/inference-run.log`、`inference-run2.json`（模型/参数/耗时/token） |
| 依赖检查 | `python experiments/inference.py --check` | ✅ | `artifacts/logs/inference-check.log` |
| 专家轨迹采集 | `experiments/embodied/collect.py --episodes 100` | ✅ 专家成功率 100% | `server/data/artifacts/embodied/demo100.jsonl` |
| BC 训练（自己训练） | `experiments/embodied/bc_train.py --epochs 400` | ✅ CPU 2.1s，train 0.00237 / val 0.00542 | `artifacts/logs/bc-train.json` + 权重 |
| 闭环评测（训练分布） | `evaluate.py --target-dist train --episodes 50` | ✅ 成功率 96%，均值误差 0.103 | `artifacts/logs/bc-eval-train.json` |
| 闭环评测（新分布） | `evaluate.py --target-dist new --episodes 50` | ✅ 成功率 68%（分布偏移证据） | `artifacts/logs/bc-eval-new.json` |
| 专家基线评测 | `evaluate.py`（无模型） | ✅ 100% / 0.046 | `artifacts/logs/expert-eval-train.json` |
| 训练泄漏对照 | `train_eval.py --leaky` vs 正确版 | ✅ 泄漏 test_acc 1.0 vs 0.86 | `artifacts/logs/train-eval-*.json` |
| RAG embedding 索引 | `rag_embed.py index`（bge-small-zh-v1.5） | ✅ dim=512 索引落盘 | `server/data/rag/index-builtin-200-40/` |
| RAG embedding 检索 | serve 协议实测 | ✅ 正确召回 + 版本冲突素材 | 控制台记录 |
| 泄漏对照的发现 | 开发中修复 | 记录：`rng.normal(n)` 参数误用曾使数据集平凡可分 | git 历史 |

## 2. 自动化测试

- `npm run check`：31 前端模块 + 7 后端文件语法检查 ✅
- `npm test`：**39 个测试全部通过**（约 5 秒），覆盖：
  - v1/v2→v3 迁移链（能力降级、reports 映射、legacy 保留、往返幂等）
  - 导入预检（冲突检测、未知版本拒绝、v3 空备份合法）
  - 合并策略（同字段取较新、运行记录去重）
  - validateState 危险键/URL 协议拦截（JSON.parse 原型污染向量）
  - Prompt 引擎（变量分离、JSON 校验、聚合、评估）
  - Agent 引擎（参数/权限校验、幂等去重、无幂等键重复、恢复、目标核验、脱敏、旧 API 兼容）
  - RAG（版本过滤、缺失不可修复、分块、hit@k、回答分级）
  - 运动学（多朝向往返零误差、故障特征、伪随机一致性）
  - 内容一致性（24 门课、先修无环、17 原稳定 ID、完整模板、研究专题四要素）
  - API 集成（真实服务器进程：健康/静态穿越防护/密钥缺失 503/任务白名单/生命周期/取消竞态/404/注册登录/双用户隔离/同步 409 冲突+force/RAG 词项查询）

## 3. 浏览器端到端走查（完整模式，IAB 真实浏览器）

全部在 http://127.0.0.1:8787 实际点击执行：

- ✅ 启动：完整模式指示（2 个模型已配置）、首页"下一步"任务
- ✅ 课程页：四步结构、公式/维度卡、代码+预期输出、常见错误、修改任务、三层深度、实验室入口、能力徽章、元信息条（时长/费用/运行条件/来源章节）
- ✅ Prompt 实验室：规则演示；**真实模型对照**（DeepSeek 4 变体×2 采样，无证据→明确拒答，JSON 模式→合法 null，用量/耗时显示）；**批量评测**（8 题含未见 3 题：调试 60% vs 未见 67%，失败样例保留）
- ✅ RAG 实验室：embedding+词项双轨并列；**真实生成引用全部有效**（模型自行区分新旧版本规定）；缺失故障注入→数据缺失归因；gold-evidence 人工证据对照；分块/Top-K/版本过滤对照；检索评测集
- ✅ Agent 实验室：写入超时→检查点保存→**刷新页面→检查点横幅→恢复→状态核验→"一次写入一条预约"通过**；工具 schema/参数校验/权限拒绝/脱敏轨迹；架构取舍对照表
- ✅ 具身实验室：frame 故障闭环（误差 230，特征文案）；故障特征对照表；轨迹回放（同一时间轴观察/状态/指令/动作/误差）；**浏览器触发真实任务链**：采集 100 轨迹（213ms）→ BC 训练（4.7s，own-training）→ 闭环评测双分布；**Q-learning**（ε=0.2 收敛 65%→95%→100%，贪心路径到达目标，与 BC 范式对比）
- ✅ AI 助教：真实模型，正确回答 √dk 问题并标注 `[通用知识]（课程资料未包含该推导，以上基于通用知识）` —— 不知道即说不伪造
- ✅ 诊断问卷：保存+跳转；能力评价题：提交记录（quizAttempts）
- ✅ 账户同步：studentA 注册→推送 r1；studentB 注册→拉取"服务器上还没有数据"（**隔离验证**）；A 重登录→拉取恢复 r1+诊断状态（**跨会话恢复**）
- ✅ 笔记库：新建/标题/标签/正文/搜索/关联
- ✅ 刷新恢复：课程 tensor 第 3 步位置、11 条运行记录持久化
- ✅ 窄屏 390px：无横向溢出、控件可达、导航可用
- ✅ 能力评价页：量表、状态区分说明、作答历史

## 4. 链接核对

`node scripts/link-check.mjs`：37/37 唯一链接可达（2026-11-17）。
其中 platform.openai.com 对脚本返回 403（反爬），已用真实浏览器验证可达（页面标题确认）。明细：`artifacts/logs/link-check.txt`。

## 5. 性能与资源检查

- 首屏：静态资源全部 no-store 本地加载，app 启动 <1s（浏览器采样）；后端探测异步不阻塞首屏
- 长日志：任务日志读取截断至 200KB（`taskDetail`）
- 大笔记/索引：笔记版本历史截断 10 版；归档截断 500 条；运行记录 100+归档
- 模型调用预算：max_tokens 上限 2048（服务端强制）、批量评测 8 题约 0.01 元级费用并显示估算
- 实验：嵌入索引构建 0.09s（缓存后）；BC 训练 2.1s CPU

## 6. 真实阻塞与未执行项（保持诚实）

| 项 | 状态 | 原因 |
| --- | --- | --- |
| 云端公网部署（真实部署 URL） | **未执行** | 交接清单第 0 节：不自行创建无关托管项目；本地/静态部署已就绪，用户授权托管后即可发布（方案见 README 部署节） |
| 真实第二台物理设备同步 | 未执行 | 本地后端绑定 127.0.0.1；已提供 `AI_LEARNING_HOST=0.0.0.0` 支持与"第二浏览器=第二设备"的语义验证（API 层双用户隔离测试通过） |
| 开源机器人仿真环境（LeRobot/mujoco） | 未接入 | 依赖重（torch+gym+mujoco）、Windows CPU 兼容性风险高；采用**自研确定性 2D 仿真**（同数学内核双端一致、种子可复现）达成"真实闭环+可复现"验收意图，LeRobot 作为课程入口保留 |
| 原教材全部 Notebook 逐个执行 | 未执行 | 依赖各自环境与算力；已做链接核对+运行条件标注，执行属用户按需进行 |
| 前沿 VLA 实时运行 | 不承诺 | 清单要求"避免把所有前沿模型都承诺为普通电脑实时运行"——课程如实标注设备限制 |

## 7. 交接清单勾选状态

见 `docs/GLM_HANDOFF_CHECKLIST.md` 内联勾选；每项勾选对应本文一节或多节证据。
