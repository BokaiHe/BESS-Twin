import type { ScenarioId, SimulationDay, TwinDataSource } from '../domain/types'
import { simulateDay } from '../simulation/engine'

export class SimulationSource implements TwinDataSource {
  readonly mode = 'simulation' as const
  private readonly cache = new Map<ScenarioId, SimulationDay>()
  async loadDay(id: ScenarioId): Promise<SimulationDay> {
    let day = this.cache.get(id)
    if (!day) {
      day = simulateDay(id)
      this.cache.set(id, day)
    }
    return day
  }
}
export const simulationSource: TwinDataSource = new SimulationSource()
