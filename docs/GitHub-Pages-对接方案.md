# GitHub Pages 对接方案

> 版本：v1.0 ｜ 日期：2026-11-26 ｜ 适用：前端静态站点（SPA / 文档站 / 营销页）
> 配套 Demo：本仓库（Vite + Vue3 + TypeScript + 本地 Mock API）

---

## 1. 结论先行

| 判断项 | 结论 |
| --- | --- |
| GitHub Pages 能托管什么 | **纯静态文件**（HTML/CSS/JS/图片/font，无需服务端渲染即可运行的产物） |
| 不能托管什么 | 任何服务端逻辑：Node/Java/Python 运行时、数据库、SSR、图片处理、密钥保管 |
| 推荐场景 | 内部工具前端、演示站、文档站、组件库示例、开源项目主页、草稿原型 |
| 不推荐场景 | 电商/在线交易、需要保密的凭据、超大流量站点、需要服务端渲染 SEO 的营销站 |
| 本项目采用 | **前端 → GitHub Pages（GitHub Actions 构建发布）；数据 → 独立部署的 HTTP API** |

一句话架构：**Pages 只负责「把前端送上门」，业务数据全部由你自己的 API 提供，两者通过 HTTPS + CORS 解耦。**

```
浏览器 ──① 静态资源(GET index.html / assets/*.js)──▶ GitHub Pages CDN
   │
   └────② 业务数据(fetch + Authorization: Bearer)──▶ 自建 API（本地 Mock / 云端）
                                                     ↑ 不经过 Pages
```

---

## 2. GitHub Pages 能力与限制（决策依据）

来源：[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)、
[Configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)、
[Securing your site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)、
[Creating a custom 404 page](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)

### 2.1 硬性限制

| 项目 | 限制 | 对我们的影响 |
| --- | --- | --- |
| 站点体积 | 发布站点 ≤ **1 GB**，源仓库建议 ≤ 1 GB | 前端产物通常 1–5 MB，完全够用；不要放视频/大图 |
| 带宽 | **100 GB/月（soft）** | 月 PV 十万级以内基本无感；超限可能收到 GitHub 提醒或被限流 |
| 构建频率 | **10 次/小时（soft）**，**使用自定义 Actions 工作流时不受此限** | 我们走 Actions，不受影响 |
| 构建时长 | 单次部署 **10 分钟超时** | `npm ci + vite build` 通常 1–3 分钟，安全 |
| 限流 | 触发时返回 **HTTP 429** | 前端需容错，不要把它当 CDN SLA |
| 账号级站点 | 每个账号只能有 **1 个** `user/org` 站点 | 其余项目一律走「项目站点 `/<repo>/`」 |
| 仓库可见性 | 私有仓库部署 Pages 需 **Pro/Team/Enterprise** | GitHub Free 私有仓库无法发布 |

### 2.2 能力边界（关键）

- **没有服务端**：不能运行任何后端代码，没有反向代理、没有 rewrite 规则、没有环境变量注入、没有中间件。
- **HTTPS 自动提供**：`*.github.io` 站点默认 HTTPS；自定义域名可勾选 **Enforce HTTPS**（证书由 GitHub 自动申请）。
- **不支持服务端重定向/路由**：SPA 的深链接必须靠 **`404.html` + 前端兜底** 自己实现（见 §5.3）。
- **不支持敏感交易**：官方明确说明 Pages 不应承载密码、信用卡等敏感事务，**不可作为生产级认证入口**。
- **内容公开**：即使仓库是私有的，Pages 站点本身也是公网可访问的。

> 因此：**鉴权与数据只能放在你自己的 API 上**。Pages 上的前端只持有「短时效 token」，且 token 必须来自 API。

---

## 3. 两种发布模式对比与选型

