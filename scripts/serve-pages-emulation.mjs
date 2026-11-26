/**
 * 本地模拟 GitHub Pages 静态托管行为（仅用于验证部署形态）。
 *
 * 与真实 Pages 的关键一致点：
 *  1. 只返回 dist/ 下真实存在的文件；
 *  2. 未知路径返回 **404** 状态码 + 仓库根目录的 404.html；
 *  3. 站点挂在子路径 /<repo>/ 下（默认 /pages-demo/）。
 *
 * 用法：node scripts/serve-pages-emulation.mjs [--port 8080] [--repo pages-demo]
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const DIST = resolve(process.cwd(), 'dist')
const portFlag = process.argv.indexOf('--port')
const PORT = portFlag > -1 ? Number(process.argv[portFlag + 1]) : 8080
const repoFlag = process.argv.indexOf('--repo')
const REPO = repoFlag > -1 ? process.argv[repoFlag + 1] : 'pages-demo'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

async function tryFile(filePath) {
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return null
    return info
  } catch {
    return null
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  let pathname = decodeURIComponent(url.pathname)

  // 模拟 Pages 的项目站点前缀：/pages-demo/xxx
  if (!pathname.startsWith(`/${REPO}/`) && pathname !== `/${REPO}`) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
    return res.end(`<h1>404</h1><p>不在站点前缀 /${REPO}/ 下</p>`)
  }
  pathname = pathname.slice(REPO.length + 1) || '/'
  if (pathname.endsWith('/')) pathname += 'index.html'

  const target = normalize(join(DIST, pathname))
  if (!target.startsWith(DIST)) {
    res.writeHead(403).end('forbidden')
    return
  }

  const info = await tryFile(target)
  if (info) {
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': MIME[extname(target)] || 'application/octet-stream',
      'Content-Length': body.length,
      // 模拟 Pages 的缓存策略：入口页不缓存，带 hash 的静态资源长缓存
      'Cache-Control': target.endsWith('index.html')
        ? 'no-cache, max-age=0'
        : 'public, max-age=31536000, immutable',
    })
    return res.end(body)
  }

  // ★ Pages 的真实行为：未知路径 → 404 状态码 + 根目录 404.html
  const notFound = await tryFile(join(DIST, '404.html'))
  if (notFound) {
    const body = await readFile(join(DIST, '404.html'))
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length })
    return res.end(body)
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('404')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Pages 模拟托管：http://127.0.0.1:${PORT}/${REPO}/`)
  console.log('未知路径将返回 404 + dist/404.html（与 GitHub Pages 行为一致）')
})
