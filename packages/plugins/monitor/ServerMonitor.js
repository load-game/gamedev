import { System } from '../../core/systems/System.js'
import os from 'os'

export class ServerMonitor extends System {
  constructor(world) {
    super(world)
  }

  async getStats() {
    const memUsage = process.memoryUsage()
    const startCPU = process.cpuUsage()
    await new Promise(resolve => setTimeout(resolve, 100))
    const endCPU = process.cpuUsage(startCPU)
    const cpuPercent = (endCPU.user + endCPU.system) / 1000 / 100
    return {
      maxMemory: Math.round(os.totalmem() / 1024 / 1024),
      currentMemory: Math.round(memUsage.rss / 1024 / 1024),
      maxCPU: os.cpus().length * 100,
      currentCPU: cpuPercent,
    }
  }
}