| 维度 | Deploy from a branch | GitHub Actions（自定义工作流） |
| --- | --- | --- |
| 构建 | 分支内容直接发布（或 Jekyll 构建） | 完全自定义 `npm ci` / `vite build` |
| 适用 | 纯静态 HTML、Jekyll 博客 | **Vite/React/Vue/Next(static)/文档站** ✅ |
| 构建频率限制 | 10 次/小时 | 不受限制 |
| 产物隔离 | 需额外 `gh-pages` 分支 | 产物作为 artifact，不进代码库 |
| 权限控制 | 简单 | 支持 environment 保护规则、审批、回滚 |
| 结论 | 不选 | **选它** |

工作流骨架（本仓库 `.github/workflows/deploy.yml`）：

```yaml
permissions:
  contents: read      # 读代码
  pages: write        # 写 Pages
  id-token: write     # deploy-pages 走 OIDC，必需
concurrency:
  group: pages
  cancel-in-progress: false   # 不取消进行中的部署，避免线上半成品
```

步骤：`checkout` → `setup-node(cache: npm)` → `npm ci` → `typecheck` → **`vite build`（注入 API 地址）** → `configure-pages` → `upload-pages-artifact(dist)` → `deploy-pages`。

---

## 4. 目标架构

### 4.1 分层

| 层 | 选型 | 职责 | 部署位置 |
| --- | --- | --- | --- |
| 托管层 | GitHub Pages | 静态文件分发、TLS、CDN | GitHub 托管 |
| 应用层 | Vite + Vue3 + TS（SPA） | 路由、状态、渲染、调用 API | Pages（`/<repo>/`） |
| 接口层 | 任意 HTTP API（Demo 用 Node 内置模块） | 鉴权、业务数据、CORS | 自有服务器 / Serverless / 容器 |
| 验证层 | `scripts/serve-pages-emulation.mjs` | 本地复刻 Pages 托管行为（子路径 + 404 兜底） | 本地 :8080 |
| 配置层 | GitHub Actions Variables | 注入 `VITE_API_BASE_URL` 等构建期常量 | 仓库 Settings |

### 4.2 为什么「前端托管 + 后端独立」是正确解法

1. **职责单一**：Pages 的强项是「零运维分发静态文件」，别让它干不会干的事。
2. **可替换**：API 域名一换就能切环境（本地 / 测试 / 生产），前端镜像不用改。
3. **可演进**：当需要 SSR/边缘函数时，只换托管层（Cloudflare Pages、Vercel），接口层保持不变。
4. **安全边界清晰**：任何密钥都只存在于 API 侧；前端产物里**永远不要放 secret**。

---

## 5. 关键对接点（踩坑清单）

### 5.1 子路径 base：项目站点必须配 `base`

项目站点地址是 `https://<user>.github.io/<repo>/`，**不是**域名根目录。若 `base` 为 `/`，`/assets/index-xxx.js` 会 404 → 白屏。

```ts
// vite.config.ts
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = env.VITE_BASE || (process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/')
```

- 本仓库在 CI 中由 `GITHUB_REPOSITORY` 自动推断，**无需手改配置**；
- 用户/组织站点（`<user>.github.io` 仓库）路径深度为 0，自动得到 `/`；
- 本地 dev / preview 为 `/`，开发体验不受影响。

> 判定标准：`dist/index.html` 里资源路径应以 `/<repo>/assets/` 开头。

### 5.2 SPA 深链接：`404.html` 兜底

Pages 没有 rewrite。访问 `/repo/orders` 时服务器找不到文件，返回 **HTTP 404 + 仓库根目录的 `404.html`**。

本项目的做法（构建期由 Vite 插件生成 `dist/404.html`，路径深度按 `base` 自动注入）：

```js
// 404.html：把原始路径塞进 query，再跳回 index.html
var SEGMENTS = /* 项目站点 1，用户站点 0 */ 1
var parts = location.pathname.split('/').slice(1)
var keep = parts.slice(0, SEGMENTS).join('/')
var rest = '/' + parts.slice(SEGMENTS).join('/')
location.replace('/' + (keep ? keep + '/' : '') + '?__spa__=' + encodeURIComponent(rest + search + hash))
```

