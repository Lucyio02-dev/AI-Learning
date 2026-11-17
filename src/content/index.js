// 内容中心：课程、路线、实验信息、项目。ID 是平台稳定身份。
import { coursesCommon } from "./courses-common.js";
import { coursesLlm } from "./courses-llm.js";
import { coursesEmbodied, coursesResearch } from "./courses-embodied.js";
import { openSourceCases, openSourceCasesForCourse, getOpenSourceCase } from "./open-source-cases.js";

export { openSourceCases, openSourceCasesForCourse, getOpenSourceCase };

export const tracks = {
  all: "全部课程",
  common: "公共基础",
  llm: "大模型开发",
  embodied: "具身智能",
  research: "研究专题",
};

export const courses = [...coursesCommon, ...coursesLlm, ...coursesEmbodied, ...coursesResearch];

// 启动时一致性检查（开发与测试捕获；生产静默容错）。
export function validateContent() {
  const ids = new Set(courses.map((c) => c.id));
  const problems = [];
  if (ids.size !== courses.length)
    problems.push({ code: "DUP_ID", detail: "课程 ID 重复" });
  const visiting = new Map();
  const visit = (id, path) => {
    if (visiting.get(id) === "done") return;
    if (visiting.get(id) === "visiting") {
      problems.push({ code: "PREREQ_CYCLE", detail: path.join("→") });
      return;
    }
    visiting.set(id, "visiting");
    const c = courses.find((x) => x.id === id);
    if (!c) {
      problems.push({ code: "MISSING_PREREQ", detail: id });
      return;
    }
    for (const p of c.prerequisites || []) visit(p, [...path, id]);
    visiting.set(id, "done");
  };
  courses.forEach((c) => visit(c.id, []));
  return { ok: problems.length === 0, problems };
}

export const getCourse = (id) =>
  courses.find((c) => c.id === id) || null;
export const courseSteps = (c) => c.steps || [];

// 完整课程 = 四步模板；研究专题没有 steps 时按研究模板展开为四步。
export const getSections = (c) =>
  c.steps?.map((s) => [s.title, s.body]) || [
    ["研究问题", c.outcome],
    ["建立基线", "运行原教材最小实验，记录模型、数据、版本和配置。保存原始输出，明确指标定义。"],
    ["修改与对照", "写下假设，只改变一个因素，在独立样例上分析提升与副作用。"],
    ["形成证据", "记录结果、失败类型、适用范围和下一步。本页是外部专题指南，完整实验请进入原教材。"],
  ];

export const labInfo = {
  prompt: {
    title: "Prompt 对照实验室",
    subtitle: "先判断缺的是什么，再改输入",
    kind: "规则演示 + 真实模型对照",
    modes: ["rule", "model"],
    course: "ch02",
  },
  rag: {
    title: "RAG 诊断实验室",
    subtitle: "沿着检索证据定位错误环节",
    kind: "词项基线 + 本地 embedding + 真实生成",
    modes: ["rule", "local-compute", "model"],
    course: "rag",
  },
  agent: {
    title: "Agent 故障实验室",
    subtitle: "架构选择、工具契约与可靠恢复",
    kind: "确定性工具模拟器 + 检查点持久化",
    modes: ["rule"],
    course: "agent",
  },
  embodied: {
    title: "空间与动作实验室",
    subtitle: "参考系、执行误差与时间对齐",
    kind: "二维运动学 + 本地仿真闭环 + 轨迹回放",
    modes: ["rule", "sim"],
    course: "space",
  },
};

