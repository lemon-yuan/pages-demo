import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'

/**
 * 构建期生成 dist/404.html。
 *
 * GitHub Pages 没有 rewrite 规则：直接访问 /<repo>/orders 会命中 404.html。
 * 这个插件按 base 的层级把模板里的 __SEGMENTS__ 填好，让 404.html 能把
 * 原始路径编码后重定向回 index.html，从而实现 SPA 深链接可用。
 */
function spaFallbackPlugin(base: string): Plugin {
  const segments = base.split('/').filter(Boolean).length
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const template = readFileSync(resolve(__dirname, 'scripts/spa-404.template.html'), 'utf8')
      const html = template.replace('__SEGMENTS__', String(segments))
      writeFileSync(resolve(__dirname, 'dist/404.html'), html, 'utf8')
      this.warn(`已生成 dist/404.html（base=${base}，路径深度 ${segments}）`)
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * GitHub Pages 的项目站点托管在 https://<user>.github.io/<repo>/ 子路径下，
   * base 必须显式设为 "/<repo>/"，否则打包产物的资源绝对路径会落到域名根目录 → 404 白屏。
   *
   * 优先级：VITE_BASE > GITHUB_REPOSITORY（CI 自动注入）> "/"
   */
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1]
  const base = env.VITE_BASE || (process.env.GITHUB_ACTIONS && repo ? `/${repo}/` : '/')

  return {
    base,
    plugins: [vue(), spaFallbackPlugin(base)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      host: '127.0.0.1',
      strictPort: true,
      // 本地开发把 /api 代理到 Mock 后端，避免任何 CORS 干扰
      proxy: {
        '/api': {
          target: env.API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      host: '127.0.0.1',
      strictPort: true,
    },
    build: {
      target: 'es2022',
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 800,
    },
  }
})