```js
// index.html：进入 SPA 前还原真实 URL
var spa = new URL(location.href).searchParams.get('__spa__')
if (spa) history.replaceState(null, '', new URL(spa.replace(/^\/+/, ''), document.baseURI).pathname)
```

**替代方案**：改用 `createWebHashHistory()`（`/#/orders`），零配置但 URL 变丑、不利于分享。演示项目选前者。

### 5.3 API 地址：构建期注入，而不是运行时猜

Pages 上没有 `.env` 也没有服务端注入，**构建那一刻**就必须知道 API 地址：

```yaml
- name: Build
  env:
    VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL }}   # 仓库 Variables
  run: npm run build
```

- 一份代码多环境：本地 `.env.local`、Pages 用 Variables、PR 预览可用另一套；
- **不要把 API 地址硬编码进组件**，统一收敛在 `src/api/client.ts`。

#### ⚠️ 实测踩坑：变量"配了但没生效"，页面请求同源 `github.io`

这是本方案落地时**最容易发生、且最难排查**的一类故障，因为它**不报错**：

- Vite 把 `VITE_API_BASE_URL` 在构建期内联进 JS。变量为空时，前端会**静默退回同源 `/api`**；
- 构建成功、部署成功、Actions 全绿，但运行时所有请求打到 `https://<user>.github.io/api/...` → 404；
- 典型误判："我在 deploy 日志里明明看到变量了" —— 那是 `deploy` job 的作用域，**不等于 `build` 读得到**。

**根因是 GitHub Actions 变量有三级作用域**，且 `environment` 只在声明了该环境的 job 里生效：

| 作用域 | 配置位置 | 谁能读到 |
| --- | --- | --- |
| Repository | Settings → Secrets and variables → Actions → Variables | 所有 job |
| **Environment** | Settings → Environments → `github-pages` → Variables | **只有声明了 `environment: github-pages` 的 job** |
| Organization | 组织级设置 | 所有 job（受策略约束） |

原工作流只在 `deploy` job 写了 `environment: github-pages`，`build` 没写。
于是变量若配在 **Environment** 作用域：deploy 读得到、build 读不到 → 产物里地址为空 → 请求同源。

**修复（本项目已实施，三点缺一不可）：**

```yaml
jobs:
  build:
    environment:
      name: github-pages          # ① build 也声明 environment，两种作用域都能读到
    steps:
      - name: Resolve API base
        env:
          VITE_API_BASE_URL: ${{ vars.VITE_API_BASE_URL || secrets.VITE_API_BASE_URL }}
        run: |
          node scripts/check-api-base.mjs   # ② 为空/非绝对地址 → 直接让构建失败
      - name: Build
        env:
          VITE_API_BASE_URL: ${{ steps.api-base.outputs.api_base }}
        run: npm run build
```

③ 运行时兜底：`src/api/client.ts` 检测到"公网域名 + 同源 base"时，在登录页直接展示
「API 地址未注入」及修复指引，而不是抛一个语焉不详的 404。

> **验收方式**：打开部署后的登录页，底部会显示 `当前 API: https://...`。
> 若显示"同源 /api（本地代理）"，说明注入失败。也可在 DevTools Network 里看
> `auth/login` 的真实请求域名。

### 5.4 CORS：后端必须显式放行 Pages 域名

浏览器从 `https://<user>.github.io` 请求 `https://api.example.com` 属于跨域，需要：

| 响应头 | 值 |
| --- | --- |
| `Access-Control-Allow-Origin` | 精确回显来源（或白名单），**不要**与 `Allow-Credentials: true` 搭配 `*` |
| `Access-Control-Allow-Methods` | `GET,POST,PUT,PATCH,DELETE,OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type,Authorization` |
| `Access-Control-Max-Age` | `600`（减少预检次数） |
| `Access-Control-Allow-Private-Network` | `true`（**Chrome 私有网络访问**：公网页面访问 `127.0.0.1` 时的预检要求） |
| `Vary` | `Origin`（避免 CDN 把 A 来源的响应缓存给 B 来源） |

