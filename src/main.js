import { createApp } from 'vue'
import './style.scss'
import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'

import "../public/config.js";

const app = createApp(App)
app.use(router).use(ElementPlus).mount('#app')

/* 处理错误 */
app.config.errorHandler = (err) => {
    console.error('全局错误：', err);
}