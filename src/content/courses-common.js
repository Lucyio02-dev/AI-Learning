// 公共基础课程数据。course.id 是平台稳定 ID，改名/改顺序不影响数据；
// 教材章节只出现在 sourceRef 与 references 里。
export const coursesCommon = [
  {
    id: "foundation",
    title: "从输入到输出：模型做了什么",
    track: "common",
    prerequisites: [],
    outcome: "区分模型权重、上下文与采样三个变量，解释输出为什么变化，并用固定变量的对照实验验证自己的解释。",
    tags: ["Token", "上下文", "采样", "推理"],
    level: "起步",
    lab: "prompt",
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 40, basis: "estimate" },
    cost: "免费。规则演示不需要模型调用；真实对照需本地后端，费用按用量另计。",
    conditions: "浏览器即可；真实模型对照需要启动本地后端（npm run server）。",
    problem:
      "你问模型“本学期退选截止时间是什么时候”，它给了一个自信但过期的日期。是模型“记错了”，还是你根本没有给它能知道这件事的输入？",
    predict:
      "在实验室里分别补充“当前学期规定”和“要求 JSON 输出”，预测哪个变量会改变事实内容，哪个只会改变格式。",
    steps: [
      {
        title: "先建立直觉",
        body:
          "模型根据当前输入和已生成内容预测下一个 token，得到的是概率分布；采样决定从分布里选哪个；常规推理不更新权重。Token 切分由 tokenizer 决定，不固定等于一个字或一个词。所以“模型知道什么”由权重决定，“模型这次说什么”由上下文与采样共同决定。",
        formulas: [
          {
            name: "下一个 token 的条件分布",
            expr: "P(x_t | x_<t; θ)",
            dims: "x_t ∈ 词表 V（如 |V|=49152），θ 为固定权重",
            note: "上下文 x_<t 越长，分布越受当前输入影响。",
          },
        ],
        pitfalls: [
          "把“模型输出错误”一律归因于模型能力，忽略输入里缺失的事实。",
          "以为对话历史会改变权重——它只改变条件分布的输入部分。",
        ],
      },
      {
        title: "先做预测，再分变量",
        body:
          "进入实验室前先写下预测。随后用固定变量法：改一个输入，其余保持不动，重复观察。角色提示让回答语气更像专家，但不能凭空提供它没见过的规定；格式要求只约束输出的形状。",
        code: {
          lang: "python",
          run: "python",
          src:
            "# 真实小模型对照：固定模型与提示，只换用户消息\n"
            + "python experiments/inference.py --prompt \"退选截止时间是多少？\"\n"
            + "python experiments/inference.py --prompt \"根据以下规定回答。当前学期退选截止：第一周周五17:00。问题：退选截止时间是多少？\"",
          expected:
            "记录两次原始输出，不预设模型一定拒答或准确复述。检查两次调用的模型、采样参数与证据差异，并核对第二条是否忠实于给定规定。",
        },
        pitfalls: [
          "两次调用之间顺手改了模型版本或 max_tokens，变量没有控制住。",
          "把单次输出差异当作统计结论；应重复多次再比较。",
        ],
      },
      {
        title: "诊断一次错误回答",
        body:
          "拿到一个错误回答时按顺序检查：① 输入里有没有需要的事实（证据缺失）？② 指令之间是否互相冲突？③ 采样温度是否导致不稳定？④ 输出解析是否失败？不同原因对应不同修改，用证据区分它们，而不是猜。",
        modify: {
          brief: "把实验室的默认问题改成你自己的课程规定，补齐证据后验证回答是否正确引用了来源。",
          starter: "在 Prompt 实验室勾选“补充当前学期规定”，把正文换成你的资料。",
          checks: ["回答与资料一致", "回答注明了来源", "未提供的字段为 null 而非编造"],
        },
      },
      {
        title: "独立验证与边界",
        body:
          "同样的提示重复 3 次（或用实验室的批量运行），若输出不一致，先查采样与版本，再谈“能力”。结论只在你测过的模型、样例与参数范围内成立。",
        verify: {
          task: "换一个全新问题（未参与上面的调试），重复证据缺失/补齐对照。",
          evidence: "3 次重复的输出记录 + 一句话结论：差异来自采样还是输入。",
        },
        limits:
          "本课不训练模型、不评测事实准确性；SmolLM2-135M 是 1.35 亿参数的教学模型，能力边界远小于商用模型，结论不能直接外推。",
      },
    ],
    depths: {
      intuition: "把模型想成“根据上文接下一句”的机器：上下文给素材，采样给随机性，权重给本领。",
      engineering:
        "生产里把“检索到的资料”作为上下文注入，把 temperature/seed 写进配置与日志；对关键输出做结构化校验（JSON schema）。",
      research:
        "上下文学习（in-context learning）为何有效仍是开放问题；用固定探针数据测不同上下文构造的效应大小，报告置信区间。",
    },
    references: [
      {
        title: "文本生成与解码（HF Transformers 官方教程）",
        kind: "官方文档",
        url: "https://huggingface.co/docs/transformers/main/en/llm_tutorial",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
      {
        title: "原教材第 2 章 Prompting（引用与扩展）",
        kind: "教程",
        url: "https://github.com/Lordog/dive-into-llms/blob/main/documents/chapter2/README.md",
        verified: { date: "2026-11-16", env: "GitHub 公开仓库" },
      },
    ],
    quiz: [
      {
        id: "foundation-q1",
        kind: "explain",
        capability: "explained",
        prompt: "给模型加了“你是选课办老师”的角色后，它仍然给出错误日期。解释为什么角色提示不能解决这个问题。",
        rubric: [
          "指出角色改变的是风格/先验分布而非事实来源",
          "指出事实需要进入上下文（检索/补充资料）",
          "提到验证方法：补证据前后对照",
        ],
      },
      {
        id: "foundation-q2",
        kind: "modify",
        capability: "implemented",
        prompt: "把实验室默认问题的资料正文替换为另一条规定，运行并粘贴两次输出，指出哪个变量变了。",
        rubric: ["只改动一个变量", "输出与资料一致", "记录了两次运行"],
      },
    ],
  },
  {
    id: "pyexp",
    title: "Python 实验环境：让结果可复现",
    track: "common",
    prerequisites: [],
    outcome: "建立隔离的 Python 环境，运行并记录一个真实脚本，解释为什么版本、种子与日志是实验的地基。",
    tags: ["Python", "环境", "可复现", "日志"],
    level: "起步",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 30, basis: "verified" },
    cost: "免费。SmolLM2-135M 权重约 270MB，首次运行需下载。",
    conditions: "Python 3.10+ 与约 1GB 可用磁盘；CPU 即可。",
    problem:
      "你在自己的电脑上跑通了示例，发给同学却报 ImportError；三周后你自己再跑，结果数值不一样。问题不在模型，在实验环境没有被固定。",
    predict: "先猜：同一个脚本、同一种子，在不同 torch 版本上结果完全一致吗？",
    steps: [
      {
        title: "隔离环境与依赖锁定",
        body:
          "venv/conda 建立独立环境，用锁文件固定版本。experiments/requirements.lock.txt 记录了本平台验证过的版本组合；这是“在我们验证的环境里可复现”，不承诺所有环境。",
        code: {
          lang: "powershell",
          run: "terminal",
          src:
            "python -m venv .venv\n"
            + ".\\.venv\\Scripts\\Activate.ps1\n"
            + "python -m pip install -r experiments/requirements.lock.txt\n"
            + "python experiments/inference.py --check",
          expected: "输出 Python/torch/transformers 版本行与 “Dependency check passed”。",
        },
        pitfalls: [
          "在系统 Python 里直接安装，污染其他项目。",
          "只写 requirements.txt 的宽范围（torch>=2），版本漂移后结果不可比。",
        ],
      },
      {
        title: "种子、配置与运行记录",
        body:
          "把 seed、模型版本、参数写进配置并随结果一起落盘。inference.py 的 --json-out 会产出包含 config/versions/elapsed 的运行记录；训练类实验同理。",
        formulas: [
          {
            name: "随机性的来源",
            expr: "sample ~ P(x_t|context)，temperature τ 缩放 logits",
            dims: "logits: [batch, seq, |V|]",
            note: "贪心解码（do_sample=False）与种子共同决定输出是否逐字节可复现。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "python experiments/inference.py --sample --seed 42 --max-new-tokens 32 \\\n"
            + "  --json-out artifacts/logs/demo-seed42.json",
          expected: "artifacts/logs/demo-seed42.json 里出现 seed:42、sampling:true 与生成文本。",
        },
      },
      {
        title: "诊断环境差异",
        body:
          "复现失败时按层检查：解释器版本 → 锁文件是否一致 → 是否真的激活了环境 → 硬件差异（CPU/GPU 数值非结合性）。把“在哪台机器上验证过”写进实验记录，是学术与工程惯例。",
        modify: {
          brief: "给 inference.py 增加一个 --prompt 变体并运行两次，比较两次 JSON 记录哪些字段相同、哪些不同。",
          starter: "复制现有命令行，改 --prompt 后追加 --json-out 第二个路径。",
          checks: ["两次记录的 versions 相同", "sampling:false 时输出逐字节一致"],
        },
      },
      {
        title: "验证与迁移",
        body: "把环境复制到另一台机器（或让同学按锁文件安装）重跑，确认运行记录里的 versions 一致。",
        verify: {
          task: "在第二个环境里重跑同一命令，对比两份 JSON 记录。",
          evidence: "两份记录 + 一行结论（一致/不一致及原因）。",
        },
        limits: "锁文件锁定的是 CPU 推理路径；GPU 数值与 CPU 不逐位一致，属正常现象。",
      },
    ],
    depths: {
      intuition: "实验像菜谱：同配方同步骤才能同味道；锁文件就是配方的克数。",
      engineering: "团队用 pip-tools/uv/poetry 生成锁文件；CI 里固定 Python 版本；容器镜像进一步固定系统层。",
      research: "复现包（代码+锁文件+种子+数据版本+运行记录）是审稿人复核的最低要求；记录硬件与非确定性来源。",
    },
    references: [
      {
        title: "Python venv 官方文档",
        kind: "官方文档",
        url: "https://docs.python.org/3/library/venv.html",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "pyexp-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "同学报错 ModuleNotFoundError: torch，但你说你装过了。列出你会依次检查的三件事。",
        rubric: ["环境未激活", "装到系统/别的解释器", "锁文件与解释器版本不匹配"],
      },
    ],
  },
  {
    id: "vector",
    title: "向量、矩阵与张量：形状是语言",
    track: "common",
    prerequisites: ["pyexp"],
    outcome: "读出每个张量操作的输入输出形状，用手写小例子解释矩阵乘法在神经网络里的含义。",
    tags: ["张量", "形状", "矩阵乘法", "广播"],
    level: "起步",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 45, basis: "estimate" },
    cost: "免费（浏览器内互动 + 可选 Python）。",
    conditions: "浏览器即可；Python 对照需要 pyexp 环境。",
    problem:
      "报错 “mat1 and mat2 shapes cannot be multiplied (32×128 and 256×64)”。形状错误是初学者最常见的运行时错误，也是读懂任何模型代码的钥匙。",
    predict: "一个 [batch, seq, d] 的输入过一层 Linear(d→h)，输出形状是什么？参数矩阵存了多少个数？",
    steps: [
      {
        title: "从标量到张量",
        body:
          "标量是 0 维、向量 1 维、矩阵 2 维、张量更高维。深度学习里所有数据都以张量流动：文本 batch 是 [B, seq]，图像是 [B, C, H, W]。每个操作前先问“进什么形状，出什么形状”。",
        formulas: [
          {
            name: "矩阵乘法",
            expr: "C = A @ B，要求 A 的列数 = B 的行数",
            dims: "A:[m,k] B:[k,n] → C:[m,n]",
            note: "Linear 层 y = Wx + b：W:[out,in]，x:[in]，b:[out]。",
          },
          {
            name: "广播",
            expr: "形状从尾部对齐，逐维比较：相等或其中一方为 1",
            dims: "[B,1,d]+[1,seq,d] → [B,seq,d]",
            note: "Attention 掩码、归一化都靠广播，错一位就会悄悄算错。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "import torch\n"
            + "B, S, D, H = 2, 8, 128, 256\n"
            + "x = torch.randn(B, S, D)\n"
            + "lin = torch.nn.Linear(D, H)\n"
            + "y = lin(x)\n"
            + "print(x.shape, y.shape)                      # [2,8,128] [2,8,256]\n"
            + "print(sum(p.numel() for p in lin.parameters()))  # D*H + H = 33024",
          expected: "torch.Size([2, 8, 128]) torch.Size([2, 8, 256]) / 33024",
        },
        pitfalls: [
          "PyTorch Linear 权重形状是 [out,in]，与 y=Wx 直觉相反。",
          "广播把 [B,S] 掩码直接加到 [B,S,S] 分数上，缺一个维度。",
        ],
      },
      {
        title: "浏览器内互动",
        body:
          "下面的 JS 小实验把矩阵乘法、形状与参数量连起来：改一改维度，看参数量怎么变。它和 PyTorch 的规则一致。",
        code: {
          lang: "javascript",
          run: "browser",
          src:
            "// 在浏览器控制台或实验页运行\n"
            + "function linearParams(dIn, dOut) { return dIn * dOut + dOut; }\n"
            + "console.log(linearParams(128, 256)); // 33024",
          expected: "33024 —— 与 torch 的参数统计一致。",
        },
        modify: {
          brief: "把 D 换成 512、H 换成 1024，先手算参数量，再运行验证。",
          starter: "改代码里两个数字。",
          checks: ["手算 = 运行结果", "能说出每个数来自哪一项"],
        },
      },
      {
        title: "诊断形状错误",
        body:
          "看到形状报错时，把 involved 张量的形状全部打印出来，标注每维含义，再定位是转置缺失、维度顺序还是广播错误。",
        code: {
          lang: "python",
          run: "python",
          src:
            "w = torch.randn(256, 128)   # 注意这是 [out,in]\n"
            + "try:\n"
            + "    x @ w                    # x:[2,8,128] @ [256,128] → 报错\n"
            + "except RuntimeError as e:\n"
            + "    print(\"错误：\", e)\n"
            + "print((x @ w.T).shape)       # [2,8,256] 正确",
          expected: "打印 mat1/mat2 形状错误信息，随后输出 torch.Size([2, 8, 256])。",
        },
      },
      {
        title: "独立验证",
        body: "找一个真实模型代码（如教程里的分类器），画出数据流图并标出每步形状，交给他人检查。",
        verify: {
          task: "手绘/文本写出 4 层以上网络的数据流与形状标注。",
          evidence: "标注图 + 他人能复述每维含义。",
        },
        limits: "本课只覆盖稠密层；卷积、注意力有各自的形状规则，在后续课程展开。",
      },
    ],
    depths: {
      intuition: "矩阵乘法是“批量加权求和”；神经网络就是一连串带形状约束的加权求和加非线性。",
      engineering: "用 einops/torch.einsum 让形状意图显式；训练前打印一张形状表，能拦截大多数错误。",
      research: "混合精度下同一形状可能用不同内核；数值误差分析需要区分形状语义与舍入误差。",
    },
    references: [
      {
        title: "PyTorch Tensors 官方教程",
        kind: "官方文档",
        url: "https://docs.pytorch.org/tutorials/beginner/basics/tensorqs_tutorial.html",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "vector-q1",
        kind: "explain",
        capability: "explained",
        prompt: "为什么 [B,S,D] 的输入可以直接过 Linear(D,H)？解释 PyTorch 在背后对形状做了什么。",
        rubric: ["提到对最后一维作用", "提到批量维广播/展平", "输出 [B,S,H]"],
      },
    ],
  },
  {
    id: "probopt",
    title: "概率与优化：训练在优化什么",
    track: "common",
    prerequisites: ["vector"],
    outcome: "用交叉熵解释语言模型的训练目标，手动执行几步梯度下降，说明学习率与批大小对收敛的影响。",
    tags: ["交叉熵", "梯度下降", "学习率", "似然"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 50, basis: "estimate" },
    cost: "免费。",
    conditions: "浏览器互动；Python 对照需要 pyexp 环境。",
    problem:
      "训练日志里 loss 从 4.5 降到 2.0，这串数字到底在衡量什么？为什么学习率 0.1 时模型发散、0.0001 时几乎不动？",
    predict: "交叉熵 loss=2.0 时，模型对正确 token 的平均概率大约是多少？先算再看。",
    steps: [
      {
        title: "语言模型的训练目标",
        body:
          "语言模型最大化下一个 token 的对数似然，等价于最小化交叉熵。loss 是所有 token 平均负对数似然，e^loss 可粗略解读为“模型平均在多少个等效选项里犹豫”。",
        formulas: [
          {
            name: "交叉熵损失",
            expr: "L = -1/N Σ log p(x_i | context_i; θ)",
            dims: "p 来自 logits[B,seq,V] 的 softmax；N 为 token 数",
            note: "loss=2.0 ⇒ 平均概率 ≈ e^-2 ≈ 0.135。",
          },
          {
            name: "梯度下降",
            expr: "θ ← θ − η · ∇L",
            dims: "θ 与 ∇L 同形状；η 为标量学习率",
            note: "批大小决定 ∇L 的噪声水平。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "import torch\n"
            + "logits = torch.randn(4)          # 未训练的 4 选 1\n"
            + "target = torch.tensor(2)\n"
            + "loss = torch.nn.functional.cross_entropy(logits[None], target[None])\n"
            + "print(loss.item(), torch.exp(-loss).item())  # ≈1.5, ≈0.22",
          expected: "loss≈1.3~1.8（随机初始化），概率≈0.2。",
        },
        pitfalls: [
          "把 loss 等价于准确率；两者相关但不等价。",
          "softmax 前先取了 log，导致数值不稳定——用 cross_entropy 直接吃 logits。",
        ],
      },
      {
        title: "手写梯度下降",
        body:
          "对一维函数 f(w)=(w−3)² 用解析梯度走 20 步，观察学习率 0.1 / 1.1 / 0.001 三种情况：收敛、发散、爬行。这是所有优化器的最小内核。",
        code: {
          lang: "python",
          run: "python",
          src:
            "def gd(lr, steps=20):\n"
            + "    w = 0.0\n"
            + "    trace = []\n"
            + "    for _ in range(steps):\n"
            + "        w -= lr * 2 * (w - 3)      # df/dw = 2(w-3)\n"
            + "        trace.append(round(w, 3))\n"
            + "    return trace[-1]\n"
            + "print(gd(0.1), gd(1.1), gd(0.001))   # ≈3.0 发散 ≈0.06",
          expected: "≈3.0、发散（数值爆掉）、≈0.06（几乎没动）。",
        },
        modify: {
          brief: "加入动量：v ← β·v + ∇，w ← w − lr·v，比较大 learning rate 下是否更稳。",
          starter: "在 gd() 里加一个 v 变量。",
          checks: ["能解释动量如何抑制震荡"],
        },
      },
      {
        title: "诊断不收敛",
        body:
          "按顺序检查：loss 是否 NaN（学习率过大/数值溢出）→ 数据是否打乱 → 学习率数量级 → 梯度范数（梯度裁剪）。真实训练里先跑 100 步小实验，再上全量。",
        modify: {
          brief: "故意把学习率调大 10 倍复现发散，再说明你从哪个信号确认了原因。",
          starter: "把 lr 改成 1.0 重新运行。",
          checks: ["复现 NaN/发散", "给出证据而非猜测"],
        },
      },
      {
        title: "验证",
        body: "把一维结论迁移：在真实小训练（tensor 课程）里画 loss 曲线，指出你看到的“爬行/收敛/发散”区间。",
        verify: {
          task: "提交一张学习率-最终loss 表（至少 3 个量级）。",
          evidence: "表格 + 每档一句话解释。",
        },
        limits: "一维直觉不覆盖 Adam 等自适应方法与二阶信息；只建立量级感。",
      },
    ],
    depths: {
      intuition: "训练就是“沿着下坡方向挪一小步”；学习率是步子大小，太大跨过谷底，太小挪不动。",
      engineering: "生产里用 warmup+余弦衰减、梯度裁剪、混合精度；用 loss 曲线与梯度范数做健康监控。",
      research: "损失景观（loss landscape）与规模化规律（scaling laws）研究不同量级下的最优超参迁移。",
    },
    references: [
      {
        title: "PyTorch Optimization 官方教程",
        kind: "官方文档",
        url: "https://docs.pytorch.org/tutorials/beginner/basics/optimization_tutorial.html",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "probopt-q1",
        kind: "unseen",
        capability: "verified",
        prompt: "训练中 loss 突然变成 NaN。给出两个最可能的原因和各自的验证办法。",
        rubric: ["学习率过大→降档重跑", "数值溢出/log(0)→检查输入与 epsilon", "区分症状与原因"],
      },
    ],
  },
  {
    id: "autograd",
    title: "自动求导：计算图如何替你求梯度",
    track: "common",
    prerequisites: ["vector", "probopt"],
    outcome: "用 torch.autograd 验证手推梯度，解释 requires_grad、反向传播与 detach 的作用。",
    tags: ["自动求导", "计算图", "反向传播"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 40, basis: "estimate" },
    cost: "免费。",
    conditions: "Python 环境（pyexp 已建）。",
    problem:
      "一个 3 层网络的参数有几万个，框架怎么知道每个参数的梯度？如果你自己写反传，漏一条边整个训练就悄悄错了。",
    predict: "y = w·x + b，L = y.mean() 时，∂L/∂w 的形状和数值是多少（设 x,w 已知）？",
    steps: [
      {
        title: "计算图与反向模式",
        body:
          "前向时框架记录每步操作构成计算图；反向按链式法则从损失出发传播梯度。requires_grad=True 的叶子节点累积 .grad；推理时用 torch.inference_mode() 关闭记录以省内存。",
        formulas: [
          {
            name: "链式法则",
            expr: "∂L/∂w = ∂L/∂y · ∂y/∂w",
            dims: "∂L/∂y 与 y 同形状，∂y/∂w 与 w 同形状（雅可比收缩）",
            note: "框架把收缩自动完成，你只看 .grad。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "import torch\n"
            + "x = torch.tensor([[1., 2.], [3., 4.]])\n"
            + "w = torch.zeros(2, 2, requires_grad=True)\n"
            + "b = torch.zeros(2, requires_grad=True)\n"
            + "y = x @ w + b\n"
            + "L = y.mean()\n"
            + "L.backward()\n"
            + "print(w.grad.shape, w.grad)     # [2,2]，全 0.25（mean 对每元素 1/4）",
          expected: "torch.Size([2, 2])，元素全为 0.25。",
        },
        pitfalls: [
          "忘记 zero_grad()，梯度跨 batch 累积。",
          "对不需要梯度的张量开启 requires_grad，白耗内存。",
          "用 y.detach() 后又想反传——图已断开。",
        ],
      },
      {
        title: "数值验证梯度",
        body:
          "用有限差分 (L(w+ε)−L(w−ε))/2ε 验证解析/自动梯度——这是检查自定义层是否写对的标准手段。",
        code: {
          lang: "python",
          run: "python",
          src:
            "eps = 1e-4\n"
            + "w2 = w.detach().clone(); w2[0,0] += eps\n"
            + "w3 = w.detach().clone(); w3[0,0] -= eps\n"
            + "num = ((x @ w2 + b).mean() - (x @ w3 + b).mean()) / (2*eps)\n"
            + "print(num.item(), w.grad[0,0].item())   # 两个 ≈0.25",
          expected: "数值梯度 ≈ 自动梯度（误差 <1e-6）。",
        },
        modify: {
          brief: "把 mean 换成 y.pow(2).sum()，先手推 ∂L/∂w，再同时用自动+数值梯度验证。",
          starter: "改损失那一行，保留验证代码。",
          checks: ["手推与两种数值方法一致", "能指出链式法则对应关系"],
        },
      },
      {
        title: "诊断梯度异常",
        body:
          "梯度为零：图被 detach/中间用了 no_grad/损失与参数无关；梯度爆炸：看范数、加裁剪；梯度消失：深层网络看每层范数比例。",
        modify: {
          brief: "写一个把中间结果 detach 的 bug 版本，运行后说明观察到的 grad 是什么、为什么。",
          starter: "在 y = (x @ w + b) 外包一层 .detach()。",
          checks: ["观察到 w.grad=None 或报错", "解释计算图断裂"],
        },
      },
      {
        title: "验证与迁移",
        body: "对 probopt 的一维梯度下降改用 autograd 求 2(w−3)，重跑三种学习率，结论应一致。",
        verify: {
          task: "提交 autograd 版 GD 的输出与手写版对比表。",
          evidence: "两版最终 w 一致（±1e-6）。",
        },
        limits: "反向模式对“输入多输出少”高效；对输出多于输入的场景（如雅可比矩阵）需正向模式（jvp）。",
      },
    ],
    depths: {
      intuition: "计算图像流水线账本：前向记账，反向按账本倒推每个原料的责任份额。",
      engineering: "推理用 inference_mode；训练监控 grad_norm；自定义层必须过 gradcheck。",
      research: "二阶优化、隐式微分（神经 ODE）与可微编程扩展了这套机制。",
    },
    references: [
      {
        title: "A Gentle Introduction to torch.autograd",
        kind: "官方文档",
        url: "https://docs.pytorch.org/tutorials/beginner/blitz/autograd_tutorial.html",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "autograd-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "训练两轮后 loss 不变，发现所有 .grad 都是 None。给出最可能的原因。",
        rubric: ["前向在 no_grad/inference_mode 中", "或中间 detach 断图", "验证方法：打印图/加最小用例"],
      },
    ],
  },
  {
    id: "tensor",
    title: "训练与评估：划分、过拟合与泄漏",
    track: "common",
    prerequisites: ["autograd"],
    outcome: "完成一次完整训练-验证-测试流程，识别数据泄漏，用独立测试集支撑“模型变好了”的结论。",
    tags: ["数据划分", "过拟合", "测试泄漏", "泛化"],
    level: "基础",
    lab: null,
    sourceRef: { textbook: "dive-into-llms", chapter: null },
    minutes: { value: 55, basis: "estimate" },
    cost: "免费（CPU 数秒内完成）。",
    conditions: "Python 环境；数据由脚本内置生成。",
    problem:
      "你调参后“准确率 99%”，上线后只有 70%。训练表现和真实表现之间隔着验证纪律：划分时机、预处理拟合位置、重复信息。",
    predict: "把 StandardScaler 在整个数据集上拟合后再划分，测试指标会偏高还是偏低？为什么？",
    steps: [
      {
        title: "三种数据、三种用途",
        body:
          "训练集拟合参数；验证集选择超参/早停；测试集只在最后评估一次。预处理（均值方差、词表、缺失填补）必须只在训练集上拟合，再应用到验证/测试。",
        formulas: [
          {
            name: "泛化差距",
            expr: "gap = L_test − L_train",
            dims: "L 为同一损失函数下的标量",
            note: "gap 大提示过拟合；两者都差提示欠拟合。",
          },
        ],
        code: {
          lang: "python",
          run: "python",
          src:
            "import torch\n"
            + "from torch.utils.data import TensorDataset, random_split\n"
            + "torch.manual_seed(0)\n"
            + "X = torch.randn(1000, 8)\n"
            + "y = (X[:,0] + 0.5*X[:,1] + 0.1*torch.randn(1000) > 0).long()\n"
            + "n_train, n_val, n_test = 640, 180, 180\n"
            + "train, val, test = random_split(TensorDataset(X, y), [n_train, n_val, n_test])\n"
            + "print(len(train), len(val), len(test))",
          expected: "640 180 180",
        },
        pitfalls: [
          "先对所有数据做归一化/特征选择，再划分——信息泄漏。",
          "时间序列随机划分——未来信息进入训练。",
          "测试集被反复“看结果”后事实上变成了验证集。",
        ],
      },
      {
        title: "训练一个最小分类器并监控两种 loss",
        body: "每个 epoch 记录 train/val loss；val 上升而 train 下降即过拟合信号，此时应早停或正则化。",
        code: {
          lang: "python",
          run: "python",
          src:
            "# 完整脚本见 experiments/basics/train_eval.py（含泄漏对照开关）\n"
            + "python experiments/basics/train_eval.py --leaky      # 泄漏版：测试虚高\n"
            + "python experiments/basics/train_eval.py              # 正确版",
          expected:
            "正确版 test acc ≈ 0.80±0.05；泄漏版可能 0.85+。两次的 train/val 曲线与 JSON 记录可直接对比。",
        },
        modify: {
          brief: "把隐藏层宽度从 32 改为 128，预测过拟合变化，再用 val 曲线验证预测。",
          starter: "改 --width 参数。",
          checks: ["预测先行", "曲线证据支持结论"],
        },
      },
      {
        title: "诊断一次可疑的高分",
        body:
          "“验证集 99% 但上线翻车”的排查清单：输入特征里是否有“结果之后才能算出来”的派生列（标签代理）——这是最常见的泄漏；划分是否在预处理之后；是否存在重复样本跨集合；特征是否含目标的时间后信息；评估代码是否算错了集合。",
        code: {
          lang: "python",
          run: "python",
          src:
            "# 泄漏对照（真实可运行）\n"
            + "python experiments/basics/train_eval.py --leaky --epochs 40 --width 64\n"
            + "python experiments/basics/train_eval.py --epochs 40 --width 64",
          expected:
            "泄漏版 test_acc≈1.00（输入里混入了标签代理列）；正确版≈0.86。对比两组 JSON 记录的 metrics 即可复现差距。",
        },
        modify: {
          brief: "在 --leaky 记录里找出泄漏通道（事后派生列 + scaler 全量拟合），修复后复测，提交前后指标对比。",
          starter: "train_eval.py 的 run() 函数，leaky 分支。",
          checks: ["定位到具体代码行", "修复后泄漏差距消失", "说明两个泄漏通道各自的危害"],
        },
      },
      {
        title: "独立验证",
        body: "换一个随机种子重复 3 次，报告指标的均值与波动——单次结果不是结论。",
        verify: {
          task: "3 个种子的 test acc 均值±标准差。",
          evidence: "运行记录 ×3。",
        },
        limits: "玩具任务不能替代真实规模；但划分纪律在任何规模都一样。",
      },
    ],
    depths: {
      intuition: "考试（测试集）只能考一次；平时作业（训练）和模拟考（验证）都做过了，只有期末考能说明掌握。",
      engineering: "生产中用交叉验证选模型、时间序列用滚动划分；特征管道用 Pipeline 封装避免泄漏。",
      research: "分布偏移下的评估（OOD）、基准污染（测试题进入预训练语料）是当前热点问题。",
    },
    references: [
      {
        title: "PyTorch Dataset 与 DataLoader",
        kind: "官方文档",
        url: "https://docs.pytorch.org/tutorials/beginner/basics/data_tutorial.html",
        verified: { date: "2026-11-16", env: "公开网页" },
      },
    ],
    quiz: [
      {
        id: "tensor-q1",
        kind: "fault",
        capability: "diagnosed",
        prompt: "同事声称新模型把 AUC 从 0.82 提到 0.95，但他的划分代码里 scaler.fit(X_all)。你会指出什么并要求补什么证据？",
        rubric: ["指出泄漏方向", "要求修复后复测", "要求多种子"],
      },
      {
        id: "tensor-q2",
        kind: "unseen",
        capability: "verified",
        prompt: "时间序列预测任务里“随机划分”为什么危险？给出正确的划分方式。",
        rubric: ["未来信息泄漏", "滚动/按时间切分", "提到 embargo/gap"],
      },
    ],
  },
];