另外两点容易翻车：

1. **`OPTIONS` 预检必须在业务逻辑之前返回 204**，且不能要求鉴权头——否则预检失败，真实请求根本发不出去。
2. **不要用 Cookie 做跨站鉴权**：`SameSite=Lax/Strict` + 第三方 Cookie 限制会让它在跨域场景下时灵时不灵。**用 `Authorization: Bearer` 头**，天然免疫这些问题。

### 5.5 混合内容（Mixed Content）与「本地 API」的硬限制

- Pages 是 **HTTPS** 页面。从 HTTPS 页面 `fetch('http://...')` 属于 **blockable mixed content，会被浏览器直接拦截**（[MDN](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)）。
- **例外**：`http://localhost` / `http://127.0.0.1` 被视为**安全来源**（secure context），因此「HTTPS 页面 → 本机 HTTP API」在 Chrome/Safari 上是允许的。这正是本项目 Demo 的形态。
- 但要注意：Firefox 对该例外的处理、以及企业代理/浏览器策略可能不同；且**访问者必须自己在本机跑着 API**，这个地址只对他自己有效。
- 因此 Demo 的定位是**架构演示**，不是「已上线的产品」。真上线时请让 API 也走 HTTPS（见 §7）。

### 5.6 缓存与版本

- Vite 产物默认 `assets/[name]-[hash].js`，可对 `/assets/*` 使用**长缓存 + immutable**；`index.html` 必须 **no-cache**。
- Pages 自带 CDN，刷新延迟通常几十秒；**部署后不要立刻断言「没生效」**，可强制刷新或换个无痕窗口。
- 回滚：Pages 部署有历史记录，在 Actions 里 **Re-run** 旧的成功部署，或回退 commit 后重新发布。

### 5.7 自定义域名（可选）

| 记录 | 主机 | 值 |
| --- | --- | --- |
| A | `@` | `185.199.108.153` / `185.199.109.153` / `185.199.110.153` / `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153` / `8001::153` / `8002::153` / `8003::153` |
| CNAME | `www` | `<user>.github.io` |

- 在仓库 Settings → Pages 填写 Custom domain 并勾选 **Enforce HTTPS**；
- **`CNAME` 文件不等于配置域名**：域名必须在仓库设置里配置（或走 API），只在仓库里放 `CNAME` 文件不会生效；
- 额外的 A/AAAA/CNAME 记录可能导致证书签发失败，配完记得做 DNS 检查。

### 5.8 安全与合规红线

- ❌ 不要在 Pages 产物里放任何密钥（`VITE_*` 变量会被**打包进 JS**，等同于公开）。
- ❌ 不要用 Pages 承载密码/支付类敏感事务；Demo 里的硬编码账号仅用于演示。
- ✅ token 用短时效 + 后端可撤销；刷新页面时用 `/auth/me` 校验而非盲信 localStorage。
- ✅ 后端对来源做白名单（本项目实现了 `Origin` 校验，非白名单返回 403）。
- ✅ 若站点是「学习用途复刻」，需在页面上显著声明与原站无关。

---

## 6. 与既有系统的对接步骤（Runbook）

假设已有一个 Vue/React 前端与一个 HTTP API，按此清单落地：

1. **确认仓库可见性**：私有仓库需 Pro/Team/Enterprise 才能开 Pages。
2. **设置发布源**：Settings → Pages → Source = **GitHub Actions**。
3. **加工作流**：复制 `.github/workflows/deploy.yml`，按需改 Node 版本与构建命令。
4. **配 `base`**：项目站点务必设置 `/<repo>/`（本仓库自动推断）。
5. **配 API 地址**：Settings → Secrets and variables → Actions → **Variables** 新增 `VITE_API_BASE_URL`。
   - 若配在 **Environment** 作用域（Environments → `github-pages` → Variables），
     必须确认 `build` job **也**声明了 `environment: github-pages`，否则构建期读不到；
   - 工作流已内置 `scripts/check-api-base.mjs`，变量为空会**直接让构建失败**，不会静默产出坏包。
