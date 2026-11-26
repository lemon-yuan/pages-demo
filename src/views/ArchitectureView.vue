<script setup lang="ts">
import { computed } from 'vue'
import { apiBase, apiBaseIsAbsolute } from '@/api/client'

const runtime = computed(() => ({
  host: window.location.host,
  protocol: window.location.protocol,
  secure: window.location.protocol === 'https:',
}))

const buildInfo = {
  base: import.meta.env.BASE_URL,
  mode: import.meta.env.MODE,
  prod: import.meta.env.PROD,
  apiBase: apiBase || '(同源代理 /api)',
  builtAt: new Date().toISOString().slice(0, 10),
}

const pipeline = [
  { step: 'push', title: 'push / PR 合并到 main', desc: '触发 .github/workflows/deploy.yml' },
  { step: 'build', title: 'npm ci && npm run build', desc: 'Vite 产出 dist/（HTML + hash 命名的 JS/CSS）' },
  { step: 'artifact', title: 'upload-pages-artifact', desc: '把 dist/ 打包成 Pages 部署制品' },
  { step: 'deploy', title: 'deploy-pages', desc: '发布到 https://<user>.github.io/<repo>/' },
]

const layers = computed(() => [
  {
    name: 'GitHub Pages',
    role: '静态资源托管',
    detail: '只回源静态文件；HTTPS 由 GitHub 提供；不支持任何服务端逻辑',
    tone: 'brand',
  },
  {
    name: 'Vite + Vue3 + TS',
    role: '前端 SPA',
    detail: `base=${import.meta.env.BASE_URL}，构建产物部署在 Pages 子路径下`,
    tone: 'violet',
  },
  {
    name: 'Mock API（Node）',
    role: '鉴权 + 数据',
    detail: apiBaseIsAbsolute ? `独立进程，暴露 ${apiBase}` : '本地 127.0.0.1:8787，开发经 Vite 代理',
    tone: 'accent',
  },
])

const checkpoints = [
  {
    ok: true,
    title: '子路径 base 配置',
    text: 'vite.config.ts 通过 GITHUB_REPOSITORY 自动推断 /<repo>/，避免资源 404 白屏。',
  },
  {
    ok: true,
    title: 'SPA 深链接回退',
    text: 'public/404.html 把路径编码进 ?/… 再跳回 index.html，刷新 /orders 不会 404。',
  },
  {
    ok: true,
    title: 'CORS 白名单',
    text: 'Mock API 放行任意 localhost / 127.0.0.1 端口与 https://*.github.io，其余来源一律 403。',
  },
  {
    ok: !!apiBaseIsAbsolute,
    title: 'API 地址构建期注入',
    text: apiBaseIsAbsolute
      ? `当前构建使用 ${apiBase}`
      : '当前走 Vite 代理；部署到 Pages 时需通过 VITE_API_BASE_URL 注入真实地址。',
  },
]
</script>

