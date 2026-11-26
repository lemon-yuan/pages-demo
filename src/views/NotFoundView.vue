<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="nf">
    <div class="nf__card card fade-up">
      <p class="nf__code mono">404</p>
      <h1>这条路径在 Pages 上不存在</h1>
      <p class="nf__path mono">{{ route.fullPath }}</p>
      <p class="nf__text">
        GitHub Pages 对未知路径会返回仓库根目录的 <code>404.html</code>，本项目在其中做了重定向，
        把路径还原给 SPA 路由；如果仍然落到这里，说明该路由确实没有定义。
      </p>
      <RouterLink to="/" class="btn btn--primary">返回控制台</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.nf {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.nf__card {
  max-width: 520px;
  padding: 36px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}

.nf__code {
  font-size: 52px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.04em;
  background: var(--gradient-text);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.nf__card h1 {
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.nf__path {
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.nf__text {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.75;
}

.nf__text code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  color: #c7d3f0;
}
</style>
