#!/usr/bin/env node
/**
 * CI 守卫：确保部署到 GitHub Pages 的产物里有可用的 API 地址。
 *
 * 为什么需要它：
 *   Vite 把 VITE_API_BASE_URL 在「构建期」内联进 JS。一旦该变量为空，
 *   前端会静默退回同源 /api —— 在 Pages 上同源请求必然 404，但构建阶段
 *   一切正常、没有任何报错，排查成本极高（线上表现为「登录一直失败」）。
 *   所以这里在 CI 里显式失败，把问题拦在构建期。
 *
 * 用法：node scripts/check-api-base.mjs
 *   有值  → 打印并退出 0
 *   空值  → 打印排查指引并退出 1
 */
const raw = (process.env.VITE_API_BASE_URL || '').trim()

const isAbsoluteHttp = /^https?:\/\/[^/\s]+/i.test(raw)

if (!raw) {
  console.error(`
\x1b[31m[check-api-base] 构建失败：VITE_API_BASE_URL 为空。\x1b[0m

GitHub Pages 只能托管静态文件，前端必须知道外部 API 的绝对地址；
留空会退回同源 /api，部署后所有请求都会打到 <user>.github.io 并 404。

排查顺序：
  1. 变量配成了 Environment 作用域？
     Settings → Environments → github-pages → Variables
     本工作流的 build job 已声明 environment: github-pages，可直接读取；
     若你只想配仓库级，请到 Settings → Secrets and variables → Actions → Variables。
  2. 配成了 Secret 而不是 Variable？
     工作流同时兼容 vars 与 secrets，但两者名字必须都是 VITE_API_BASE_URL。
  3. 变量名拼写 / 大小写不一致（必须全大写 + 下划线）。
  4. 改完变量后需要重新运行工作流，旧产物不会自动更新。
`)
  process.exit(1)
}

if (!isAbsoluteHttp) {
  console.error(`
\x1b[31m[check-api-base] 构建失败：VITE_API_BASE_URL 不是合法的 http(s) 绝对地址。\x1b[0m

当前值：${JSON.stringify(raw)}

必须形如：
  https://api.example.com
  http://127.0.0.1:8787      ← 本地 Mock（仅演示，只有你自己机器能访问）

不要写成相对路径（/api、api）或以斜杠结尾。
`)
  process.exit(1)
}

console.log(`[check-api-base] OK → ${raw}`)
