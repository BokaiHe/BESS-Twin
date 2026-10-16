export const PROJECT_SOURCE = 'https://github.com/BokaiHe/BESS-Twin'
interface ProjectCopy {
  tabs: [string, string]
  title: string
  intro: string
  decisionsTitle: string
  decisions: { title: string; body: string }[]
  architecture: string
  stages: { title: string; body: string }[]
  checksTitle: string
  checks: string
  limitsTitle: string
  limits: string
  source: string
  demo: string
}
export const projectCopy: Record<'en' | 'zh', ProjectCopy> = {
  en: {
    tabs: ['Model assumptions', 'About this project'],
    title: 'Make an energy system understandable.',
    intro:
      'BESS Twin is an interactive portfolio and learning project. It connects renewable generation, battery storage, the grid and consumers so beginners can explore why storage charges, when it discharges, and how power differs from energy capacity.',
    decisionsTitle: 'Decisions that keep the story honest',
    decisions: [
      {
        title: 'A day without free starting energy',
        body: 'Sunny and cloudy scenarios solve for a periodic steady state: end-of-day stored energy matches the start. Fault days inherit the sunny state for the same parameters. Non-convergence is visible.',
      },
      {
        title: 'Less electricity served is not a saving',
        body: 'When designs supply different amounts of energy, their bills are marked not directly comparable. Unserved energy is reported separately; inverter clipping and network curtailment also remain separate.',
      },
      {
        title: 'One snapshot, many views',
        body: 'The timeline reads immutable precomputed minute snapshots. Charts, equipment cards, topology flows and explorer states share those results. Seeking never integrates energy or money again.',
      },
      {
        title: 'Calculation off the main thread',
        body: 'A Web Worker calculates the day. Caching and idle prewarming avoid repeated work, and only a matching result can update the selected design and scenario.',
      },
    ],
    architecture: 'How the pieces connect',
    stages: [
      {
        title: 'Parameters + scenario',
        body: 'Validated capacities, limits, tariffs and a full-day weather/event script.',
      },
      {
        title: 'Simulation in a Worker',
        body: 'Dispatch, physical constraints, steady-state solving and energy accounting.',
      },
      {
        title: 'Immutable results',
        body: 'SimulationDay → minute Snapshot; original and proposed designs share comparison conditions.',
      },
      {
        title: 'Views + learning',
        body: '3D park, charts, cutaways, water-tank analogy, lessons, challenges and energy-flow attribution.',
      },
    ],
    checksTitle: 'Evidence, not a live test counter',
    checks:
      'Before this documentation step, the local verification baseline was 123 unit tests and 89 browser tests passing (16 October 2026). Coverage includes power balance, SOC and import limits, deterministic seeking, challenge feasibility, state restoration, keyboard use and mobile layouts. The repository verification log records later runs; this page does not run tests.',
    limitsTitle: 'What this project represents',
    limits:
      'Illustrative parameters and simulated data, not an operating site or remote-control system. Voltage labels are nominal, explorer motion is schematic, and flow attribution does not track individual electrons. The model is not an engineering design, bankable forecast or investment recommendation.',
    source: 'View source on GitHub',
    demo: 'A reproducible 30-second recording and its storyboard are included in the repository. Local learning-edition features may be ahead of the published demo.',
  },
  zh: {
    tabs: ['模型假设', '关于这个项目'],
    title: '让能源系统变得容易理解。',
    intro:
      'BESS Twin 是一个交互式作品集与学习项目。它连接风光发电、储能、电网和用户，让初学者理解储能为什么充电、何时放电，以及功率和容量的区别。',
    decisionsTitle: '让演示可信的关键决定',
    decisions: [
      {
        title: '不把初始电量当作免费收益',
        body: '晴天和阴天求解周期稳态，使期末储存电量与期初一致。故障日沿用相同参数下的晴天状态；未收敛会明确提示。',
      },
      {
        title: '少供电不能算省钱',
        body: '两方案供电量不同时，电费标为不可直接比较。未供电量单独报告，逆变器削顶与网络弃电也分别统计。',
      },
      {
        title: '一份快照驱动所有视图',
        body: '时间轴只读取预计算的不可变分钟快照。曲线、设备卡片、拓扑流向和探索器共用结果，拖动时间不会重新累加电量或电费。',
      },
      {
        title: '在后台线程计算',
        body: 'Web Worker 计算全天结果；缓存与空闲预计算减少重复工作。只有匹配当前请求的结果才能更新方案和情景。',
      },
    ],
    architecture: '各部分如何连接',
    stages: [
      { title: '参数与情景', body: '校验后的容量、功率、并网限制、电价和全天气象事件剧本。' },
      { title: '后台仿真', body: '调度、物理约束、稳态求解和能量核算。' },
      {
        title: '不可变结果',
        body: '全天结果 SimulationDay → 分钟快照 Snapshot；原方案与新方案保持同条件对比。',
      },
      { title: '视图与学习', body: '三维园区、曲线、剖视图、水箱类比、课程、挑战与能量去向归因。' },
    ],
    checksTitle: '验证依据，而非实时测试计数',
    checks:
      '本次说明页开发前，本地验证基线为 123 项单元测试和 89 项浏览器测试通过（2026 年 10 月 16 日）。覆盖功率守恒、SOC 与购电约束、拖动一致性、挑战可行解、状态恢复、键盘和手机布局。后续运行见仓库验证记录；本页面不执行测试。',
    limitsTitle: '项目的适用边界',
    limits:
      '示例参数与仿真数据，不代表真实项目或远程控制系统。电压标注为额定等级，探索器运动为示意，能量归因不追踪单个电子。本模型不构成工程设计、可融资预测或投资建议。',
    source: '在 GitHub 查看源码',
    demo: '仓库提供可重复录制的约 30 秒演示及分镜说明。本地学习版功能可能领先于已发布的演示。',
  },
}
