import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/main.css'

const app = createApp(App)
app.use(router)

app.config.errorHandler = (error) => {
  console.error('[app] 未捕获错误：', error)
}

app.mount('#app')
