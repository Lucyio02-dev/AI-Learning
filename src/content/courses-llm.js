// 大模型方向课程数据。ch02/rag/agent/ch01/ch05 沿用既有稳定 ID。
const llmRepo = "https://github.com/Lordog/dive-into-llms/blob/main/documents";
const ref = (chapter, file, title = "原教材对应章节") => ({
  title,
  kind: "教程",
  url: `${llmRepo}/chapter${chapter}/${file}`,
  verified: { date: "2026-11-16", env: "GitHub 公开仓库（链接可达性核对）" },
});

export const coursesLlm = [
  {
    id: "tokens",
    title: "Token 与嵌入：模型眼中的文字",
    track: "llm",
    prerequisites: ["foundation"],
    outcome: "解释 BPE 切分规则，计算一个字符串的 token 数，用嵌入向量解释“语义距离”，识别嵌入相似性的三个常见误读。",
    tags: ["Tokenizer", "BPE", "Embedding", "余弦相似度"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 1 },
    minutes: { value: 45, basis: "estimate" },
    cost: "免费。浏览器内互动；可选 Python tokenizer 对照。",
    conditions: "浏览器即可。",
    problem:
      "API 按 token 计费，你数的是字符数；同一句话英文 12 个 token、中文可能是 25 个；“模型不认识‘defenestration’”可能只是它被切成了罕见碎片。",
    predict: "“learning”与“learn”的嵌入余弦相似度，和“learning”与“breakdancing”比，谁更高？边界在哪？",
    steps: [
      {
        title: "BPE：从字节到词表",
        body:
          "BPE 从字节出发，迭代合并语料中最高频的相邻对，直到词表达到预设大小。高频词成为单个 token，罕见词被拆成碎片。因此 token 数不等于字符数也不等于词数，且随语言与领域变化。",
        formulas: [
          {
            name: "嵌入查表",
            expr: "e = E[token_id]，E ∈ R^{|V|×d}",
            dims: "d 为嵌入维度（如 576 for SmolLM2-135M）",
            note: "嵌入是查表操作，训练后同一 token 的向量固定。",
          },
          {
            name: "余弦相似度",
            expr: "cos(a,b) = a·b / (|a||b|)",
            dims: "a,b ∈ R^d → 标量 [-1,1]",
            note: "度量方向而非长度。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "from transformers import AutoTokenizer\n"
            + "tok = AutoTokenizer.from_pretrained(\"HuggingFaceTB/SmolLM2-135M-Instruct\")\n"
            + "for s in [\"learning\", \"learning to learn\", \"好好学习，天天向上\"]:\n"
            + "    ids = tok.encode(s)\n"
            + "    print(len(s), len(ids), tok.convert_ids_to_tokens(ids))",
          expected:
            "英文单词通常 1-3 个 token；中文常见 1 字 1-2 个 token。具体数字以输出为准（记录到实验日志）。",
        },
        pitfalls: [
          "用 len(str) 估算 API 成本——token 数才是计费与上下文窗口单位。",
          "假设 tokenizer 无损可读：切分结果与拼写直觉不一致是常态。",
        ],
      },
      {
        title: "嵌入与语义距离",
        body:
          "嵌入模型把文本映射到向量，使语义相近的文本方向接近。“learning/learn”确实更近，但相似度也受词频、多义与领域影响；余弦高不代表可互换，只代表分布上共现。",
        code: {
          lang: "python",
          run: "python",
          src:
            "# 真实本地嵌入：见 RAG 实验室的 embedding 引擎（bge-small-zh，CPU）\n"
            + "python experiments/rag_embed.py query --texts \"learning\" \"learn\" \"breakdancing\"",
          expected: "输出两两余弦相似度矩阵；learning/learn 显著高于其余对。",
        },
        modify: {
          brief: "换 3 组词对（同义/相关/无关），先预测排序，再用真实嵌入验证。",
          starter: "替换 --texts 参数。",
          checks: ["预测与结果差异有解释", "引用了具体数值"],
        },
      },
      {
        title: "诊断三个误读",
        body:
          "① 余弦 0.8 ≠ 80% 相同；② 嵌入对否定/数字常常不敏感——“不能退选”与“可以退选”可能非常近；③ 单 token 嵌入不等于整句语义，句子级要用句子嵌入或池化。",
        modify: {
          brief: "构造一对否定句，测其余弦相似度，展示“嵌入不擅长什么”。",
          starter: "用 rag_embed.py query --texts \"可以退选\" \"不能退选\"。",
          checks: ["给出数值", "说明对检索系统的影响与对策（如结合词项/规则过滤）"],
        },
      },
      {
        title: "独立验证",
        body: "把本课结论放到未见样例上：选 5 个你领域的词对，写出预测-结果表。",
        verify: {
          task: "预测/结果/解释三列表格。",
          evidence: "嵌入数值记录。",
        },
        limits: "SmolLM2 tokenizer 与商用模型词表不同，token 数结论不可跨模型复用。",
      },
    ],
    depths: {
      intuition: "tokenizer 像“高频词缩写表”；嵌入像“词语的坐标”，方向接近=常一起出现。",
      engineering: "上下文窗口按 token 计；预算与截断策略必须用真实 tokenizer 计算；嵌入模型选型看语言/维度/许可。",
      research: "词表规模与多语性能的权衡、字节级 tokenizer、嵌入几何与可解释性。",
    },
    references: [
      {
        title: "HF Tokenizers 文档",
        kind: "官方文档",
        url: "https://huggingface.co/docs/transformers/main/en/main_classes/tokenizer",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
      ref(1, "dive-tuning.ipynb", "原教材第 1 章（含 tokenizer 使用）"),
    ],
    quiz: [
      {
        id: "tokens-q1",
        kind: "explain",
        capability: "explained",
        prompt: "为什么中文文本的“token/字符”比通常高于英文？用 BPE 机制解释。",
        rubric: ["高频子词合并依赖训练语料", "中文语料占比影响合并次数", "字符→多 token"],
      },
    ],
  },
  {
    id: "attention",
    title: "Attention 与 Transformer：上下文如何被读取",
    track: "llm",
    prerequisites: ["tokens", "vector"],
    outcome: "手算一个 2-token 的注意力权重，解释 Q/K/V 的分工与因果掩码，画出 Transformer block 的数据流。",
    tags: ["Attention", "QKV", "因果掩码", "Transformer"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 1 },
    minutes: { value: 50, basis: "estimate" },
    cost: "免费（浏览器互动）。",
    conditions: "浏览器即可。",
    problem:
      "“小明把书放回架子，因为它很有趣”——“它”指书还是架子？模型需要一种机制让每个位置“回看”上文并加权聚焦，这就是注意力。",
    predict: "去掉因果掩码后，训练出的模型还能做文本续写吗？它在“偷看”什么？",
    steps: [
      {
        title: "Q/K/V 的分工",
        body:
          "每个 token 的向量经三个投影得到 Query（我在找什么）、Key（我能提供什么）、Value（我的内容）。注意力分数 = Query·Key/√d_k，softmax 后对 Value 加权求和——每个位置的新表示是全上下文的信息混合。",
        formulas: [
          {
            name: "缩放点积注意力",
            expr: "Attention(Q,K,V) = softmax(QKᵀ/√d_k)V",
            dims: "Q,K:[B,H,S,d_k]，V:[B,H,S,d_v] → [B,H,S,d_v]",
            note: "除以 √d_k 防止大维度导致 softmax 饱和。",
          },
          {
            name: "因果掩码",
            expr: "score[i,j] = -∞ 当 j > i",
            dims: "掩码形状 [S,S]，广播到 [B,H,S,S]",
            note: "保证位置 i 只能看到 ≤i 的历史。",
          },
        ],
        code: {
          lang: "javascript",
          run: "browser",
          src:
            "// 2-token 手算示例（可在控制台运行）\n"
            + "const softmax = a => { const m = Math.max(...a); const e = a.map(v => Math.exp(v - m)); const s = e.reduce((x,y)=>x+y); return e.map(v=>v/s); };\n"
            + "const q = [1, 0], k0 = [1, 0], k1 = [0, 1], v0 = [2, 0], v1 = [0, 3];\n"
            + "const dk = Math.sqrt(2);\n"
            + "const s = softmax([q.map((x,i)=>x*k0[i]).reduce((a,b)=>a+b)/dk,\n"
            + "                   q.map((x,i)=>x*k1[i]).reduce((a,b)=>a+b)/dk]);\n"
            + "console.log(s, s[0]*v0[0]+s[1]*v1[0], s[0]*v0[1]+s[1]*v1[1]);",
          expected: "softmax([0.707,0])≈[0.669,0.331]，输出 ≈ [1.338, 0.993]。",
        },
        pitfalls: [
          "忘了除 √d_k，长上下文时分布尖锐。",
          "掩码加在 softmax 之后——必须在分数上加 -∞ 再 softmax。",
          "多头只是把 d 拆成 H 份分别算再拼回，参数量近似不变。",
        ],
      },
      {
        title: "Transformer block 数据流",
        body:
          "x → LN → attention → 残差相加 → LN → MLP → 残差相加，堆叠 N 层。残差让梯度直达底层，MLP 提供逐位置非线性变换。",
        formulas: [
          {
            name: "参数量速算",
            expr: "每层 ≈ 4d² (attention) + 8d² (SwiGLU MLP)",
            dims: "d 为隐藏维度",
            note: "用于估算 SmolLM2-135M：层数×每层参数+嵌入。",
          },
        ],
        modify: {
          brief: "把上面 JS 示例的 q 改为 [0,1]，先预测输出，再运行验证。",
          starter: "改 q 数组。",
          checks: ["预测正确", "能解释为何输出变为 v1 主导"],
        },
      },
      {
        title: "诊断注意力误区",
        body:
          "① “注意力权重=可解释性”并不严格——权重高不等于因果贡献；② 长上下文外推失败常因位置编码而非注意力本身；③ KV cache 只缓存 K/V，Query 每步重算。",
        modify: {
          brief: "在实验页里把因果掩码开关切换，观察同一输入的输出差异。",
          starter: "使用张量/注意力互动实验。",
          checks: ["能说出掩码改变的信息流方向"],
        },
      },
      {
        title: "验证",
        body: "用真实小模型验证上下文的作用：同一问题，一次给足线索、一次不给，比较输出（inference.py）。",
        verify: {
          task: "两次运行记录 + 输出差异一句话解释。",
          evidence: "JSON 运行记录 ×2。",
        },
        limits: "135M 模型的注意力模式与百亿级模型定性相似但细节不同，不宜外推。",
      },
    ],
    depths: {
      intuition: "每个字开一盏探照灯，照亮上文里与它相关的字，再按亮度取材料。",
      engineering: "KV cache、GQA/MQA、FlashAttention、长上下文的 RoPE 外推与窗口策略。",
      research: "注意力可解释性、稀疏/线性注意力、状态空间模型替代方案的边界比较。",
    },
    references: [
      {
        title: "The Illustrated Transformer（Jay Alammar）",
        kind: "图解教程",
        url: "https://jalammar.github.io/illustrated-transformer/",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
      {
        title: "Attention Is All You Need（原论文）",
        kind: "论文",
        url: "https://arxiv.org/abs/1706.03762",
        verified: { date: "2026-11-16", env: "arXiv" },
      },
    ],
    quiz: [
      {
        id: "attention-q1",
        kind: "explain",
        capability: "explained",
        prompt: "为什么注意力分数要除以 √d_k？不除会发生什么？",
        rubric: ["点积方差随维度增长", "softmax 饱和→梯度消失", "除以 √d 保持方差稳定"],
      },
    ],
  },
  {
    id: "sampling",
    title: "采样、幻觉与能力边界",
    track: "llm",
    prerequisites: ["attention"],
    outcome: "对比贪心/温度/top-p 采样的输出差异，解释幻觉的机制性原因，划定“模型能可靠做什么”的证据边界。",
    tags: ["采样", "温度", "幻觉", "校准"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 1 },
    minutes: { value: 40, basis: "estimate" },
    cost: "免费（本地小模型）；可选真实 API 对照。",
    conditions: "Python 环境 + 已下载的 SmolLM2；API 对照需后端。",
    problem:
      "同一个问题问三遍得到三个不同的日期——哪个是真的？模型“一本正经地胡说”时，它自己在撒谎，还是在执行你的采样指令？",
    predict: "temperature=0 与 1.5 各跑 3 次，哪组输出更稳定？稳定就等于正确吗？",
    steps: [
      {
        title: "解码策略",
        body:
          "贪心取 argmax；温度 τ 缩放 logits 改变分布陡峭度；top-p 只保留累计概率 p 的候选。τ→0 趋向贪心；τ 高增加多样性与胡说概率。",
        formulas: [
          {
            name: "温度采样",
            expr: "p_i ∝ exp(z_i / τ)",
            dims: "z ∈ R^{|V|}，τ>0",
            note: "τ=1 恢复原分布；logits 缩放不改变 argmax。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "python experiments/inference.py --sample --seed 7 --max-new-tokens 64 \\\n"
            + "  --prompt \"列出三种常见幻觉类型\"\n"
            + "# 对比贪心：去掉 --sample 再跑一次",
          expected: "采样版每次不同；贪心版逐字节一致（同版本同硬件）。",
        },
        pitfalls: [
          "把“随机性”当“创造性”不加控制地用于事实型任务。",
          "评测时不固定采样参数，跑分不可比。",
        ],
      },
      {
        title: "幻觉的机制",
        body:
          "幻觉多数不是“说谎”，而是模型对缺失证据的流畅补全：训练目标奖励“像样的续写”，不奖励“承认不知道”。事实型输出的可靠性必须靠外部证据（检索/工具）与校验，而非模型自觉。",
        modify: {
          brief: "问 SmolLM2 一个不存在的事实（编造的校规编号），观察它是编造还是拒绝；再提供资料后重问。",
          starter: "inference.py --prompt。",
          checks: ["记录原始输出", "补证据后输出变化", "得出“证据优先”结论"],
        },
      },
      {
        title: "诊断输出不稳定",
        body:
          "先查采样参数是否一致 → 再查模型版本 → 最后才谈“能力差异”。对照实验必须固定非实验变量。",
        modify: {
          brief: "构造一张 3 参数 × 2 值的对照表（τ、top-p、种子），运行并记录稳定性差异。",
          starter: "用后端 Prompt 实验室的批量运行。",
          checks: ["变量单一", "重复次数足够"],
        },
      },
      {
        title: "能力边界",
        body:
          "模型可靠做：改写、总结、按给定材料回答、代码草稿。不可靠做：精确算术、未提供来源的事实、实时信息。边界要用你自己的小评测确认，不照抄宣传。",
        verify: {
          task: "对你的使用场景列出 3 项“可托付”与 3 项“必须核验”。",
          evidence: "每项至少 1 次真实运行记录支持。",
        },
        limits: "本课用 135M 模型；其幻觉率高于商用模型，用于观察机制而非评估产品。",
      },
    ],
    depths: {
      intuition: "采样像掷一个被 τ 调过偏的骰子；幻觉是“没有资料的题也硬编”。",
      engineering: "事实型用 τ≈0 + 结构化校验 + 引用核验；创意型适度调 τ；全链路记录参数。",
      research: "校准与置信度表达、检索增强的事实性、幻觉评测集（TruthfulQA 类）。",
    },
    references: [
      {
        title: "How to generate text（HF 博客）",
        kind: "工程实践",
        url: "https://huggingface.co/blog/how-to-generate",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "sampling-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "评测同事说“新模型更聪明因为输出更多样”，你会检查什么？",
        rubric: ["采样参数是否一致", "多样性≠正确性", "要求固定变量重测"],
      },
    ],
  },
  {
    id: "ch02",
    title: "Prompt 工程：设计对照，解释变化",
    track: "llm",
    prerequisites: ["foundation"],
    outcome: "用单变量对照与批量重复评估 Prompt 修改，在未见样例上验证改进，并区分格式、事实与指令冲突三类失败。",
    tags: ["Prompt", "对照实验", "结构化输出", "评估"],
    level: "基础",
    lab: "prompt",
    sourceRef: { textbook: "dive-into-llms", chapter: 2 },
    minutes: { value: 50, basis: "estimate" },
    cost: "规则模式免费；真实模式按模型调用计费（估算显示在实验室）。",
    conditions: "规则模式浏览器即可；真实模式需本地后端 + 服务器端密钥。",
    problem:
      "你在群里看到“加了这句话准确率提升 30%”。复现时却没变化——原帖没说模型版本、样例与采样。如何做出自己可信的 Prompt 结论？",
    predict: "实验室“冲突指令”用例：同时要求“只输出 JSON”与“只输出一段自然语言”，预测模型行为与正确修法。",
    steps: [
      {
        title: "拆解 Prompt 的成分",
        body:
          "角色（风格与先验）、指令（做什么）、事实/知识（背景材料）、约束（不许什么）、输出格式（给谁解析）。失败时先判断成分错哪一类：指令含糊、证据缺失、约束冲突、格式解析失败，各有不同修法。",
        formulas: [
          {
            name: "对照实验设计",
            expr: "一次只改一个成分；重复 n 次；报告通过率",
            dims: "通过率 = 通过样例数 / 样例数",
            note: "n 太小（<5）时差异可能是噪声。",
          },
        ],
        code: {
          lang: "text",
          run: "browser",
          src:
            "# 变量分离模板（实验室内置）\n"
            + "角色：{可选}\n"
            + "任务：回答“退选截止时间”\n"
            + "事实：{规定正文，或无}\n"
            + "格式：{JSON | 自然语言 | 冲突（同时要求两者）}",
          expected: "实验室用固定变量矩阵运行，输出每格结果与失败原因分类。",
        },
        pitfalls: [
          "一次改三处再说“变好了”。",
          "用模型喜欢的话术代替事实补充。",
          "JSON 模式下忘了校验字段完整性。",
        ],
      },
      {
        title: "运行对照（规则模式入门）",
        body:
          "实验室的规则模式用确定性规则演示三类失败：证据缺失时模型无法回答事实；冲突指令导致不确定行为；格式校验独立于内容正确。先在此理解变量，再切真实模式。",
        code: {
          lang: "javascript",
          run: "browser",
          src:
            "// 真实模式由后端代理调用；这里展示请求结构\n"
            + "// POST /api/model/chat\n"
            + "{ \"messages\": [{\"role\":\"user\",\"content\":\"…\"}],\n"
            + "  \"sampling\": {\"temperature\":0, \"maxTokens\":256},\n"
            + "  \"variant\": \"evidence-only\" }",
          expected: "响应含文本、用量（tokens）与耗时；密钥不出服务器。",
        },
        modify: {
          brief: "在真实模式下用“单变量差异”功能：同一 Prompt 生成 A/B 两版，只改格式要求，批量跑 5 个样例。",
          starter: "实验室 → Prompt → 新建变体。",
          checks: ["每版 5 样例", "报告通过率而非单次印象", "保留失败样例"],
        },
      },
      {
        title: "自动校验与失败归因",
        body:
          "结构校验用程序（JSON schema/正则）；内容校验用“明确任务 + 证据”的量规（人工或 AI 辅助，需人工抽查）。失败样例要归因：格式错、事实错、还是任务理解错。",
        modify: {
          brief: "给 JSON 输出加 schema 校验器，把 10 次运行中格式失败与事实失败分开统计。",
          starter: "实验室内置校验开关。",
          checks: ["两类失败分开计数", "至少 1 个失败样例被正确归因"],
        },
      },
      {
        title: "未见样例验证",
        body:
          "把用于调试的样例搁置，另取 5 个新样例复测。改进若只在调试样例上成立，是过拟合 Prompt，不是提升。",
        verify: {
          task: "调试样例与保留样例各 5 个的通过率对比。",
          evidence: "实验室运行记录（含模型版本与参数）。",
        },
        limits: "Prompt 效果依赖模型版本；版本升级后需重测。规则模式结论不适用于真实模型行为。",
      },
    ],
    depths: {
      intuition: "Prompt 是“给实习生写的工单”：任务、材料、格式、禁区写清楚，别指望它读心。",
      engineering: "Prompt 作为带版本号的资产进仓库；评审变更像代码一样；线上 A/B 用固定评测集。",
      research: "Prompt 敏感性、自一致性（self-consistency）、少样本选择策略与任务迁移。",
    },
    references: [
      ref(2, "dive-prompting.ipynb", "原教材第 2 章 Notebook"),
      {
        title: "OpenAI Prompt engineering guide",
        kind: "官方文档",
        url: "https://platform.openai.com/docs/guides/prompt-engineering",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "ch02-q1",
        kind: "unseen",
        capability: "verified",
        prompt: "有人声称“加了‘一步步思考’后在数学题上从 40%→70%”。设计一个最小对照实验验证或反驳。",
        rubric: ["固定模型/采样", "两版各≥10 题", "未见样例", "报告通过率与置信"],
      },
    ],
  },
  {
    id: "rag",
    title: "RAG：答案错了，先看证据",
    track: "llm",
    prerequisites: ["ch02", "tokens"],
    outcome: "搭建分块-索引-检索-生成流水线，用检索与回答分开的指标定位失败环节，处理版本冲突与无证据回答。",
    tags: ["RAG", "分块", "向量检索", "引用核验"],
    level: "基础",
    lab: "rag",
    sourceRef: { textbook: "dive-into-llms", chapter: 2 },
    minutes: { value: 60, basis: "estimate" },
    cost: "本地嵌入免费；生成回答按 API 用量计费（小额）。",
    conditions: "词项基线浏览器即可；embedding 与生成需本地后端。",
    problem:
      "校园助手回答“退选截止时间是第二周周日”——这是去年的规定。资料库同时有新旧两版，检索把两条都给了模型。错误出在数据、检索、上下文还是生成？",
    predict: "只检索当前版本后，如果回答仍然错误，最可能的环节是什么？",
    steps: [
      {
        title: "流水线与分块",
        body:
          "文档 → 清洗 → 分块（大小/重叠）→ 索引（词项/向量）→ 检索 Top-K → 上下文构造 → 生成 → 引用核验。分块过碎丢上下文，过大稀释相关度；重叠缓解边界切断。",
        formulas: [
          {
            name: "词项检索（基线）",
            expr: "score = Σ_qtf · 命中数",
            dims: "BM25/TF-IDF 变体；本实验用加权命中计数",
            note: "不含语义，专抓关键词。",
          },
          {
            name: "向量检索",
            expr: "cos(e_q, e_chunk) 排序取 Top-K",
            dims: "e ∈ R^d（bge-small-zh: d=512）",
            note: "语义近似，对否定/数字弱。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "# 真实 embedding 索引构建（CPU，首次下载约 110MB 模型）\n"
            + "python experiments/rag_embed.py index \\\n"
            + "  --input artifacts/rag/corpus.jsonl --out artifacts/rag/index-default",
          expected: "生成 vectors.npy + meta.json（记录模型、维度、分块参数、构建时间）。",
        },
        pitfalls: [
          "不分块直接整文档嵌入，长文档相似度被稀释。",
          "只看最终答案，不看检索证据——无法归因。",
          "把检索分数当正确性分数。",
        ],
      },
      {
        title: "检索与生成分开评",
        body:
          "检索指标：命中/未命中（正确证据是否出现在 Top-K）；回答指标：有据正确/无据编造/引用错误。两套指标分开记录才能定位：检索差→改检索；检索好回答差→查上下文构造或生成。",
        code: {
          lang: "javascript",
          run: "browser",
          src:
            "// 实验室内置标注集（5 题）+ 未见样例（3 题）\n"
            + "// 每题字段：question, goldChunks[], mustCite, forbidden\n"
            + "// 运行后输出：retrievalHit@k, answerGrounded, citationExact",
          expected: "分组指标表，失败样例可展开看完整上下文。",
        },
        modify: {
          brief: "把 Top-K 从 2 改到 6，观察检索命中率与上下文噪声（无关块混入）的变化。",
          starter: "实验室 RAG 控制面板。",
          checks: ["两条曲线/表", "给出你选择的 K 与理由"],
        },
      },
      {
        title: "故障注入定位",
        body:
          "实验室支持注入：版本冲突（新旧并存）、资料缺失（当前规定被移除）、错误召回（不相关高分）、上下文截断（证据被挤掉）、证据未使用（模型忽略）、无依据回答。每种故障对应不同修复。",
        modify: {
          brief: "开启“版本冲突”，先预测错误类型，运行后核对；再用“人工指定正确证据”区分检索失败与生成失败。",
          starter: "RAG 实验室故障开关。",
          checks: ["预测先行", "用 gold-evidence 对照法完成归因"],
        },
      },
      {
        title: "验证与更新",
        body:
          "资料更新后重建索引并重跑固定评测集；索引元数据记录资料版本。未标注的新题先小规模人工核对再入库。",
        verify: {
          task: "对 3 个未见问题跑完整流水线，报告检索/回答两组指标。",
          evidence: "运行记录 + 指标表。",
        },
        limits: "演示语料为校园规定类短文档；长文档/表格/多模态资料需要额外处理。",
      },
    ],
    depths: {
      intuition: "开卷考试：先把相关的几页翻出来（检索），再照着页码答题（生成）；没翻到那一页就答，就是编。",
      engineering: "元数据过滤（日期/版本/权限）前置到检索层；引用回链原文；上下文预算按 token 管理。",
      research: "混合检索（BM25+向量）、rerank、RAGAS 类评估框架、长上下文 vs RAG 的边界。",
    },
    references: [
      {
        title: "RAG 原论文（Lewis et al., 2020）",
        kind: "论文",
        url: "https://arxiv.org/abs/2005.11401",
        verified: { date: "2026-11-16", env: "arXiv" },
      },
      ref(2, "dive-prompting.ipynb", "原教材第 2 章（含 RAG 相关 Prompt 实践）"),
    ],
    quiz: [
      {
        id: "rag-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "回答错误且引用了错误的段落。给出你的归因步骤与三种可能。",
        rubric: ["检索命中但排序差", "生成忽略证据", "gold-evidence 对照法"],
      },
      {
        id: "rag-q2",
        kind: "unseen",
        capability: "verified",
        prompt: "用户上传了一版 2027 新规定，助手仍引用 2026 旧文。设计修复方案并说明如何验证。",
        rubric: ["元数据版本过滤", "重建索引", "回归评测"],
      },
    ],
  },
  {
    id: "agent",
    title: "Agent 与 Workflow：从工具调用到可靠执行",
    track: "llm",
    prerequisites: ["rag"],
    outcome: "为任务选择合适的执行架构（规则/单次调用/工作流/Agent），为工具定义 schema 与权限，用幂等与检查点处理超时并核验目标达成。",
    tags: ["Agent", "Workflow", "Function Calling", "幂等", "检查点"],
    level: "进阶",
    lab: "agent",
    sourceRef: { textbook: "dive-into-llms", chapter: 10 },
    minutes: { value: 60, basis: "estimate" },
    cost: "规则/模拟模式免费；真实工具执行免费（本地模拟器）；真实模型决策按用量计费。",
    conditions: "浏览器即可；检查点持久化在本机存储；真实模型决策需后端。",
    problem:
      "你的预约助手发起写入后客户端超时。它不知道服务端是否已提交。原样重试可能创建两条预约；直接放弃可能漏约。工具调用成功≠任务成功。",
    predict: "恢复时应该先做什么？判断依据是什么？重试写入与状态核验的成本差异？",
    steps: [
      {
        title: "架构选择",
        body:
          "规则脚本：流程固定、无分支判断，最便宜最可控。单次模型调用：一次决策完成简单任务。工作流：预定义分支/循环，代码控制流程，模型只在节点内干活。Agent：模型在运行中动态决定下一步——只在确实需要动态决策时使用，代价是成本、延迟与不可预测性。",
        formulas: [
          {
            name: "取舍矩阵",
            expr: "质量 × 成本 × 延迟 × 可维护性",
            dims: "每项 1-5 分，按任务加权",
            note: "能用工作流就不用 Agent。",
          },
        ],
        code: {
          lang: "text",
          run: "browser",
          src:
            "# 任务：帮我预约周五下午的实验室\n"
            + "规则脚本：查空位→填表→提交→核验，无 LLM\n"
            + "单次调用：LLM 解析自然语言→结构化参数→脚本执行\n"
            + "工作流：解析→校验→多轮澄清（循环）→执行→核验\n"
            + "Agent：LLM 自主选择工具序列（含重试/放弃决策）",
          expected: "实验室提供同一任务四种架构的可运行对照。",
        },
        pitfalls: [
          "把模型生成的“工具请求”当成“已执行”——中间隔着执行系统的校验与真实副作用。",
          "对读取超时盲目重试没问题，对写入超时照抄同样的重试逻辑。",
        ],
      },
      {
        title: "工具契约与权限",
        body:
          "每个工具声明 schema（名称、参数类型、必填、范围）、权限（谁能调、何时可调）、副作用类别（只读/写入）与幂等键规则。执行系统校验后才调用；错误分类返回（参数错/权限不足/超时/空结果）。",
        formulas: [
          {
            name: "幂等写入",
            expr: "server: if request_id 已存在 → 返回原结果",
            dims: "request_id: UUID",
            note: "同一 request_id 重试不会产生第二条记录。",
          },
        ],
        code: {
          lang: "javascript",
          run: "browser",
          src:
            "// 实验室工具注册（片段）\n"
            + "tools.register({\n"
            + "  name: \"book_lab\", idempotent: true,\n"
            + "  schema: { slot: \"enum[friday-14, friday-15]\", note: \"string?\" },\n"
            + "  permission: \"student\",\n"
            + "  faults: [\"timeout\", \"stale\", \"denied\"]   // 可注入故障\n"
            + "});",
          expected: "调用前自动校验参数；注入故障按注册表返回。",
        },
        modify: {
          brief: "给 book_lab 增加 capacity 参数校验（1-4），并验证传 0/5/abc 时的错误分类。",
          starter: "实验室 Agent → 工具配置。",
          checks: ["非法参数被拒绝且错误码正确", "合法调用不受影响"],
        },
      },
      {
        title: "超时、重试与恢复",
        body:
          "读取超时：预算内退避重试（如 2s/4s/8s，上限 3 次）。写入超时：先按 request_id 核验服务端状态，再决定确认或重试。进程崩溃：从检查点恢复前必须核验“已发生的外部动作”，因为外部世界不会跟着回滚。",
        modify: {
          brief: "在故障演练里分别走“原样重试”与“核验后恢复”，比较写入次数与最终一致性。",
          starter: "Agent 实验室故障任务。",
          checks: ["核验路径 writes=1", "重复路径能识别并说明补偿"],
        },
      },
      {
        title: "完成前的目标核验",
        body:
          "工具状态码 200 不等于用户目标达成。收尾核验：目标（一条有效预约）、事实（服务端记录数）、边界（时间/权限）。Agent 实验室把这一步设为独立检查点。",
        verify: {
          task: "注入 3 种不同故障，各完成一次“正确终止或恢复”，写入次数全部为 1。",
          evidence: "运行记录含 trace 与核验步骤。",
        },
        limits: "实验室是确定性模拟器，不连接真实业务系统；真实系统的幂等语义以对方 API 文档为准。",
      },
    ],
    depths: {
      intuition: "把工具想成有合同的工人：参数、权限、超时、重试规则都写在合同里；老板（执行系统）负责验货，不听工人自述。",
      engineering: "OpenAPI/JSON schema 定义工具；审计日志含 request_id；对账任务定时核验副作用。",
      research: "Agent 可靠性基准、过程监督、LLM-as-judge 的偏差与校准。",
    },
    references: [
      {
        title: "Building effective agents（Anthropic）",
        kind: "工程实践",
        url: "https://www.anthropic.com/research/building-effective-agents",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
      {
        title: "LangGraph persistence（检查点）",
        kind: "官方文档",
        url: "https://docs.langchain.com/oss/python/langgraph/persistence",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
      ref(10, "agent.ipynb", "原教材智能体章节 Notebook"),
    ],
    quiz: [
      {
        id: "agent-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "写入调用超时后，助手直接重试并返回“已完成”，但用户收到两条预约。指出流程缺失的步骤。",
        rubric: ["写入前未生成幂等键", "超时后未核验", "完成前未对账"],
      },
    ],
  },
  {
    id: "ch01",
    title: "训练与部署：从 SFT 到服务上线",
    track: "llm",
    prerequisites: ["tensor", "ch02"],
    outcome: "完成一次真实小模型推理；解释 SFT/LoRA 的训练目标与算力取舍；部署时建立基线并检查能力退化。",
    tags: ["SFT", "LoRA", "量化", "部署", "退化检查"],
    level: "进阶",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 1 },
    minutes: { value: 90, basis: "estimate" },
    cost: "推理免费（本地 CPU）；LoRA 训练需 GPU 或较长时间 CPU；本课先完成推理与配置。",
    conditions: "Python 环境；首次运行需下载权重；完整微调建议外部 Notebook + GPU。",
    problem:
      "你微调了一个客服模型，通用能力悄悄下降，而上线前只测了客服题集。退化检查（regression）缺失让坏版本直接发布了。",
    predict: "LoRA 只训练 0.1% 的参数，为什么常常够用？什么时候不够？",
    steps: [
      {
        title: "真实推理：先跑通再谈训练",
        body:
          "用已验证的脚本在 CPU 上加载 SmolLM2-135M-Instruct 并生成。这建立“推理基线”：模型版本、耗时、显存/内存占用，都是后续微调对照的参照点。",
        code: {
          lang: "python",
          run: "python",
          src:
            "python experiments/inference.py --check\n"
            + "python experiments/inference.py --json-out artifacts/logs/baseline.json",
          expected:
            "依赖检查通过；生成文本 + JSON 记录（input/output tokens、elapsed、versions）。",
        },
        pitfalls: [
          "首次运行忘下载权重导致超时——脚本有可操作报错。",
          "把生成文本的事实性当真——输出不保证正确。",
        ],
      },
      {
        title: "SFT 与 LoRA 的机制",
        body:
          "SFT 在指令-回答对上继续训练全部参数；LoRA 冻结原权重，训练低秩增量 ΔW=BA，参数量降几个数量级。数据质量 > 数量；指令格式要与推理时模板一致。",
        formulas: [
          {
            name: "LoRA 参数量",
            expr: "ΔW = B·A，B:[d,r], A:[r,d_out]",
            dims: "r≪min(d,d_out)（如 r=8，d=576）",
            note: "可训练参数 ≈ 2·r·d·层数比例，远小于全量。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "# 依据原教材 Notebook 运行微调（需要其声明的环境与算力）\n"
            + "# 链接见下方“打开实验 Notebook”\n"
            + "# 平台内先完成：数据格式检查 + 训练前基线记录",
          expected: "Notebook 产出训练日志与微调后模型；本页代码仅建立对照基线。",
        },
        modify: {
          brief: "写 20 条你领域的 SFT 样例，检查：格式一致性、答案正确性、是否有测试题混入训练集。",
          starter: "JSONL：{\"instruction\":…, \"input\":…, \"output\":…}",
          checks: ["无泄漏", "格式统一", "答案人工复核过"],
        },
      },
      {
        title: "量化与服务",
        body:
          "量化把权重压到 8/4 bit，显存降数倍、精度略降；部署面：延迟（首 token/整段）、吞吐、成本、并发。先量化你的指标再选型。",
        formulas: [
          {
            name: "显存估算",
            expr: "weights ≈ params × bytes",
            dims: "FP16:2B/参数；INT8:1B；INT4:0.5B",
            note: "再加 KV cache 与激活的开销。",
          },
        ],
      },
      {
        title: "基线与退化检查",
        body:
          "上线前固定三个题集：目标任务集、通用能力集（退化检查）、安全集。任一集合显著回退即阻断发布。记录模型哈希与配置，保证可回滚。",
        verify: {
          task: "建立你自己的三题集（各≥10 条）并跑通基线记录。",
          evidence: "基线 JSON 运行记录 + 题集文件。",
        },
        limits: "本课不实际微调（平台内）；Notebook 微调依赖其环境，费用与算力以原教材说明为准。",
      },
    ],
    depths: {
      intuition: "微调像岗位培训（SFT 教职责，LoRA 发一本薄手册）；上线像体检：不只测本岗位，还测有没有变笨。",
      engineering: "vLLM/SGLang 服务化；A/B 与影子流量；模型仓库带配置指纹；灰度+回滚。",
      research: "数据配比与灾难性遗忘、指令数据合成、LoRA 秩与任务复杂度关系。",
    },
    references: [
      ref(1, "dive-tuning.ipynb", "原教材第 1 章 Notebook"),
      {
        title: "LoRA 论文",
        kind: "论文",
        url: "https://arxiv.org/abs/2106.09685",
        verified: { date: "2026-11-16", env: "arXiv" },
      },
    ],
    quiz: [
      {
        id: "ch01-q1",
        kind: "regression",
        capability: "verified",
        prompt: "微调后目标任务 95% 但通用问答明显变差。说出缺失的质量关卡与补救。",
        rubric: ["缺退化检查集", "数据配比/正则", "回滚机制"],
      },
    ],
  },
  {
    id: "ch05",
    title: "多模态：图像证据与空间关系",
    track: "llm",
    prerequisites: ["tensor", "foundation"],
    outcome: "解释视觉编码器如何产出 token 级表示，构造并诊断视觉失败案例（空间关系/计数/文字识别）。",
    tags: ["VLM", "视觉编码", "多模态失败"],
    level: "进阶",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 8 },
    minutes: { value: 50, basis: "estimate" },
    cost: "外部 Notebook 按其平台计费；平台内演示免费。",
    conditions: "浏览器理论学习；运行 VLM 需按原教材环境。",
    problem:
      "把一张货架照片发给模型问“最左边是什么”，它答错了。视觉信息经编码器压缩后，空间关系是否还被保留？",
    predict: "把图片旋转 180° 再问“图中人物朝向哪”，预测模型答对率变化与原因。",
    steps: [
      {
        title: "视觉表示如何进入语言模型",
        body:
          "图像经视觉编码器（如 ViT）切成 patch，投影到语言嵌入空间，作为“图像 token”拼进上下文。语言模型对它们做与文本 token 相同的注意力处理——空间结构在投影中被压缩。",
        formulas: [
          {
            name: "Patch 化",
            expr: "image → patches → tokens",
            dims: "224×224、patch16 → 196 tokens（+特殊 token）",
            note: "分辨率↑→token 数平方增长。",
          },
        ],
        pitfalls: [
          "假设模型“看到”整幅图——它看到的是压缩后的 token 序列。",
          "图文对齐失败（图与问题不匹配）时的回答仍可能流畅——要检查输入。",
        ],
      },
      {
        title: "构造失败案例",
        body:
          "空间关系（左右/远近）、计数（>3 个物体）、细小文字、时间序列图是常见弱项。亲手构造 3 个失败案例并分类原因：编码丢失、训练分布缺失、指令歧义。",
        modify: {
          brief: "用你手机随手拍一张含 4+ 物体的照片，问计数与位置，记录回答与真实答案。",
          starter: "任意 VLM（原教材 Notebook 或商用平台）。",
          checks: ["失败案例可复现", "归因到具体环节"],
        },
      },
      {
        title: "评估与数据",
        body:
          "多模态评估需要图像-问题-答案三元组；注意图像版权与隐私。小规模自建集（20 条）常比公开基准更贴近你的场景。",
        modify: {
          brief: "为你的场景写 10 条图文评测（含 2 条应拒答），跑一次基线。",
          starter: "表格：image, question, expected, forbidden。",
          checks: ["含拒答样例", "标注者一致性说明"],
        },
      },
      {
        title: "验证",
        body: "把失败案例分类汇总，指出哪些可通过提高分辨率/裁剪缓解，哪些需要重训练或换模型。",
        verify: {
          task: "失败分类表 + 至少 1 个缓解措施的前后对照。",
          evidence: "运行记录或截图记录。",
        },
        limits: "视觉结论随模型代际快速变化；结论标注测试日期与模型版本。",
      },
    ],
    depths: {
      intuition: "模型看图像看“打了码的拼贴画”：整体轮廓在，细节与方位可能丢了。",
      engineering: "图像预处理（裁剪/分辨率）对精度影响巨大；生产里对关键任务加 OCR 后备通道。",
      research: "视觉 token 压缩、统一多模态架构、空间推理基准（VSR 类）。",
    },
    references: [
      ref(8, "mllms.ipynb", "原教材多模态章节 Notebook"),
      {
        title: "CLIP 论文",
        kind: "论文",
        url: "https://arxiv.org/abs/2103.00020",
        verified: { date: "2026-11-16", env: "arXiv" },
      },
    ],
    quiz: [
      {
        id: "ch05-q1",
        kind: "explain",
        capability: "explained",
        prompt: "为什么把分辨率提高一倍，图像 token 数会变成约 4 倍？给出 token 数公式。",
        rubric: ["patch 化平方关系", "给出计算", "提到上下文成本"],
      },
    ],
  },
  {
    id: "ch10",
    title: "GUI 智能体：观察与操作",
    track: "llm",
    prerequisites: ["agent", "ch05"],
    outcome: "定义 GUI 任务的观察空间与动作集合，设计失败恢复策略与人工接管边界。",
    tags: ["GUI Agent", "规划", "可观察性"],
    level: "研究/进阶",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: 9 },
    minutes: { value: 45, basis: "estimate" },
    cost: "外部 Notebook 按其平台计费。",
    conditions: "理论学习；实操依赖原教材环境。",
    problem: "GUI 智能体点错了按钮还继续执行——界面状态变了它却不知道。观察、动作与状态同步如何设计？",
    predict: "截图与 DOM 两种观察各丢失什么信息？哪种更适合作为恢复依据？",
    steps: [
      {
        title: "观察与动作空间",
        body: "截图（像素，含视觉噪声）vs DOM/无障碍树（结构化，可能缺失视觉布局）。动作：点击/输入/滚动/等待。先固定观察-动作契约再谈策略。",
        formulas: [
          {
            name: "任务成功率",
            expr: "success = 目标状态核验通过数 / 任务数",
            dims: "核验基于最终界面状态而非模型自述",
            note: "与 Agent 课程的目标核验一致。",
          },
        ],
        pitfalls: ["只看截图丢失可交互元素语义", "动作执行后未等待渲染完成"],
      },
      {
        title: "失败与恢复",
        body: "每步执行后做轻量状态核验（预期元素存在？）；连续失败触发回退或人工接管。隐藏核心功能于无人值守是不安全的。",
        modify: {
          brief: "为“提交表单”任务写恢复规则：两次失败后转人工，并说明核验信号。",
          starter: "流程伪代码。",
          checks: ["有可观测信号", "有终止条件"],
        },
      },
      {
        title: "研究视角",
        body: "GUI 基准（WebArena 类）评测的是端到端成功率；研究问题包括观察表示、动作泛化与安全边界。",
      },
      {
        title: "边界",
        body: "本平台不实际驱动浏览器执行 GUI 任务；相关实操进入原教材 Notebook。",
        verify: { task: "提交任务契约设计文档", evidence: "观察/动作/核验/恢复四要素齐全" },
        limits: "GUI 实操环境差异大，结论不可跨站点泛化。",
      },
    ],
    depths: {
      intuition: "GUI 智能体像远程操作员：只凭传回的画面和结构树动手，每步都要确认“界面真的变了”。",
      engineering: "用无障碍树做语义观察；动作幂等与去重；操作审计日志。",
      research: "视觉-结构联合观察、长任务信用分配、安全约束下的探索。",
    },
    references: [ref(9, "GUIagent.ipynb", "原教材 GUI 智能体 Notebook")],
    quiz: [],
  },
];
