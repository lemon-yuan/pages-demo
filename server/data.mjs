/**
 * 模拟业务数据（确定性生成，保证每次启动结果一致，便于截图/对拍）
 * 仅用于演示：真实项目应替换为数据库 + 业务服务。
 */

const DAY = 24 * 60 * 60 * 1000

// 固定种子的伪随机，保证每次启动数据一致
function mulberry32(seed) {
  let a = seed >>> 0
  return function random() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const USERS = [
  {
    id: 'u_1001',
    email: 'demo@example.com',
    password: 'demo1234',
    name: '演示用户',
    role: '产品负责人',
    avatar: 'DE',
  },
  {
    id: 'u_1002',
    email: 'admin@example.com',
    password: 'admin1234',
    name: '管理员',
    role: '平台管理员',
    avatar: 'AD',
  },
]

const CHANNELS = [
  { name: '自然搜索', key: 'organic', color: '#5b8cff' },
  { name: '社交媒体', key: 'social', color: '#9d6bff' },
  { name: '直接访问', key: 'direct', color: '#35e0c0' },
  { name: '推荐链接', key: 'referral', color: '#ffb454' },
]

const ORDER_STATUS = ['paid', 'pending', 'refunded', 'failed']

const PLANS = ['Starter', 'Growth', 'Scale', 'Enterprise']

const CUSTOMERS = [
  '云图科技',
  '星野设计',
  '杭州禾木',
  '深圳蓝鲸',
  '成都方寸',
  '北京知微',
  '上海拾光',
  '广州潮汐',
  '南京青柚',
  '武汉光合',
  '西安云栖',
  '苏州折叠',
]

/** 生成最近 N 天的访问/注册序列 */
export function buildSeries(days) {
  const rand = mulberry32(20260101 + days)
  const out = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today.getTime() - i * DAY)
    const weekday = d.getDay()
    // 周末流量略低，加一点增长趋势
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.72 : 1
    const growth = 1 + ((days - i) / days) * 0.045
    const visits = Math.round((1350 + rand() * 480) * weekendFactor * growth)
    const signups = Math.round(visits * (0.085 + rand() * 0.035))
    const revenue = Math.round(signups * (260 + rand() * 160))
    out.push({
      date: d.toISOString().slice(0, 10),
      visits,
      signups,
      revenue,
    })
  }
  return out
}

export function buildOverview(range) {
  const days = range === '30d' ? 30 : 7
  const series = buildSeries(days)
  const sum = (key) => series.reduce((acc, item) => acc + item[key], 0)
  // 环比：后 3 天日均 vs 前 3 天日均（用均值而非求和，避免天数不等带来的误差）
  const avg = (items, key) => items.reduce((acc, item) => acc + item[key], 0) / items.length
  const head = series.slice(0, 3)
  const tail = series.slice(-3)
  const prevVisits = avg(head, 'visits')
  const currVisits = avg(tail, 'visits')
  const trend = prevVisits === 0 ? 0 : ((currVisits - prevVisits) / prevVisits) * 100

  const rand = mulberry32(days * 97)
  const channelTotal = sum('visits')
  const channels = CHANNELS.map((c, i) => {
    const weight = [0.42, 0.24, 0.21, 0.13][i]
    return {
      ...c,
      visits: Math.round(channelTotal * weight),
      share: Math.round(weight * 1000) / 10,
    }
  })

  return {
    range: `${days}d`,
    kpis: [
      {
        key: 'visits',
        label: '访问量',
        value: sum('visits'),
        unit: '',
        trend: Math.round(trend * 10) / 10,
        hint: '较周期初',
      },
      {
        key: 'signups',
        label: '新增注册',
        value: sum('signups'),
        unit: '',
        trend: Math.round((trend + 2.4) * 10) / 10,
        hint: '较周期初',
      },
      {
        key: 'revenue',
        label: '成交金额',
        value: sum('revenue'),
        unit: 'CNY',
        trend: Math.round((trend + 5.1) * 10) / 10,
        hint: '较周期初',
      },
      {
        key: 'conversion',
        label: '转化率',
        value: Math.round((sum('signups') / sum('visits')) * 1000) / 10,
        unit: '%',
        trend: Math.round((rand() * 3 - 1) * 10) / 10,
        hint: '注册 / 访问',
      },
    ],
    series,
    channels,
  }
}

/** 生成订单列表（含分页/筛选/搜索） */
export function queryOrders({ status = 'all', page = 1, pageSize = 8, q = '' } = {}) {
  const rand = mulberry32(424242)
  const all = Array.from({ length: 37 }, (_, i) => {
    const statusKey = ORDER_STATUS[Math.floor(rand() * ORDER_STATUS.length)]
    const plan = PLANS[Math.floor(rand() * PLANS.length)]
    const amount = Math.round((199 + rand() * 4800) * 100) / 100
    const daysAgo = Math.floor(rand() * 21)
    const created = new Date(Date.now() - daysAgo * DAY - Math.floor(rand() * 8) * 3600_000)
    return {
      id: `ORD-${String(20260000 + i * 7).slice(0, 8)}`,
      customer: CUSTOMERS[i % CUSTOMERS.length],
      plan,
      amount,
      currency: 'CNY',
      status: statusKey,
      createdAt: created.toISOString(),
      owner: i % 3 === 0 ? '演示用户' : i % 3 === 1 ? '管理员' : '系统',
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const keyword = q.trim().toLowerCase()
  const filtered = all.filter((order) => {
    const matchStatus = status === 'all' || order.status === status
    const matchKeyword =
      !keyword ||
      order.id.toLowerCase().includes(keyword) ||
      order.customer.toLowerCase().includes(keyword) ||
      order.plan.toLowerCase().includes(keyword)
    return matchStatus && matchKeyword
  })

  const size = Math.max(1, Math.min(50, Number(pageSize) || 8))
  const current = Math.max(1, Number(page) || 1)
  const start = (current - 1) * size
  return {
    items: filtered.slice(start, start + size),
    total: filtered.length,
    page: current,
    pageSize: size,
    summary: {
      all: all.length,
      paid: all.filter((o) => o.status === 'paid').length,
      pending: all.filter((o) => o.status === 'pending').length,
      refunded: all.filter((o) => o.status === 'refunded').length,
      failed: all.filter((o) => o.status === 'failed').length,
    },
  }
}

export const SEED_USERS = USERS
