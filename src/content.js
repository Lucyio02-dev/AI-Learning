const repo = "https://github.com/Lordog/dive-into-llms/blob/main/documents";
const source = (n, file) => [
  { title: "阅读原教材", kind: "教程", url: `${repo}/chapter${n}/README.md` },
  {
    title: "打开实验 Notebook",
    kind: "Notebook",
    url: `${repo}/chapter${n}/${file}`,
  },
];
const c = (
  id,
  title,
  track,
  prerequisites,
  outcome,
  tags,
  resources,
  lab = null,
  sections = null,
) => ({
  id,
  title,
  track,
  prerequisites,
  outcome,
  tags,
  resources,
  lab,
  sections,
  duration: lab ? 35 : 60,
  level:
    track === "research"
      ? "研究专题"
      : prerequisites.length
        ? "基础 / 进阶"
        : "起步",
});
export const courses = [
  c(
    "foundation",
    "从输入到输出：模型做了什么",
    "common",
    [],
    "区分模型权重、上下文与采样，解释输出为什么变化。",
    ["Token", "上下文", "推理"],
    [
      {
        title: "文本生成与解码",
        kind: "官方文档",
        url: "https://huggingface.co/docs/transformers/main/en/llm_tutorial",
      },
    ],
    "prompt",
    [
      [
        "先建立直觉",
        "模型根据当前输入和已生成内容预测下一个 token。改变输入会改变输出的条件概率分布；常规推理不会因此更新权重。Token 的切分方式取决于 tokenizer，并不固定等于一个字或一个单词。",
      ],
      [
        "先做预测",
        "角色、事实背景和输出格式分别解决什么问题？给模型增加“专家”角色，无法凭空提供它不知道的最新课程规定。",
      ],
      [
        "分开三个变量",
        "模型及版本决定能力基础；上下文提供当前信息；解码影响输出选择。对比 Prompt 时，固定非实验变量，重复运行并保留失败样例。",
      ],
      [
        "解释与迁移",
        "如果同样的提示两次输出不同，先检查采样、版本与完整上下文。进入实验室，判断缺失证据和冲突指令分别需要怎样处理。",
      ],
    ],
  ),
  c(
    "tensor",
    "张量、训练与评估的最小基础",
    "common",
    ["foundation"],
    "读懂输入输出形状，区分训练损失和独立测试表现。",
    ["张量", "梯度", "数据划分"],
    [
      {
        title: "PyTorch 基础教程",
        kind: "官方文档",
        url: "https://docs.pytorch.org/tutorials/beginner/basics/intro.html",
      },
    ],
    null,
    [
      [
        "形状是代码的语言",
        "一批文本可以用 batch、序列长度和表示维度描述。每次变换都应解释输入与输出形状，不能只检查代码是否运行。",
      ],
      [
        "训练和推理",
        "训练使用目标、损失与梯度更新参数；推理使用现有参数计算输出。推理成功不代表模型经过了训练。",
      ],
      [
        "独立验证",
        "先划分数据，再拟合预处理步骤。训练集用于拟合，验证集用于选择设置，测试集用于最终评价。",
      ],
      [
        "动手任务",
        "运行官方分类教程，记录输入形状、训练与验证损失。改变一个因素，保留配置、随机种子并解释结果。",
      ],
    ],
  ),
  c(
    "ch02",
    "Prompt：设计对照，解释变化",
    "llm",
    ["foundation"],
    "区分指令、事实证据和格式，提出可检验的改进。",
    ["Prompt", "结构化输出", "对照"],
    source(2, "dive-prompting.ipynb"),
    "prompt",
    [
      [
        "先定位问题",
        "指令含糊、上下文缺失、要求冲突、能力限制和解析失败需要不同检查方法。保留实际输入输出，再决定修改。",
      ],
      [
        "控制变量",
        "固定模型、样例、版本与采样，只改变一个因素。多样例重复运行，避免把单次成功当作提升。",
      ],
      [
        "格式与事实",
        "JSON 合法不代表内容正确。先验证字段和格式，再核对事实与引用；关键规则需要程序校验。",
      ],
      [
        "验证改进",
        "换一组未参与调试的样例，比较错误类型。记录假设、修改、结果与限制。",
      ],
    ],
  ),
  c(
    "rag",
    "RAG：答案错了，先看证据",
    "llm",
    ["foundation"],
    "区分检索失败、资料过期与缺乏证据的回答。",
    ["RAG", "召回", "诊断"],
    [
      {
        title: "RAG 原论文",
        kind: "论文",
        url: "https://arxiv.org/abs/2005.11401",
      },
    ],
    "rag",
    [
      [
        "沿着数据流检查",
        "文档处理、分块、索引、检索和上下文构造都会影响生成。应能看到证据和中间输出。",
      ],
      [
        "用对照定位",
        "把人工确认的正确证据直接提供给生成环节。如果结果改善，再检查检索；若仍错误，检查上下文构造、指令与模型能力。",
      ],
      [
        "分别评价",
        "检索评价相关证据是否出现；回答评价正确性与引用支持。流畅的表达不能替代事实核验。",
      ],
      [
        "动手观察",
        "实验室实际执行本地词项检索，展示分数、原文与日期。它不调用大模型，方便把检索阶段单独看清。",
      ],
    ],
  ),
  c(
    "agent",
    "Agent：从工具调用到可靠执行",
    "llm",
    ["rag"],
    "选择执行方式，处理超时并核验写入结果。",
    ["Agent", "Workflow", "Function Calling", "状态"],
    [
      {
        title: "Building effective agents",
        kind: "工程实践",
        url: "https://www.anthropic.com/research/building-effective-agents",
      },
      {
        title: "状态与检查点",
        kind: "官方文档",
        url: "https://docs.langchain.com/oss/python/langgraph/persistence",
      },
    ],
    "agent",
    [
      [
        "分配决策",
        "工作流可以包含分支与循环。需要依据未知情况选择下一步时，才考虑模型动态决策。解释质量、延迟和成本取舍。",
      ],
      [
        "请求与执行",
        "模型生成工具名与参数，执行系统负责权限、校验与实际调用。工具返回成功后仍需检查用户目标是否达到。",
      ],
      [
        "重试的语义",
        "读取超时可在预算内重试；参数错误应修正；写入超时可能已经生效，先核验状态，避免重复写入。",
      ],
      [
        "状态与恢复",
        "检查点保存已知状态，但外部系统可能变化。恢复之前核验已发生的动作。实验室是确定性模拟，不连接真实业务系统。",
      ],
    ],
  ),
  c(
    "ch01",
    "微调与部署：先完成一次真实推理",
    "llm",
    ["tensor", "ch02"],
    "加载小模型执行 generate，再建立微调对照。",
    ["微调", "推理", "部署"],
    source(1, "dive-tuning.ipynb"),
    null,
    [
      [
        "运行条件",
        "提供 experiments/inference.py，使用公开小模型在 CPU 执行推理。需要 Python 3.10+、PyTorch、Transformers、网络下载和可用内存。速度取决于设备。",
      ],
      [
        "操作步骤",
        "在独立 Python 环境安装 experiments/requirements.txt，执行 python experiments/inference.py --check 检查依赖，再运行 python experiments/inference.py。该脚本会实际加载 tokenizer、模型并调用 generate。",
      ],
      [
        "验证结果",
        "应看到框架版本、设备、模型标识与实际生成文本。运行成功不代表事实准确。此模型脚本尚未在本机下载权重运行，完整设备兼容性需在执行环境验证。",
      ],
      [
        "继续微调",
        "通过原教材 Notebook 记录数据、配置、基线与微调表现。在独立题集验证提升，并分析能力退化。",
      ],
    ],
  ),
  c(
    "space",
    "空间与动作：坐标错了会发生什么",
    "embodied",
    ["foundation"],
    "区分世界与机体坐标，解释执行偏差。",
    ["坐标变换", "动作", "控制"],
    [
      {
        title: "LeRobot 文档",
        kind: "官方文档",
        url: "https://huggingface.co/docs/lerobot/index",
      },
    ],
    "embodied",
    [
      [
        "观察、状态与动作",
        "观察来自传感器，状态用于决策，动作改变环境。发出指令不代表目标已达到。",
      ],
      [
        "指定参考系",
        "机体的前方和世界 x 轴未必一致。二维机体向量通过旋转矩阵转换为世界向量，角度与距离单位需要统一。",
      ],
      [
        "预测再执行",
        "朝向 90° 的机器人前进会到哪里？在实验室比较直接使用世界位移和正确坐标转换，检查位置误差。",
      ],
      [
        "恢复与观察",
        "动作可能已经改变物理场景。继续执行前重新观察与估计状态，不能直接假设场景与检查点相同。",
      ],
    ],
  ),
  c(
    "policy",
    "从轨迹数据走向模仿学习与 VLA",
    "embodied",
    ["tensor", "space", "ch05"],
    "读懂观察与动作序列，设计闭环策略评测。",
    ["模仿学习", "VLA", "轨迹"],
    [
      {
        title: "LeRobot 教程与仿真",
        kind: "官方文档",
        url: "https://huggingface.co/docs/lerobot/index",
      },
    ],
    null,
    [
      [
        "检查轨迹",
        "逐帧检查图像、状态、动作与时间戳，明确动作是位置、速度还是增量，以及观察与动作是否对齐。",
      ],
      [
        "模仿与闭环",
        "离线损失降低不保证执行成功，策略自己的偏差会改变后续观察分布。",
      ],
      [
        "视觉、语言与行动",
        "检查新指令、物体与场景，区分训练条件内与新条件下的成功率。",
      ],
      [
        "实验安排",
        "通过官方教程选择受支持的仿真环境，记录版本、策略、任务与种子。本页是外部学习指南；平台二维演示不属于策略训练。",
      ],
    ],
  ),
  c(
    "ch05",
    "多模态：图像证据与空间关系",
    "llm",
    ["tensor", "foundation"],
    "分析图文输入与视觉失败案例。",
    ["多模态", "VLM"],
    source(8, "mllms.ipynb"),
  ),
  c(
    "ch03",
    "知识编辑：修改与副作用",
    "research",
    ["ch01"],
    "比较编辑成功率、泛化与局部性。",
    ["知识编辑", "泛化"],
    source(3, "dive_edit.ipynb"),
  ),
  c(
    "ch04",
    "数学推理与监督微调",
    "research",
    ["ch01"],
    "在独立题集上验证推理变化。",
    ["数学", "推理", "蒸馏"],
    source(4, "sft_math.ipynb"),
  ),
  c(
    "ch08",
    "模型水印：检测与鲁棒性",
    "research",
    ["tensor"],
    "比较检测性能、误报与改写影响。",
    ["水印", "检测"],
    source(5, "watermark.ipynb"),
  ),
  c(
    "jailbreak",
    "模型安全：攻击与防御评估",
    "research",
    ["ch02"],
    "在受控样例中比较安全与可用性。",
    ["安全", "评估"],
    source(6, "dive-jailbreak.ipynb"),
  ),
  c(
    "stega",
    "大模型隐写：隐藏信息与验证",
    "research",
    ["tensor"],
    "分析信息恢复与文本质量权衡。",
    ["隐写"],
    source(7, "llm_stega.ipynb"),
  ),
  c(
    "ch10",
    "GUI 智能体：观察与操作",
    "llm",
    ["agent", "ch05"],
    "定义可观察任务与恢复策略。",
    ["GUI Agent", "规划"],
    source(9, "GUIagent.ipynb"),
  ),
  c(
    "agent-safety",
    "智能体安全与任务边界",
    "research",
    ["agent"],
    "设计权限边界并验证结果。",
    ["安全", "权限"],
    source(10, "agent.ipynb"),
  ),
  c(
    "ch11",
    "RLHF：对齐与评价",
    "research",
    ["ch01"],
    "区分优化目标与实际行为。",
    ["RLHF", "对齐"],
    source(11, "RLHF.ipynb"),
  ),
];
export const tracks = {
  all: "全部课程",
  common: "公共基础",
  llm: "大模型开发",
  embodied: "具身智能",
  research: "研究专题",
};
export const labInfo = {
  prompt: {
    title: "Prompt 对照",
    subtitle: "先判断缺的是什么，再改输入",
    kind: "规则教学演示",
    course: "ch02",
  },
  rag: {
    title: "RAG 诊断",
    subtitle: "沿着检索证据定位错误",
    kind: "浏览器实际词项检索",
    course: "rag",
  },
  agent: {
    title: "Agent 故障演练",
    subtitle: "超时后，重试还是核验？",
    kind: "确定性流程模拟",
    course: "agent",
  },
  embodied: {
    title: "空间与动作",
    subtitle: "转动参考系，观察执行轨迹",
    kind: "二维运动学演示",
    course: "space",
  },
};
export const projects = [
  {
    id: "assistant",
    title: "让课程资料助手值得信任",
    tag: "大模型 · 工程 / 产品",
    summary: "从找到证据，到解释错误，再到可靠执行工具。",
    steps: [
      ["foundation", "解释模型输入与输出"],
      ["rag", "运行检索并定位错误"],
      ["agent", "处理一次写入超时"],
    ],
    questions: [
      "服务谁，什么结果算成功？",
      "为什么选择检索、工作流或 Agent？",
      "哪些错误最影响目标？",
      "修改前后的证据是什么？",
    ],
  },
  {
    id: "robot",
    title: "让机器人走到正确的位置",
    tag: "具身智能 · 仿真起步",
    summary: "理解参考系，分析轨迹，为闭环策略设计评测。",
    steps: [
      ["space", "解释坐标与动作"],
      ["space", "完成坐标诊断实验"],
      ["policy", "设计策略评测"],
    ],
    questions: [
      "观察、状态、动作分别是什么？",
      "动作使用哪个参考系与单位？",
      "失败发生在哪个环节？",
      "怎样验证新场景中的表现？",
    ],
  },
];
export const getCourse = (id) => courses.find((c) => c.id === id) || courses[0];
export const getSections = (c) =>
  c.sections || [
    ["研究问题", c.outcome],
    [
      "建立基线",
      "运行原教材最小实验，记录模型、数据、版本和配置。保存原始输出，明确指标定义。",
    ],
    ["修改与对照", "写下假设，只改变一个因素，在独立样例上分析提升与副作用。"],
    [
      "形成证据",
      "记录结果、失败类型、适用范围和下一步。本页是外部专题指南，完整实验请进入原教材。",
    ],
  ];