// 贯穿项目：阶段任务 + 提示分级 + 验收标准。参考实现见 projects/ 目录。
export const projects = [
  {
    id: "assistant",
    title: "可信任的课程资料助手",
    tag: "大模型 · 工程 / 产品",
    summary:
      "从需求定义到评估报告：分块、embedding 检索、生成引用、工具异常处理与回归评测的完整小项目。",
    runConditions: "本地后端 + Python 环境；嵌入模型 bge-small-zh（约 110MB，首次下载）。",
    openSourceRefs: ["llama-index", "langgraph"],
    stages: [
      {
        id: "requirements",
        title: "阶段 1 · 需求与边界",
        brief: "定义服务对象、成功标准与拒答边界。",
        tasks: [
          "写 5 个用户问题（含 2 个应拒答/澄清的）",
          "定义成功标准：引用可定位、无据不答",
          "列出资料来源与更新机制",
        ],
        starter: null,
        hints: [
          { level: 1, text: "成功标准要可测量：如“Top-3 内含正确块的比率 ≥ 80%”" },
          { level: 2, text: "拒答样例：不在资料库范围的问题、需要实时信息的、需要个人数据的" },
        ],
        acceptance: ["需求文档包含可测成功标准", "含拒答边界清单"],
      },
      {
        id: "pipeline",
        title: "阶段 2 · 数据与检索流水线",
        brief: "把资料变成可检索、带版本、可重建的索引。",
        tasks: [
          "整理 10-20 份资料（含两版规定制造版本冲突）",
          "用 rag_embed.py 构建向量索引，记录分块参数",
          "运行词项基线对比，记录两类检索的命中差异",
        ],
        starter: "experiments/rag_embed.py（索引构建 + 查询）",
        hints: [
          { level: 1, text: "分块大小 200-400 字、重叠 50 字是常见起点" },
          { level: 2, text: "meta.json 里记录 corpus 哈希，资料更新后可检测" },
        ],
        acceptance: ["索引可重建且元数据完整", "基线对比表"],
      },
      {
        id: "generation",
        title: "阶段 3 · 生成与引用核验",
        brief: "让回答只基于检索证据，并让引用可点击回原文。",
        tasks: [
          "设计生成 Prompt：只用给定证据、无证据则明确拒答",
          "实现引用标注 [doc-id]，展示原文片段",
          "注入“证据缺失”故障，验证拒答行为",
        ],
        starter: "实验室 RAG 真实模式 + server/src/llm.js",
        hints: [
          { level: 1, text: "Prompt 明确：“只使用 <context> 中的信息，并标注 [id]”" },
          { level: 2, text: "核验：回答中的每个 [id] 必须出现在上下文里，程序可查" },
        ],
        acceptance: ["无据问题得到明确拒答", "引用与原文一致"],
      },
      {
        id: "evaluation",
        title: "阶段 4 · 评估与部署",
        brief: "建立固定评测集与回归测试，形成可交付的评估报告。",
        tasks: [
          "标注 10 题（含未见 3 题）与正确块",
          "运行检索指标 + 回答指标，写失败归因",
          "导出项目档案（报告 + 运行记录 + 配置）",
        ],
        starter: "实验室运行记录导出",
        hints: [{ level: 1, text: "失败归因分四类：数据/检索/上下文/生成" }],
        acceptance: ["指标表 + 归因", "档案可复现（配置+记录）"],
      },
    ],
    questions: [
      "服务谁，什么结果算成功？",
      "为什么选择检索方案 A/B？",
      "哪些错误最影响目标？",
      "修改前后的证据是什么？",
    ],
    directions: {
      product: "强化需求边界与交互成本：写用户旅程与拒答文案。",
      engineering: "强化契约与测试：索引 schema、接口测试、CI 回归。",
      research: "强化假设与消融：分块参数消融、检索策略对比。",
    },
  },
  {
    id: "robot",
    title: "让机器人走到正确的位置",
    tag: "具身智能 · 仿真起步",
    summary:
      "从坐标与参考系，到轨迹数据检查、BC 策略训练、闭环评测与新场景泛化的完整仿真项目。",
    runConditions: "Python + torch（已锁版本）；CPU 数分钟级。",
    openSourceRefs: ["lerobot"],
    stages: [
      {
        id: "frames",
        title: "阶段 1 · 坐标与故障定位",
        brief: "在实验室完成参考系诊断，形成可复用的检查清单。",
        tasks: [
          "完成空间实验室 4 朝向预测-验证",
          "注入 frame/drift 故障各一次并写特征",
          "总结坐标检查清单（单位/参考系/限位）",
        ],
        starter: "空间实验室",
        hints: [{ level: 1, text: "0° 成功不能证明转换正确——多朝向验证" }],
        acceptance: ["4 组记录", "检查清单"],
      },
      {
        id: "data",
        title: "阶段 2 · 轨迹数据",
        brief: "采集并检查专家轨迹，理解动作语义与时间对齐。",
        tasks: [
          "collect.py 采集 20 条轨迹（含噪声）",
          "逐帧检查时间戳对齐与动作语义",
          "把 5 条轨迹导入前端回放器逐步观察",
        ],
        starter: "experiments/embodied/collect.py + 轨迹回放器",
        hints: [{ level: 2, text: "动作是增量位移还是绝对速度？写进数据卡" }],
        acceptance: ["数据检查记录", "回放截图/记录"],
      },
      {
        id: "train",
        title: "阶段 3 · 训练 BC 策略",
        brief: "真实训练一个小策略并保留训练证据。",
        tasks: [
          "bc_train.py 完成训练，记录 loss 曲线与耗时",
          "改变一个训练变量（噪声/网络宽度）重训一次",
          "区分“运行已有策略”与“自己训练”写进报告",
        ],
        starter: "experiments/embodied/bc_train.py",
        hints: [{ level: 2, text: "loss 降到 0 不一定是好事——过拟合演示轨迹" }],
        acceptance: ["两份训练 JSON 记录", "单变量说明"],
      },
      {
        id: "eval",
        title: "阶段 4 · 闭环评测与新场景",
        brief: "用成功率与误差说话，测试泛化并分析失败。",
        tasks: [
          "evaluate.py 训练分布 50 集 + 新目标分布 50 集",
          "对 3 个失败轨迹写归因（误差累积/分布偏移/限位）",
          "导出项目档案",
        ],
        starter: "experiments/embodied/evaluate.py",
        hints: [{ level: 1, text: "失败归因看误差随步数的增长曲线" }],
        acceptance: ["两组评测 JSON", "失败归因 ≥3 例", "档案导出"],
      },
    ],
    questions: [
      "观察、状态、动作分别是什么？",
      "动作使用哪个参考系与单位？",
      "失败发生在哪个环节？",
      "怎样验证新场景中的表现？",
    ],
    directions: {
      product: "写清仿真与真机的边界声明与安全条款。",
      engineering: "把评测做成可重复脚本（CI 可跑）。",
      research: "做噪声消融实验，画成功率-噪声曲线。",
    },
  },
  {
    id: "drone-mapping",
    title: "无人机影像到可验证正射产品",
    tag: "测绘遥感 · 摄影测量 / 地理 AI",
    summary:
      "从航片数据卡与 ODM 重建，到正射成果质量核验、地理可视化和 SAM 2 掩膜坐标回写，形成一份能复查来源、参数、位置精度与分割误差的制图档案。",
    runConditions:
      "Docker（ODM 小数据先行）+ Python/geemap；航测重建的耗时与存储随影像数量和分辨率变化。SAM 2 扩展需单独配置环境与模型权重。",
    openSourceRefs: ["odm", "geemap", "sam2"],
    stages: [
      {
        id: "flight-data",
        title: "阶段 1 · 航片数据卡与处理设计",
        brief: "先判断影像能否支撑目标产品，记录数据出处、坐标基准和质量风险。",
        tasks: [
          "选择一组小规模公开航片或自有影像，记录来源、许可、影像数量、相机/EXIF 与数据范围",
          "写明目标坐标参考系、地面分辨率预期、控制点与独立检查点的用途",
          "标注模糊、重复、曝光差异、重叠不足等风险，并说明是否继续处理",
        ],
        starter: "OpenDroneMap README → 输入目录与 Docker Quick start",
        links: [
          { title: "OpenDroneMap README / Quick start", url: "https://github.com/OpenDroneMap/ODM/blob/master/README.md" },
        ],
        hints: [
          { level: 1, text: "先区分参与几何解算的 GCP 与独立检查点；同一批点不能同时证明外部精度。" },
          { level: 2, text: "数据卡写清 CRS、单位、像元大小和影像来源，避免后续把像素偏差误读成地面距离。" },
        ],
        acceptance: ["数据卡含来源/许可/CRS/影像数量", "GCP 与检查点分开说明", "列出至少 3 个处理风险"],
      },
      {
        id: "reconstruction",
        title: "阶段 2 · ODM 重建与参数记录",
        brief: "从小数据集跑通摄影测量流程，保存命令、版本和实际输出。",
        tasks: [
          "按 README 的 Docker 方式挂载影像目录并运行一次小规模重建",
          "保存完整命令、ODM 镜像版本、运行日志和处理参数，不只截成功页面",
          "核对生成目录中的正射影像、点云、三维模型或 DEM（哪些存在取决于数据和配置）",
          "只调整一个处理参数重跑，记录处理时长、文件大小和成果差异",
        ],
        starter: "Docker + OpenDroneMap README 中的项目目录示例",
        links: [
          { title: "ODM README：Docker 命令和输出产品", url: "https://github.com/OpenDroneMap/ODM/blob/master/README.md" },
          { title: "ODM dataset 阶段入口", url: "https://github.com/OpenDroneMap/ODM/blob/master/stages/dataset.py" },
        ],
        hints: [
          { level: 1, text: "先用少量影像确认目录映射与输出位置，再扩大数据量。" },
          { level: 2, text: "文件生成不等于成果合格：先检查 CRS、范围、像元大小和空洞。" },
        ],
        acceptance: ["可复现命令和版本记录", "至少一项正射/高程/三维成果", "单变量参数对照及差异说明"],
      },
      {
        id: "quality",
        title: "阶段 3 · 地理参考与位置质量核验",
        brief: "把影像外观、坐标元信息和独立检查点放在一起判断。",
        tasks: [
          "用 QGIS 或 geemap 打开成果，检查 CRS、范围、像元大小、NoData 和影像方向",
          "用未参与解算的检查点计算平面误差与 RMSE；若无独立点，明确标注无法报告外部位置精度",
          "在地图中标出接缝、空洞、建筑倾斜或纹理拉花等问题，并保存位置与截图",
          "改变地图缩放级别复核图层对齐，区分可视化重投影与真实数据坐标错误",
        ],
        starter: "geemap 快速开始 + 格式转换文档；本地栅格可先在 QGIS 检查",
        links: [
          { title: "geemap 快速开始", url: "https://github.com/gee-community/geemap/blob/master/docs/get-started.md" },
          { title: "geemap 格式转换", url: "https://github.com/gee-community/geemap/blob/master/docs/conversion.md" },
        ],
        hints: [
          { level: 1, text: "地图上看起来重合，不等于源文件 CRS 正确；同时核验元数据和已知坐标。" },
          { level: 2, text: "水平 RMSE 以独立检查点的地面坐标差计算；不要把 GCP 拟合残差冒充独立精度。" },
        ],
        acceptance: ["CRS/范围/像元大小检查表", "独立点误差表或明确的精度缺项说明", "至少 3 个带位置的影像问题"],
      },
      {
        id: "segmentation",
        title: "阶段 4 · SAM 2 分割与地理坐标回写",
        brief: "把提示式分割应用到小块正射影像，并验证掩膜仍落在正确地理位置。",
        tasks: [
          "从正射影像裁出 10 个固定大小样本，保存每个窗口的 affine transform、CRS 与影像来源",
          "用点提示和框提示分别生成目标掩膜，在独立标注上计算 IoU 并记录失败类型",
          "将掩膜写回栅格或矢量成果，检查重新打开后与原正射影像的空间叠加",
          "至少留出一个不同地块/拍摄条件作外部样本，讨论提示式基础模型的领域偏移",
        ],
        starter: "SAM 2 image predictor notebook；地理参考变换由栅格处理代码单独维护",
        links: [
          { title: "SAM 2 图像预测示例", url: "https://github.com/facebookresearch/sam2/blob/main/notebooks/image_predictor_example.ipynb" },
          { title: "SAM 2 image predictor", url: "https://github.com/facebookresearch/sam2/blob/main/sam2/sam2_image_predictor.py" },
        ],
        hints: [
          { level: 1, text: "SAM 2 返回的是图像像素网格上的掩膜；裁剪窗口的空间变换必须由你保存并写回。" },
          { level: 2, text: "同一区域同时用点提示和框提示，固定样本和标注，再比较 IoU；不要只挑成功案例。" },
        ],
        acceptance: ["10 个样本的提示策略与 IoU 表", "导出的掩膜保留 CRS/affine 且空间叠加正确", "至少 3 个失败案例和适用范围说明"],
      },
    ],
    questions: [
      "影像来源、坐标系、控制点与检查点分别是什么？",
      "你实际生成了哪些 ODM 产品，命令和版本是什么？",
      "位置精度由哪些独立数据支撑，不能据此声称什么？",
      "SAM 2 掩膜怎样从像素坐标回到地理坐标，在哪些地块上失败？",
    ],
    directions: {
      product: "说明制图成果的用户、更新频率、精度声明和人工复核入口。",
      engineering: "保存数据清单、容器版本、命令、空间元数据和质量检查脚本。",
      research: "比较提示策略或跨地块泛化；控制样本和标注，报告误差而非只展示可视化。",
    },
  },
];

