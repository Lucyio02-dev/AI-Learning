// Upstream projects are reading references, not copied implementations.
// GitHub stars are a snapshot because repository popularity changes over time.
const checkedOn = "2026-11-17";

export const openSourceCases = [
  {
    id: "nn-zero-to-hero",
    title: "Neural Networks: Zero to Hero · 从微分到训练",
    repository: "karpathy/nn-zero-to-hero",
    url: "https://github.com/karpathy/nn-zero-to-hero",
    stars: 25787,
    license: "MIT",
    checkedOn,
    summary: "一套从基础开始讲神经网络的课程，配套 notebook 逐步搭建反向传播和小型语言模型。适合沿着推导过程读代码。",
    reading: [
      {
        title: "Micrograd：计算图与反向传播",
        path: "lectures/micrograd/micrograd_lecture_first_half_roughly.ipynb",
        url: "https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/micrograd/micrograd_lecture_first_half_roughly.ipynb",
        focus: "跟踪标量运算如何组成计算图，再观察链式法则怎样把梯度传回叶节点。",
      },
      {
        title: "Makemore Part 2：MLP",
        path: "lectures/makemore/makemore_part2_mlp.ipynb",
        url: "https://github.com/karpathy/nn-zero-to-hero/blob/master/lectures/makemore/makemore_part2_mlp.ipynb",
        focus: "把嵌入、线性层、损失和参数更新连成一次真实训练。",
      },
    ],
    lessons: {
      autograd: {
        connection: "本课的计算图与链式法则可以直接对应到 notebook 里的标量 Value 运算。",
        task: "自己画出 a×b+c 的计算图，手推 ∂/∂a；再用中心差分检查一个非线性表达式的解析梯度。把步长从 1e-2 改到 1e-4，记录误差变化。",
        deliverable: "一张计算图、解析梯度与数值梯度对照表，以及误差变大或变小的解释。",
      },
      probopt: {
        connection: "MLP notebook 把损失函数、梯度与参数更新放在同一训练循环里，适合观察优化器实际改变了什么。",
        task: "固定数据、初始化和训练轮数，只改学习率；记录训练/验证损失，并标出收敛慢、稳定收敛或发散的区间。",
        deliverable: "运行配置、两条损失曲线和一句有数据支撑的学习率结论。",
      },
    },
  },
  {
    id: "nanogpt",
    title: "nanoGPT · 可读的小型 GPT 训练骨架",
    repository: "karpathy/nanoGPT",
    url: "https://github.com/karpathy/nanoGPT",
    stars: 64842,
    license: "MIT",
    checkedOn,
    summary: "精简的 GPT 模型和训练循环，便于从数据批次一路跟到 logits 与参数更新。",
    statusNote: "仓库 README 已将 nanoGPT 标为旧项目，并推荐 nanochat。这里把它作为结构清楚的教学样本，不作为新项目选型建议。",
    reading: [
      {
        title: "模型定义 model.py",
        path: "model.py",
        url: "https://github.com/karpathy/nanoGPT/blob/master/model.py",
        focus: "从 token/位置嵌入跟到 Transformer block 和输出 logits，逐层标注张量形状。",
      },
      {
        title: "训练循环 train.py",
        path: "train.py",
        url: "https://github.com/karpathy/nanoGPT/blob/master/train.py",
        focus: "找出训练/验证批次、损失记录、检查点保存和采样分别在哪里发生。",
      },
    ],
    lessons: {
      attention: {
        connection: "模型文件将注意力、残差连接和前馈层放在一条可追踪的前向路径中。",
        task: "任选一个小 batch，沿前向过程画出张量形状；解释因果掩码为何阻止当前位置读取未来 token。再用一个长度为 4 的手工例子验证掩码位置。",
        deliverable: "前向形状图、因果掩码矩阵，以及一段说明错误掩码会造成什么信息泄漏。",
      },
      tensor: {
        connection: "训练脚本把 batch、训练损失、验证损失和检查点连在一起，可以用来检查数据划分是否真的参与评估。",
        task: "沿代码标出训练集与验证集的读取位置，设计一个只交换划分方式的对照，解释为何验证集不能用于梯度更新。",
        deliverable: "训练/验证数据流图和一条明确的数据泄漏检查规则。",
      },
    },
  },
  {
    id: "transformers",
    title: "Hugging Face Transformers · 模型与分词器的统一接口",
    repository: "huggingface/transformers",
    url: "https://github.com/huggingface/transformers",
    stars: 169103,
    license: "Apache-2.0",
    checkedOn,
    summary: "面向文本、视觉、音频和多模态模型的训练与推理框架，适合对照统一 API 与具体模型实现。",
    reading: [
      {
        title: "Tokenizer 总览",
        path: "docs/source/en/tokenizer_summary.md",
        url: "https://github.com/huggingface/transformers/blob/main/docs/source/en/tokenizer_summary.md",
        focus: "区分规范化、切分、特殊 token 与 ID 映射。",
      },
      {
        title: "BERT 模型文档",
        path: "docs/source/en/model_doc/bert.md",
        url: "https://github.com/huggingface/transformers/blob/main/docs/source/en/model_doc/bert.md",
        focus: "把文档参数、输入字段和模型输出与课程中的 Transformer 表示对应起来。",
      },
      {
        title: "LLM 教程",
        path: "docs/source/en/llm_tutorial.md",
        url: "https://github.com/huggingface/transformers/blob/main/docs/source/en/llm_tutorial.md",
        focus: "查看加载 tokenizer/model、生成配置和推理调用的完整顺序。",
      },
    ],
    lessons: {
      tokens: {
        connection: "官方 tokenizer 文档解释输入文本怎样变成模型实际读取的 ID 序列。",
        task: "选同一段中英文和一个专业术语，记录原文、token、token ID 与 token 数；再换一个 tokenizer，分析差异来自哪些切分规则。",
        deliverable: "至少 3 组切分记录，以及对上下文长度估算影响的说明。",
      },
      attention: {
        connection: "BERT 文档和模型接口可以帮助你把 attention mask、hidden states 等概念对上实际输入输出。",
        task: "用固定输入检查 input_ids、attention_mask 和最后一层 hidden state 的形状；遮蔽一个 token 后，说明哪些位置被标记、哪些输出仍需谨慎解释。",
        deliverable: "张量形状表、一次遮蔽对照和对 mask 语义的说明。",
      },
      ch01: {
        connection: "统一的 tokenizer/model/generation 接口适合拆解从权重加载到推理输出的边界。",
        task: "固定模型、输入和随机种子，记录模型 ID、tokenizer、生成配置、输出 token 与耗时；只改一个生成参数做对照。",
        deliverable: "一份可重放的推理配置和两次原始输出，不把一次生成当作模型能力结论。",
      },
    },
  },
  {
    id: "llama-index",
    title: "LlamaIndex · 文档摄取、索引与检索",
    repository: "run-llama/llama_index",
    url: "https://github.com/run-llama/llama_index",
    stars: 52925,
    license: "MIT",
    checkedOn,
    summary: "面向 AI 的文档处理平台，提供从数据接入到索引、检索和查询的构件。",
    reading: [
      {
        title: "Ingestion Pipeline",
        path: "llama-index-core/llama_index/core/ingestion/pipeline.py",
        url: "https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/ingestion/pipeline.py",
        focus: "关注文档进入系统后经过哪些可组合的转换步骤。",
      },
      {
        title: "Vector Store Index",
        path: "llama-index-core/llama_index/core/indices/vector_store/base.py",
        url: "https://github.com/run-llama/llama_index/blob/main/llama-index-core/llama_index/core/indices/vector_store/base.py",
        focus: "沿索引构建、存储与检索接口看数据和元信息如何传递。",
      },
      {
        title: "Vector Retriever 文档",
        path: "docs/api_reference/api_reference/retrievers/vector.md",
        url: "https://github.com/run-llama/llama_index/blob/main/docs/api_reference/api_reference/retrievers/vector.md",
        focus: "查看检索器暴露的参数与结果结构。",
      },
    ],
    lessons: {
      rag: {
        connection: "把本地 RAG 实验中的读取、分块、索引和检索逐一映射到真实框架的流水线边界。",
        task: "准备 20 段带来源 ID 的资料，对比词项基线与向量检索；固定问题集，只改分块策略，记录 hit@3 和失败样例。",
        deliverable: "数据/分块配置、hit@3 对照表、至少 3 个失败样例及其归因。",
      },
    },
  },
  {
    id: "langgraph",
    title: "LangGraph · 有状态、可恢复的 Agent 工作流",
    repository: "langchain-ai/langgraph",
    url: "https://github.com/langchain-ai/langgraph",
    stars: 45053,
    license: "MIT",
    checkedOn,
    summary: "为长运行、有状态的工作流与智能体提供底层构件；README 重点介绍持久执行与人工介入能力。",
    reading: [
      {
        title: "StateGraph 实现",
        path: "libs/langgraph/langgraph/graph/state.py",
        url: "https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/graph/state.py",
        focus: "观察状态 schema、节点和边如何组织成图。",
      },
      {
        title: "Human-in-the-loop 示例",
        path: "examples/human_in_the_loop/wait-user-input.ipynb",
        url: "https://github.com/langchain-ai/langgraph/blob/main/examples/human_in_the_loop/wait-user-input.ipynb",
        focus: "查看流程如何等待人工输入并继续执行。",
      },
      {
        title: "Customer Support 示例",
        path: "examples/customer-support/customer-support.ipynb",
        url: "https://github.com/langchain-ai/langgraph/blob/main/examples/customer-support/customer-support.ipynb",
        focus: "拆解面向具体任务的节点与路由设计。",
      },
    ],
    lessons: {
      agent: {
        connection: "把课程中的工具调用改写成显式状态图，比较固定 workflow 与开放式 Agent 的可控边界。",
        task: "设计“检索→草拟→核验”三节点流程；让核验失败回到草拟，并给高风险动作设置人工确认点。记录每个节点的输入、输出和失败路径。",
        deliverable: "状态字段表、流程图、5 条运行轨迹，以及一次失败后恢复的记录。",
      },
      "agent-safety": {
        connection: "人工确认和状态转换适合作为高风险工具调用的显式安全边界。",
        task: "列出 3 个可自动执行和 3 个必须暂停确认的动作；实现/画出暂停、拒绝、恢复三条分支，并检查拒绝后是否仍有副作用。",
        deliverable: "风险动作表、状态转移图和拒绝路径检查记录。",
      },
    },
  },
  {
    id: "vllm",
    title: "vLLM · 高吞吐推理与服务设计",
    repository: "vllm-project/vllm",
    url: "https://github.com/vllm-project/vllm",
    stars: 97074,
    license: "Apache-2.0",
    checkedOn,
    summary: "面向大模型推理与服务的高吞吐引擎，文档覆盖系统架构、注意力后端与 PagedAttention 等设计。",
    reading: [
      {
        title: "架构总览",
        path: "docs/design/arch_overview.md",
        url: "https://github.com/vllm-project/vllm/blob/main/docs/design/arch_overview.md",
        focus: "先建立请求、调度和模型执行的大致系统图。",
      },
      {
        title: "PagedAttention 设计",
        path: "docs/design/paged_attention.md",
        url: "https://github.com/vllm-project/vllm/blob/main/docs/design/paged_attention.md",
        focus: "把 KV cache 的存储与请求并发问题联系起来。",
      },
      {
        title: "Quickstart",
        path: "docs/getting_started/quickstart.md",
        url: "https://github.com/vllm-project/vllm/blob/main/docs/getting_started/quickstart.md",
        focus: "核对服务启动参数与客户端调用方式。",
      },
    ],
    lessons: {
      ch01: {
        connection: "把本地单条推理提升到服务视角，区分模型正确性、吞吐、延迟与显存占用。",
        task: "给定并发请求数、上下文长度和模型配置，估算 KV cache 随请求增长的趋势；若有兼容 GPU，再固定模型和请求集比较单请求与并发服务的延迟分位数。",
        deliverable: "资源估算表、系统组件图；若实际运行，附环境、原始日志和 p50/p95，不可把文档 benchmark 写成本机结果。",
      },
    },
  },
  {
    id: "lerobot",
    title: "LeRobot · 机器人数据集与策略训练",
    repository: "huggingface/lerobot",
    url: "https://github.com/huggingface/lerobot",
    stars: 28919,
    license: "Apache-2.0",
    checkedOn,
    summary: "以 PyTorch 提供机器人数据、策略和工具，覆盖数据集、策略训练、仿真评估与部署工作流。",
    reading: [
      {
        title: "LeRobotDataset 实现",
        path: "src/lerobot/datasets/lerobot_dataset.py",
        url: "https://github.com/huggingface/lerobot/blob/main/src/lerobot/datasets/lerobot_dataset.py",
        focus: "检查 episode、时间序列观测和动作如何组织。",
      },
      {
        title: "ACT 策略实现",
        path: "src/lerobot/policies/act/modeling_act.py",
        url: "https://github.com/huggingface/lerobot/blob/main/src/lerobot/policies/act/modeling_act.py",
        focus: "观察策略输入输出与动作 chunk 预测。",
      },
      {
        title: "策略 API 文档",
        path: "docs/source/api/policies.mdx",
        url: "https://github.com/huggingface/lerobot/blob/main/docs/source/api/policies.mdx",
        focus: "对照策略接口与训练/评估入口。",
      },
    ],
    lessons: {
      space: {
        connection: "数据集里的每个动作都带着坐标系、单位和时间语义；不能只看张量形状就默认含义一致。",
        task: "抽查 3 条轨迹，逐帧对齐观测与动作时间戳，写清动作是绝对量还是增量、使用哪个参考系，并将一条故障轨迹映射到坐标或时延问题。",
        deliverable: "轨迹数据卡、时间对齐检查表和一条故障归因。",
      },
      policy: {
        connection: "将课程中的行为克隆基线与 LeRobot 的数据集/策略/评估接口对照。",
        task: "按 episode 划分训练与留出评测数据，说明如何防止同一条轨迹泄漏到两边；用本地小仿真比较一个策略在训练分布和新目标上的成功率。",
        deliverable: "数据划分规则、成功率表、失败轨迹归因；若不具备硬件条件，使用课程仿真并把上游代码作为阅读对照。",
      },
    },
  },
  {
    id: "sam2",
    title: "SAM 2 · 图像与视频的提示式分割",
    repository: "facebookresearch/sam2",
    url: "https://github.com/facebookresearch/sam2",
    stars: 20167,
    license: "Apache-2.0",
    checkedOn,
    summary: "Meta 发布的图像/视频提示式分割实现；视频路径使用流式记忆来处理帧间信息。",
    reading: [
      {
        title: "图像分割示例",
        path: "notebooks/image_predictor_example.ipynb",
        url: "https://github.com/facebookresearch/sam2/blob/main/notebooks/image_predictor_example.ipynb",
        focus: "查看点提示、框提示与掩膜输出的完整调用流程。",
      },
      {
        title: "图像预测器",
        path: "sam2/sam2_image_predictor.py",
        url: "https://github.com/facebookresearch/sam2/blob/main/sam2/sam2_image_predictor.py",
        focus: "追踪图像预处理、提示编码与掩膜预测的接口边界。",
      },
      {
        title: "视频分割示例",
        path: "notebooks/video_predictor_example.ipynb",
        url: "https://github.com/facebookresearch/sam2/blob/main/notebooks/video_predictor_example.ipynb",
        focus: "比较逐帧独立分割与跨帧传播问题。",
      },
    ],
    lessons: {
      ch05: {
        connection: "SAM 2 展示了图像/视频提示式分割的工程路径；将它迁移到遥感影像时，地理参考信息需要由栅格数据链路另行保留。",
        task: "在同一组 10 个样本上比较点提示和框提示；用独立标注计算 IoU，并记录边界、阴影、遮挡和尺度变化造成的失败。若处理 GeoTIFF，裁剪时保存 affine transform/CRS，导出掩膜后核验叠加位置。",
        deliverable: "提示策略对照表、IoU 结果、至少 3 个错误案例和 CRS/仿射变换核验截图。",
      },
    },
  },
  {
    id: "geemap",
    title: "geemap · 交互式地理空间分析",
    repository: "gee-community/geemap",
    url: "https://github.com/gee-community/geemap",
    stars: 4072,
    license: "MIT",
    checkedOn,
    summary: "基于 Python 的交互式地理空间分析与可视化工具，可连接 Google Earth Engine，也提供本地地图与格式转换能力。",
    reading: [
      {
        title: "快速开始",
        path: "docs/get-started.md",
        url: "https://github.com/gee-community/geemap/blob/master/docs/get-started.md",
        focus: "先理解交互地图、图层和数据入口。",
      },
      {
        title: "格式转换",
        path: "docs/conversion.md",
        url: "https://github.com/gee-community/geemap/blob/master/docs/conversion.md",
        focus: "核对矢量/栅格交换时 CRS 与数据格式的处理方式。",
      },
      {
        title: "示例索引",
        path: "docs/examples.md",
        url: "https://github.com/gee-community/geemap/blob/master/docs/examples.md",
        focus: "按影像、矢量和专题分析任务挑选最小示例。",
      },
    ],
  },
  {
    id: "odm",
    title: "OpenDroneMap · 航片到正射影像与三维产品",
    repository: "OpenDroneMap/ODM",
    url: "https://github.com/OpenDroneMap/ODM",
    stars: 6603,
    license: "AGPL-3.0",
    checkedOn,
    summary: "开源命令行航测工具链，可从无人机影像生成正射影像、点云、三维模型和 DEM 等产品。",
    reading: [
      {
        title: "README：输入、Docker 运行与输出产品",
        path: "README.md",
        url: "https://github.com/OpenDroneMap/ODM/blob/master/README.md",
        focus: "先核对影像目录约定、命令行入口和结果目录。",
      },
      {
        title: "数据集处理阶段",
        path: "stages/dataset.py",
        url: "https://github.com/OpenDroneMap/ODM/blob/master/stages/dataset.py",
        focus: "从数据集校验入口理解流水线怎样接收影像任务。",
      },
    ],
  },
];

export const getOpenSourceCase = (id) => openSourceCases.find((item) => item.id === id) || null;
export const openSourceCasesForCourse = (courseId) =>
  openSourceCases.filter((item) => item.lessons?.[courseId]).map((item) => ({
    ...item,
    lesson: item.lessons[courseId],
  }));