<template>
  <div class="arch">
    <header class="arch__head fade-up">
      <div>
        <p class="arch__eyebrow"><span class="pill pill--accent">ARCHITECTURE</span> 静态托管 + 独立后端</p>
        <h1 class="arch__title">这套演示是怎么跑起来的</h1>
        <p class="arch__sub">
          GitHub Pages 负责"把前端送上门"，Mock API 负责"给数据"。
          两者通过 HTTPS + CORS 解耦，可独立部署、独立扩容。
        </p>
      </div>
    </header>

    <!-- 拓扑图 -->
    <section class="topo card fade-up" style="animation-delay: 60ms">
      <header class="topo__head">
        <h2 class="section-title">部署拓扑</h2>
        <span class="pill">Runtime</span>
      </header>

      <div class="topo__diagram">
        <div class="node node--browser">
          <span class="node__icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
              <rect x="2.5" y="4" width="19" height="14" rx="2.6" stroke="currentColor" stroke-width="1.7" />
              <path d="M2.5 9h19" stroke="currentColor" stroke-width="1.7" />
              <circle cx="5.6" cy="6.6" r="1" fill="currentColor" />
              <circle cx="8.6" cy="6.6" r="1" fill="currentColor" />
            </svg>
          </span>
          <strong>浏览器</strong>
          <small>用户访问 Pages 域名</small>
        </div>

        <div class="edge edge--1">
          <span class="edge__label mono">GET /index.html + /assets/*.js</span>
        </div>

        <div class="node node--pages">
          <span class="node__icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
              <path d="M12 3.5l8 8.5H4l8-8.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
              <path d="M6 16.5h12" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <path d="M8 20h8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </span>
          <strong>GitHub Pages</strong>
          <small>CDN · HTTPS · 静态文件</small>
        </div>

        <div class="edge edge--2">
          <span class="edge__label mono">Authorization: Bearer &lt;token&gt;</span>
        </div>

        <div class="node node--api">
          <span class="node__icon">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
              <ellipse cx="12" cy="6" rx="7.5" ry="3" stroke="currentColor" stroke-width="1.7" />
              <path d="M4.5 6v12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3V6" stroke="currentColor" stroke-width="1.7" />
              <path d="M4.5 12c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3" stroke="currentColor" stroke-width="1.7" />
            </svg>
          </span>
          <strong>Mock API</strong>
          <small>{{ apiBaseIsAbsolute ? apiBase : 'localhost:8787' }}</small>
        </div>
      </div>

      <p class="topo__note">
        注意：跨域请求由浏览器直接发往 API，<strong>不经过 Pages</strong>。
        Pages 只提供 HTML/JS/CSS，因此它永远不知道你的业务数据。
      </p>
    </section>

    <!-- 分层说明 -->
    <section class="arch__grid">
      <article v-for="(layer, i) in layers" :key="layer.name" class="layer card fade-up" :style="{ animationDelay: `${100 + i * 60}ms` }">
        <span class="layer__badge" :class="`layer__badge--${layer.tone}`">{{ layer.role }}</span>
        <h3>{{ layer.name }}</h3>
        <p>{{ layer.detail }}</p>
      </article>
    </section>

    <!-- 流水线 -->
    <section class="pipeline card fade-up" style="animation-delay: 220ms">
      <header class="pipeline__head">
        <h2 class="section-title">CI/CD 流水线</h2>
        <span class="pill pill--brand">GitHub Actions</span>
      </header>
      <ol class="pipeline__list">
        <li v-for="(item, i) in pipeline" :key="item.step" class="pipeline__item">
          <span class="pipeline__idx mono">{{ String(i + 1).padStart(2, '0') }}</span>
          <div class="pipeline__body">
            <strong>{{ item.title }}</strong>
            <p>{{ item.desc }}</p>
          </div>
          <span v-if="i < pipeline.length - 1" class="pipeline__arrow" aria-hidden="true">→</span>
        </li>
      </ol>
    </section>

    <!-- 检查清单 + 构建信息 -->
    <section class="arch__grid arch__grid--two">
      <article class="checks card fade-up" style="animation-delay: 260ms">
        <h2 class="section-title">接入检查清单</h2>
        <ul class="checks__list">
          <li v-for="item in checkpoints" :key="item.title" :class="{ 'checks__item--warn': !item.ok }">
            <span class="checks__icon" :class="{ 'checks__icon--warn': !item.ok }">
              <svg v-if="item.ok" viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
                <path d="M2 6.4l2.6 2.6L10 3.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <svg v-else viewBox="0 0 12 12" width="10" height="10" fill="none" aria-hidden="true">
                <path d="M6 2.4v4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
                <circle cx="6" cy="9.6" r="0.95" fill="currentColor" />
              </svg>
            </span>
            <div>
              <strong>{{ item.title }}</strong>
              <p>{{ item.text }}</p>
            </div>
          </li>
        </ul>
      </article>

      <article class="build card fade-up" style="animation-delay: 300ms">
        <h2 class="section-title">当前构建信息</h2>
        <dl class="build__list">
          <div><dt>BASE_URL</dt><dd class="mono">{{ buildInfo.base }}</dd></div>
          <div><dt>构建模式</dt><dd class="mono">{{ buildInfo.mode }}</dd></div>
          <div><dt>API Base</dt><dd class="mono">{{ buildInfo.apiBase }}</dd></div>
          <div><dt>运行位置</dt><dd class="mono">{{ runtime.host }}</dd></div>
          <div><dt>协议</dt><dd class="mono">{{ runtime.protocol }}（{{ runtime.secure ? '安全上下文' : '本地调试' }}）</dd></div>
        </dl>
        <p class="build__note">
          这些值都在构建期由 Vite 注入，因此同一个仓库可以产出多个环境的前端镜像。
        </p>
      </article>
    </section>
  </div>
</template>

<style scoped>
.arch {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1400px;
  margin: 0 auto;
}

.arch__eyebrow {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11.5px;
  color: var(--text-muted);
  margin-bottom: 9px;
}

.arch__title {
  font-size: clamp(22px, 2.6vw, 30px);
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 8px;
}

.arch__sub {
  font-size: 13px;
  color: var(--text-muted);
  max-width: 660px;
  line-height: 1.7;
}

.topo {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.topo__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topo__diagram {
  display: grid;
  grid-template-columns: 1fr 1.15fr 1fr 1.15fr 1fr;
  align-items: center;
  gap: 6px;
  padding: 12px 0 6px;
}

.node {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 18px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.03);
  text-align: center;
}

.node__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  margin-bottom: 2px;
}

.node strong {
  font-size: 13px;
}

.node small {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  word-break: break-all;
}

.node--browser .node__icon {
  color: #c3d3ff;
  background: rgba(124, 157, 255, 0.14);
  border: 1px solid rgba(124, 157, 255, 0.24);
}

.node--pages {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.055);
}

.node--pages .node__icon {
  color: #e8eeff;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.22);
}

.node--api {
  border-color: rgba(53, 224, 192, 0.28);
  background: rgba(53, 224, 192, 0.06);
}

.node--api .node__icon {
  color: #9af5e2;
  background: rgba(53, 224, 192, 0.14);
  border: 1px solid rgba(53, 224, 192, 0.26);
}

.edge {
  position: relative;
  height: 1px;
  background: repeating-linear-gradient(90deg, rgba(148, 163, 184, 0.4) 0 5px, transparent 5px 10px);
}

.edge::after {
  content: '';
  position: absolute;
  right: -1px;
  top: -3.5px;
  border-left: 7px solid rgba(148, 163, 184, 0.55);
  border-top: 4px solid transparent;
  border-bottom: 4px solid transparent;
}

.edge__label {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  font-size: 9.5px;
  color: var(--text-muted);
  background: var(--bg-base);
  padding: 1px 6px;
  white-space: nowrap;
}

.topo__note {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.7;
  padding-top: 12px;
  border-top: 1px dashed var(--border-subtle);
}

.topo__note strong {
  color: var(--text-secondary);
}

.arch__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}

.arch__grid--two {
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
}

.layer {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.layer__badge {
  align-self: flex-start;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 3px 8px;
  border-radius: 999px;
}

.layer__badge--brand {
  color: #c3d3ff;
  background: rgba(124, 157, 255, 0.14);
  border: 1px solid rgba(124, 157, 255, 0.26);
}

.layer__badge--violet {
  color: #d5c8ff;
  background: rgba(167, 139, 250, 0.14);
  border: 1px solid rgba(167, 139, 250, 0.26);
}

.layer__badge--accent {
  color: #9af5e2;
  background: rgba(53, 224, 192, 0.12);
  border: 1px solid rgba(53, 224, 192, 0.24);
}

.layer h3 {
  font-size: 14px;
  font-weight: 650;
}

.layer p {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.65;
  word-break: break-word;
}

.pipeline {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pipeline__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pipeline__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.pipeline__item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 14px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-subtle);
  background: rgba(255, 255, 255, 0.025);
}

.pipeline__idx {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--brand);
  letter-spacing: 0.08em;
}

.pipeline__body strong {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  margin-bottom: 3px;
}

.pipeline__body p {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.6;
}

.pipeline__arrow {
  position: absolute;
  right: -10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
  font-size: 12px;
  z-index: 2;
}

.checks {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.checks__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.checks__list li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.checks__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: #8ef3dc;
  background: rgba(53, 224, 192, 0.14);
}

.checks__icon--warn {
  color: var(--amber);
  background: rgba(255, 180, 84, 0.14);
}

.checks__list strong {
  display: block;
  font-size: 12.5px;
  font-weight: 650;
  margin-bottom: 2px;
}

.checks__list p {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.6;
}

.build {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.build__list {
  margin: 0;
  display: flex;
  flex-direction: column;
}

.build__list > div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed var(--border-subtle);
}

.build__list dt {
  font-size: 11.5px;
  color: var(--text-muted);
  flex: none;
}

.build__list dd {
  margin: 0;
  font-size: 11.5px;
  text-align: right;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.build__note {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.6;
}

@media (max-width: 1180px) {
  .arch__grid,
  .arch__grid--two {
    grid-template-columns: minmax(0, 1fr);
  }
  .pipeline__list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .pipeline__arrow {
    display: none;
  }
  .topo__diagram {
    grid-template-columns: 1fr;
  }
  .edge {
    height: 22px;
    width: 1px;
    margin: 0 auto;
    background: repeating-linear-gradient(180deg, rgba(148, 163, 184, 0.4) 0 5px, transparent 5px 10px);
  }
  .edge::after {
    right: -3.5px;
    top: auto;
    bottom: -1px;
    border-left: 4px solid transparent;
    border-right: 4px solid transparent;
    border-top: 7px solid rgba(148, 163, 184, 0.55);
    border-bottom: none;
  }
  .edge__label {
    left: 50%;
    bottom: 50%;
    transform: translate(-50%, 50%);
  }
}
</style>
