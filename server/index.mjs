#!/usr/bin/env node
/**
 * 模拟后端（Mock API）——零依赖，只用 Node 内置模块。
 *
 * 目的：在本地验证"GitHub Pages 上托管的前端 → 本地/远端 API"这条链路，
 *      包含【登录鉴权】【数据 API】【CORS 预检】【限流】【请求日志】。
 *
 * 启动：node server/index.mjs        （或 npm run server）
 * 端口：API_PORT，默认 8787
 */
import { createServer } from 'node:http'
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { buildOverview, queryOrders, SEED_USERS } from './data.mjs'

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------
const PORT = Number(process.env.API_PORT || 8787)
const HOST = process.env.API_HOST || '0.0.0.0'
const TOKEN_TTL_SECONDS = Number(process.env.TOKEN_TTL || 7200)
const SECRET = process.env.MOCK_API_SECRET || 'pages-demo-dev-secret-do-not-use-in-prod'

/** 默认放行本地开发/预览端口 */
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]
const EXTRA_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/** 允许任意 *.github.io 来源（演示部署后的前端） */
const ALLOW_GH_PAGES = process.env.ALLOW_GITHUB_PAGES !== 'false'
const GH_PAGES_RE = /^https:\/\/[a-z0-9-]+\.github\.io$/

/** 放行任意本机端口的来源：本地常换端口（5173/4173/8080…），逐个配置太啰嗦 */
const ALLOW_LOOPBACK = process.env.ALLOW_LOOPBACK !== 'false'
const LOOPBACK_RE = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/

const ALLOWED_ORIGINS = new Set([...DEFAULT_ORIGINS, ...EXTRA_ORIGINS])

function isAllowedOrigin(origin) {
  if (!origin) return false
  if (ALLOWED_ORIGINS.has(origin)) return true
  if (ALLOW_LOOPBACK && LOOPBACK_RE.test(origin)) return true
  if (ALLOW_GH_PAGES && GH_PAGES_RE.test(origin)) return true
  return false
}

// ---------------------------------------------------------------------------
// 一个极简的签名 token（JWT 同构：header.payload.signature），仅演示用
// ---------------------------------------------------------------------------
const b64url = (buf) => Buffer.from(buf).toString('base64url')

function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, sig] = parts
  const expected = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// 极简滑动窗口限流
// ---------------------------------------------------------------------------
const buckets = new Map()
function rateLimit(key, limit, windowMs) {
  const now = Date.now()
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs)
  hits.push(now)
  buckets.set(key, hits)
  return { ok: hits.length <= limit, remaining: Math.max(0, limit - hits.length) }
}
setInterval(() => {
  const now = Date.now()
  for (const [key, hits] of buckets) {
    const alive = hits.filter((t) => now - t < 60_000)
    if (alive.length === 0) buckets.delete(key)
    else buckets.set(key, alive)
  }
}, 60_000).unref()

// ---------------------------------------------------------------------------
// HTTP 辅助
// ---------------------------------------------------------------------------
function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Request-Id',
    'Access-Control-Expose-Headers': 'X-Request-Id,X-Api-Version',
    // Chrome Private Network Access：公网 HTTPS 页面访问 127.0.0.1 需要该响应头
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

function send(res, status, body, extraHeaders = {}) {
  const payload = body === undefined ? '' : JSON.stringify(body)
  const origin = res.__origin
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    'X-Api-Version': '2026-11-demo',
    ...corsHeaders(origin),
    ...extraHeaders,
  })
  res.end(payload)
}

const ok = (res, data) => send(res, 200, { success: true, data })
const fail = (res, status, code, message) =>
  send(res, status, { success: false, error: { code, message } })

async function readJson(req, limit = 64 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('PAYLOAD_TOO_LARGE')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('INVALID_JSON')
  }
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
  }
}

