// 导出 routes
const routes = [
    {
        path:'/',
        name:"deepseek",
        component:()=> import("../views/deepseek/index.vue")
    },
]
export default routes