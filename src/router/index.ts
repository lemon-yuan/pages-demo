import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: '登录' },
    },
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
      meta: { title: '数据概览' },
    },
    {
      path: '/orders',
      name: 'orders',
      component: () => import('@/views/OrdersView.vue'),
      meta: { title: '订单列表' },
    },
    {
      path: '/architecture',
      name: 'architecture',
      component: () => import('@/views/ArchitectureView.vue'),
      meta: { title: '架构说明' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('@/views/NotFoundView.vue'),
      meta: { public: true, title: '页面不存在' },
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const { state, isAuthenticated, bootstrap } = useAuth()

  // 首次进入先尝试用本地 token 恢复会话
  if (!state.ready) await bootstrap()

  if (!to.meta.public && !isAuthenticated.value) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.name === 'login' && isAuthenticated.value) {
    return { name: 'dashboard' }
  }
  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || 'Nebula Console'
  document.title = `${title} · Nebula Console`
})

export default router