6. **配 CORS**：后端白名单加入 `https://<user>.github.io`（或自定义域名），并实现 `OPTIONS` 预检。
7. **配 SPA 兜底**：非根路径路由必须提供 `404.html` 重定向方案，或改用 hash 路由。
8. **配鉴权**：前端只持有 API 签发的 token，用 `Authorization` 头传递；禁止 Cookie 跨站方案。
9. **首次部署**：push 到 `main`，观察 Actions 日志；在 `deploy` job 里能看到站点 URL。
10. **验收**（见 §8 的验证清单）：首页、深链接刷新、登录、数据加载、CORS 报错路径。

---

## 7. 风险与备选方案

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 100 GB/月带宽 / 429 限流 | 高流量时不可用 | 前置 CDN（Cloudflare）；静态资源压缩；改用对象存储 |
| 单点：GitHub 故障 | 站点不可访问 | 保留 Cloudflare Pages / Vercel / Netlify 作为备份发布目标 |
| 前端产物公开 | 源码/接口地址暴露 | 接口做鉴权与限流；不要在前端放大权限逻辑 |
| API 与前端跨域 | 预检失败即全站不可用 | 上线前用 curl 验证 `OPTIONS`；后端加 CORS 回归测试 |
| 混合内容 | HTTPS 页面调 HTTP API 被拦截 | API 必须 HTTPS；本地调试用 `localhost` 例外 |
| Pages 无服务端能力 | 未来要 SSR/边缘逻辑需迁移 | 接口层与托管层解耦，迁移只改托管 |

**备选托管对比**：

| 方案 | 静态托管 | 边缘函数 | 免费额度 | 适合 |
| --- | --- | --- | --- | --- |
| **GitHub Pages** | ✅ | ❌ | 1 GB / 100 GB 流量 | 开源项目、内部演示 ✅ |
| Cloudflare Pages | ✅ | ✅ Workers | 无限请求（有速率限制） | 需要边缘 API / 高流量 |
| Vercel | ✅ | ✅ Edge Functions | 个人免费额度 | Next.js 生态 |
| Netlify | ✅ | ✅ Functions | 100 GB 流量 | 表单/身份等开箱能力 |

> 结论：**先用 Pages 把架构跑通**；若将来接口层需要托管在同一个边缘网络，再整体平移到 Cloudflare Pages，前端代码基本不用改（只改构建配置与域名）。

---

## 8. 配套 Demo

### 8.1 技术栈与结构

```
pages-demo/
├─ index.html                 # SPA 入口（含 ?__spa__ 还原脚本）
├─ 404.html 模板              # scripts/spa-404.template.html → 构建期生成 dist/404.html
├─ vite.config.ts             # base 自动推断 + /api 开发代理 + 404 生成插件
├─ src/
│  ├─ api/client.ts           # 唯一后端边界：base 解析、Bearer、错误归一、请求日志
│  ├─ composables/useAuth.ts  # 会话（reactive 单例，替代 Pinia）
│  ├─ router/index.ts         # 路由守卫：会话恢复 → 未登录跳转
│  ├─ views/                  # 登录 / 概览 / 订单 / 架构说明 / 404
│  └─ components/             # KPI 卡、SVG 趋势图、渠道条、请求日志
└─ server/                    # 零依赖 Mock API（Node 内置模块）
   ├─ index.mjs               # 路由、CORS、限流、签名 token、请求日志
   └─ data.mjs                # 确定性种子数据
```