function authUser(req) {
  const raw = req.headers.authorization || ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
  const payload = verifyToken(token)
  if (!payload) return null
  const user = SEED_USERS.find((u) => u.id === payload.sub)
  return user ? { user, payload } : null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  const startedAt = Date.now()
  const origin = req.headers.origin
  res.__origin = origin

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const requestId = randomUUID().slice(0, 8)

  // 请求日志
  res.on('finish', () => {
    const ms = Date.now() - startedAt
    const status = res.statusCode
    const color = status >= 500 ? 31 : status >= 400 ? 33 : 32
    console.log(
      `\x1b[90m[${new Date().toLocaleTimeString('zh-CN', { hour12: false })}]\x1b[0m ` +
        `${req.method.padEnd(6)} \x1b[${color}m${status}\x1b[0m ${path} ` +
        `\x1b[90m${ms}ms ${origin || '-'}\x1b[0m`,
    )
  })

  // CORS 预检：必须在业务逻辑之前返回
  if (req.method === 'OPTIONS') {
    if (origin && !isAllowedOrigin(origin)) {
      return send(res, 403, { success: false, error: { code: 'ORIGIN_NOT_ALLOWED', message: origin } })
    }
    res.writeHead(204, { ...corsHeaders(origin), 'X-Request-Id': requestId })
    return res.end()
  }

  // 来源校验：浏览器跨域请求一律校验 Origin
  if (origin && !isAllowedOrigin(origin)) {
    return fail(res, 403, 'ORIGIN_NOT_ALLOWED', `来源未授权：${origin}`)
  }

  try {
    // ---- 健康检查（公开）----
    if (path === '/api/health' && req.method === 'GET') {
      return ok(res, {
        status: 'ok',
        service: 'pages-demo-mock-api',
        version: '2026.11.26',
        runtime: `node ${process.version}`,
        uptimeSeconds: Math.round(process.uptime()),
        serverTime: new Date().toISOString(),
        requestId,
      })
    }

    // ---- 登录 ----
    if (path === '/api/auth/login' && req.method === 'POST') {
      const ip = req.socket.remoteAddress || 'unknown'
      const limit = rateLimit(`login:${ip}`, 10, 60_000)
      if (!limit.ok) return fail(res, 429, 'TOO_MANY_REQUESTS', '尝试过于频繁，请稍后再试')

      const body = await readJson(req)
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      await sleep(320) // 模拟网络/校验耗时，便于观察 loading 态

      const user = SEED_USERS.find((u) => u.email === email)
      if (!user || user.password !== password) {
        return fail(res, 401, 'INVALID_CREDENTIALS', '邮箱或密码不正确')
      }

      const iat = Math.floor(Date.now() / 1000)
      const token = signToken({
        sub: user.id,
        email: user.email,
        iat,
        exp: iat + TOKEN_TTL_SECONDS,
        jti: randomUUID(),
      })
      return ok(res, {
        token,
        tokenType: 'Bearer',
        expiresIn: TOKEN_TTL_SECONDS,
        user: publicUser(user),
      })
    }

    // ---- 当前用户 ----
    if (path === '/api/auth/me' && req.method === 'GET') {
      const auth = authUser(req)
      if (!auth) return fail(res, 401, 'UNAUTHORIZED', '登录状态已失效，请重新登录')
      return ok(res, { user: publicUser(auth.user), expiresAt: auth.payload.exp * 1000 })
    }

    // ---- 登出（无状态 token：前端丢弃即可，这里留出审计位）----
    if (path === '/api/auth/logout' && req.method === 'POST') {
      return ok(res, { loggedOut: true })
    }

    // ---- 概览数据 ----
    if (path === '/api/metrics/overview' && req.method === 'GET') {
      const auth = authUser(req)
      if (!auth) return fail(res, 401, 'UNAUTHORIZED', '未登录或登录已过期')
      const range = url.searchParams.get('range') === '30d' ? '30d' : '7d'
      await sleep(180)
      return ok(res, { ...buildOverview(range), generatedAt: new Date().toISOString() })
    }

    // ---- 订单列表 ----
    if (path === '/api/orders' && req.method === 'GET') {
      const auth = authUser(req)
      if (!auth) return fail(res, 401, 'UNAUTHORIZED', '未登录或登录已过期')
      await sleep(120)
      return ok(
        res,
        queryOrders({
          status: url.searchParams.get('status') || 'all',
          page: url.searchParams.get('page') || 1,
          pageSize: url.searchParams.get('pageSize') || 8,
          q: url.searchParams.get('q') || '',
        }),
      )
    }

    return fail(res, 404, 'NOT_FOUND', `接口不存在：${req.method} ${path}`)
  } catch (error) {
    if (error.message === 'INVALID_JSON') {
      return fail(res, 400, 'INVALID_JSON', '请求体不是合法 JSON')
    }
    if (error.message === 'PAYLOAD_TOO_LARGE') {
      return fail(res, 413, 'PAYLOAD_TOO_LARGE', '请求体过大')
    }
    console.error('[mock-api] unhandled error:', error)
    return fail(res, 500, 'INTERNAL_ERROR', '服务内部错误')
  }
})

server.listen(PORT, HOST, () => {
  const line = '─'.repeat(64)
  console.log(`\x1b[36m${line}\x1b[0m`)
  console.log('\x1b[1m  Mock API 已启动\x1b[0m  (仅供本地演示)')
  console.log(`  地址      http://127.0.0.1:${PORT}`)
  console.log(`  健康检查  GET  /api/health`)
  console.log(`  登录      POST /api/auth/login   demo@example.com / demo1234`)
  console.log(`  数据      GET  /api/metrics/overview?range=7d`)
  console.log(`            GET  /api/orders?status=all&page=1&pageSize=8`)
  console.log(`  CORS 放行 ${[...ALLOWED_ORIGINS].join(', ')}`)
  console.log(`            ${ALLOW_LOOPBACK ? '任意 localhost / 127.0.0.1 / [::1] 端口' : '（未放行 loopback）'}`)
  console.log(`            ${ALLOW_GH_PAGES ? '任意 https://*.github.io' : '（未放行 github.io）'}`)
  console.log(`\x1b[36m${line}\x1b[0m`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log('\n[mock-api] 正在关闭…')
    server.close(() => process.exit(0))
  })
}
