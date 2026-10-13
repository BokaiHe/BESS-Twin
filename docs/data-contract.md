# 数据接口与维护约定

契约定义：`src/domain/types.ts`。静态拓扑：`src/domain/topology.ts`。

## 三层数据

1. **静态 TopologyNode / TopologyEdge**：稳定 ID、设备类别、电压、额定配置、场景位置、支路端点及有功限值。
2. **Snapshot**（schemaVersion 2）：source、timestamp、receivedAt、quality、minute、nodes、edges、alarms、tariff、strategy、metrics。
   - `strategy`：`code`（语言无关的策略代码，如 `absorb`、`peak-discharge`）、`peakLevelMW`、`chargeTargetMWh`、`reserveMWh`、`replanned`。
   - `alarms[]`：`code`（`bess-temp-high` / `bess-overheat-trip`）、`severity`、`nodeId`、`startedAtMinute`。
   - `metrics` 新增 `storedMWh`、`storedDeltaMWh`。
   - 数据层不含任何界面文字；名称、策略说明和告警文本由 `src/i18n.tsx` 按语言翻译。
3. **SimulationDay**：有序 1,440 帧及完成全部积分后的 summary。

`TwinDataSource.loadDay(scenarioId)` 返回 `Promise<SimulationDay>`。已实现 SimulationSource；它是唯一创建/缓存仿真结果的数据适配层。App 支持通过 `source` 参数注入相同契约的数据源，组件不直接调用引擎。

真实接入可实现同样的历史日加载，并实现可选 `subscribe(onSnapshot)`。第一阶段 UI 目前使用 loadDay 回放；持续实时订阅、非剧本时间范围选择和质量状态 UI 尚待真实接入阶段实现，不能仅凭接口存在就称为已接入。

## 功率符号

- 节点 `injectionMW > 0`：向网络注入；小于零：从网络取电。
- 边 `powerMW > 0`：按静态拓扑 `from → to`；小于零：反向。
- BESS 边方向为 `bus → bess`，所以边正值是充电，节点正值是放电。
- 界面卡片和设备详情显示绝对值 + 方向文字，曲线明确标注“放电为正 / 充电为负”。
- 每个节点满足 `injection + incoming − outgoing = 0`。

支路只提供 `activeUtilizationPct = abs(powerMW) / capacityMW × 100`，称“有功传输占用率”，不是电流或视在功率热负载率。

## SOC 与可用性

`socPct`：全部四台设备按 20 MWh 安装容量加权，故障后仍保留离线电量。

`onlineSocPct`：在线设备按在线容量加权。

`onlinePowerLimitMW`：在线机组额定功率之和，不保证这些功率都能立即输出。

`availableDischargeMW`：当前一分钟内受 SOC 下限、效率及单元额定功率限制后的能力。

## 真实适配器必须补充的校验

- 不直接信任 JSON 的 TypeScript 断言；需验证 schemaVersion、节点/边 ID、有限数值、单位和符号。
- 不使用零填充缺失设备数据。用 quality = missing/stale/disconnected，保留最近有效时间并由 UI 明确展示。
- timestamp 为测量有效时间，receivedAt 为接收时间；对齐时区、乱序与采样步长。
- 校准 AC/DC 计量位置、初末 SOC、费用统计范围及故障状态。
- 不把这里的理想化有功仿真当成现场保护或控制算法。

## 可维护性约束

- domain 和 simulation 禁止依赖 React、Canvas 或帧率。
- 界面禁止修改快照或在 seek 时积分。
- 所有设备/边引用稳定 ID；禁止在模型动画中另写功率或随机数。
- 修改调度规则后运行 Vitest；修改布局/交互后运行相应浏览器测试及生产构建。
- 分钟快照供图表回放，动画的过渡插值不得反向写入业务状态。

## 费用拆解与导出

`simulation/savings.ts` 按 `[0, endMinute)` 计算统一统计窗口；`endMinute = 1440` 使用全天结束状态，否则对应该分钟快照起点。

- `billDifferenceCny`：原始账单差额，即无储能基准电费减当前方案电费。
- `estimatedSavingsCny`：基准未供电量超过引擎数值容差时为 null；详情面板不显示节省率。报告对应字段为 `daySavingsCny`。
- `storedDeltaMWh`：统计期结束时总存量相对 00:00 的变化。
- `offlineStoredMWh`：统计期结束时冻结在离线单元的电量，当前不可调度；不是存量变化的组成量。

故障日首尾电量不要求相同。费用只计算购售电账单，不对期末库存变化进行货币估值。