### 8.2 Mock API 接口

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| GET | `/api/health` | 否 | 健康检查（版本、运行时长） |
| POST | `/api/auth/login` | 否 | 校验账号 → 签发 HS256 token（默认 2h） |
| GET | `/api/auth/me` | 是 | 会话恢复，校验 token 有效性 |
| POST | `/api/auth/logout` | 是 | 无状态登出（审计占位） |
| GET | `/api/metrics/overview?range=7d\|30d` | 是 | KPI、趋势序列、渠道占比 |
| GET | `/api/orders?status=&page=&pageSize=&q=` | 是 | 服务端分页 / 筛选 / 搜索 |

演示账号：`demo@example.com / demo1234`、`admin@example.com / admin1234`。

### 8.3 本地运行

```bash
npm install
npm run server      # 终端 1：Mock API → http://127.0.0.1:8787
npm run dev         # 终端 2：前端 → http://127.0.0.1:5173（/api 走 Vite 代理）
```

**验证「Pages 形态」**（子路径 + 绝对 API 地址 + 真实 CORS 预检 + 404 兜底）：

```bash
VITE_BASE=/pages-demo/ VITE_API_BASE_URL=http://127.0.0.1:8787 npm run build
npm run serve:pages   # → http://127.0.0.1:8080/pages-demo/
```

`serve:pages` 不是普通静态服务器，它刻意复刻了 Pages 的两个关键行为：

1. 站点挂在 `/<repo>/` 子路径下；
2. **未知路径返回 HTTP 404 + 根目录 `404.html`**（这样 SPA 兜底逻辑才是被真实检验过的）。

可直接访问深链接验证：`http://127.0.0.1:8080/pages-demo/orders`。

### 8.4 本次验证结论

| 验证项 | 方法 | 结果 |
| --- | --- | --- |
| 类型检查 | `vue-tsc --noEmit` | 通过，0 error |
| 生产构建 | `vite build` | 通过，主 JS 114 KB（gzip 44 KB） |
| 子路径产物 | `VITE_BASE=/pages-demo/ vite build` | `dist/index.html` 资源为 `/pages-demo/assets/*` ✅ |
| 404 深度注入 | 检查 `dist/404.html` | `SEGMENTS=1`（项目站点）/ `0`（用户站点）✅ |
| 登录鉴权 | 浏览器实测 | 签发 token → `/auth/me` 恢复会话 → 退出清理 ✅ |
| 数据 API | 浏览器实测 | 概览/订单正常，服务端分页筛选生效 ✅ |
| CORS 预检 | `curl -X OPTIONS` | 放行任意 loopback 端口与 `*.github.io`，恶意来源 403 ✅ |
| 部署形态 | `serve:pages` 模拟器 | 子路径可访问、深链接 404→兜底→路由生效、刷新保持登录 ✅ |
| API 注入 | 检查产物 + 页面底部 | 产物含 `127.0.0.1:8787`，登录请求打到 8787 而非同源 ✅ |
| 变量缺失 | `node scripts/check-api-base.mjs` | 空值/相对路径均 exit 1，不再静默降级 ✅ |
| 错误路径 | 错误密码 / 无 token / 来源被拒 | 401/403 + 友好提示，不白屏 ✅ |
| 控制台 | Playwright 采集 | 0 console error / 0 page error ✅ |

### 8.5 Demo 的边界（如实说明）

- 账号密码硬编码在 Mock 服务里，token 用对称密钥签发，**仅用于演示**；
- 「HTTPS 页面调本机 HTTP API」依赖 `localhost` 安全例外，访问者必须自己启动 API；
- 未接入真实数据库、刷新 token、RBAC、审计日志——这些属于接口层职责，不在演示范围内。

---

## 9. 参考

- [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [Configuring a publishing source for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Securing your GitHub Pages site with HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)
- [Creating a custom 404 page for your GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)
- [Managing a custom domain for your GitHub Pages site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)
- [MDN · Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)
- [Vite · Building for Production / base](https://vite.dev/guide/build.html)
- [rafgraph/spa-github-pages](https://github.com/rafgraph/spa-github-pages)（404 兜底思路来源）
