import { reactive } from 'vue'

export interface RequestLogItem {
  id: number
  method: string
  path: string
  status: number | 'ERR'
  ms: number
  at: string
  note?: string
}

const MAX_ITEMS = 12
let seed = 0

/** 全局请求日志：用于在演示界面里直观看到"前端 → API"的每一次往返 */
export const requestLog = reactive<RequestLogItem[]>([])

export function logRequest(item: Omit<RequestLogItem, 'id' | 'at'>) {
  seed += 1
  requestLog.unshift({
    ...item,
    id: seed,
    at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
  })
  if (requestLog.length > MAX_ITEMS) requestLog.length = MAX_ITEMS
}