export const getProject = (id) => projects.find((p) => p.id === id) || null;

// 全站搜索索引（B：课程/知识点/资源/笔记由 store 提供；此处前两者）。
export function courseSearchEntries() {
  const entries = [];
  for (const c of courses) {
    entries.push({
      type: "course",
      id: c.id,
      title: c.title,
      text: [c.outcome, ...(c.tags || [])].join(" "),
      route: `course/${c.id}/0`,
    });
    (c.tags || []).forEach((tag) =>
      entries.push({ type: "topic", id: `${c.id}#${tag}`, title: tag, text: c.title, route: `course/${c.id}/0` }),
    );
    (c.references || []).forEach((r, i) =>
      entries.push({
        type: "resource",
        id: `${c.id}#r${i}`,
        title: r.title,
        text: `${r.kind} ${c.title}`,
        route: `course/${c.id}/0`,
        url: r.url,
      }),
    );
    (c.steps || []).forEach((s, i) =>
      entries.push({
        type: "step",
        id: `${c.id}#s${i}`,
        title: `${c.title} · ${s.title}`,
        text: s.body?.slice(0, 200) || "",
        route: `course/${c.id}/${i}`,
      }),
    );
  }
  for (const item of openSourceCases) {
    const courseId = Object.keys(item.lessons || {})[0];
    entries.push({
      type: "resource",
      id: `github-${item.id}`,
      title: `GitHub · ${item.repository}`,
      text: `${item.summary} ${item.license} ${item.stars} stars`,
      route: courseId ? `course/${courseId}/0` : "projects/drone-mapping",
      url: item.url,
    });
  }
  for (const p of projects)
    entries.push({
      type: "project",
      id: p.id,
      title: p.title,
      text: p.summary,
      route: `projects/${p.id}`,
    });
  return entries;
}

// 科研复现模板（I：论文到实验的学习模板）
export const paperTemplate = {
  sections: [
    "问题：论文要解决什么？",
    "假设：核心主张与前提条件？",
    "方法：关键设计与为什么有效（作者贡献）？",
    "复现：我做了什么改动（学生自己的贡献要明确标注）？",
    "基线：与什么对比？",
    "消融：去掉哪个组件结果变多少？",
    "失败：什么情况下不成立？",
    "局限：数据/模型/评测的边界？",
  ],
  exampleRef: "docs/REPRO_EXAMPLE.md",
};

export const textbook = {
  repo: "https://github.com/Lordog/dive-into-llms",
  name: "《动手学大模型》系列教程（Lordog/dive-into-llms）",
  mappingCheckedAt: "2026-11-16",
  license: "仅作引用与扩展；保留署名，不复制整本教材。",
};
