## 鸭棚子对话厅

基于 Vue 3 部署 `DeepSeek api`集成的`Web AI`对话框，支持代码高亮显示，针对移动端进行了简洁适配。

## 服务器上线
http://gaga0714.site:10004/

## 使用方法

1.  **配置 API Key：**

    将 `src/config` 目录下配置文件中的`apiKey` 替换为自己申请的`key`。

    **⚠️warning：** 不要将你的`apikey`提交到公共仓库!!!

    `ApiKey` 获取网址：https://platform.deepseek.com/usage

2.  **运行项目：**
    - 安装依赖：

        ```bash
        pnpm install 
        ```

    - 启动项目：

        ```bash
        pnpm run dev
        ```

    - 构建项目：

        ```bash
        pnpm run build
        ```

    - 部署构建后的文件到服务器

3.  **vite-bundle-visualizer**
    官网链接：https://www.npmjs.com/package/vite-bundle-visualizer
    - 可视化工具计算各模块大小
    ```js
        npx vite-bundle-visualizer
    ```

## 效果图
![alt text](/assets/show_2.png)
![alt text](/assets/show_1.jpg)

## 自动部署服务器
使用GitHub Actions （持续集成和持续交付（CI/CD）平台）

## 优化体积
优化前：
![alt text](/assets/vis_pre.png)
![alt text](/assets/chunk_pre.png)

优化后：
![alt text](/assets/vid_bac.png)
![alt text](/assets/chunk_bac.png)

## 自定义vite插件
`npm run dev`:

![alt text](/assets/dev_vite_plugin.png)

`npm run build`:

![alt text](/assets/build_vite_plugin.png)