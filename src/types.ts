/** 与 Mock API 对齐的领域模型 */

export interface User {
  id: string
  email: string
  name: string
  role: string
  avatar: string
}

export interface LoginResponse {
  token: string
  tokenType: 'Bearer'
  expiresIn: number
  user: User
}

export interface Kpi {
  key: string
  label: string
  value: number
  unit: string
  trend: number
  hint: string
}

export interface SeriesPoint {
  date: string
  visits: number
  signups: number
  revenue: number
}

export interface Channel {
  key: string
  name: string
  color: string
  visits: number
  share: number
}

export interface Overview {
  range: string
  kpis: Kpi[]
  series: SeriesPoint[]
  channels: Channel[]
  generatedAt: string
}

export type OrderStatus = 'paid' | 'pending' | 'refunded' | 'failed'

export interface Order {
  id: string
  customer: string
  plan: string
  amount: number
  currency: string
  status: OrderStatus
  createdAt: string
  owner: string
}

export interface OrderPage {
  items: Order[]
  total: number
  page: number
  pageSize: number
  summary: Record<OrderStatus | 'all', number>
}

export interface ApiEnvelope<T> {
  success: boolean
  data: T
  error?: { code: string; message: string }
}
