## 鸭棚子对话厅

基于 Vue 3 部署 `DeepSeek api`集成的`Web AI`对话框，支持代码高亮显示，针对移动端进行了简洁适配。

## 服务器上线
http://gaga0714.site:10003/

## 使用方法

1.  **配置 API Key：**

    将 `src/config` 目录下配置文件中的`apiKey` 替换为自己申请的`key`。

    **⚠️warning：** 不要将你的`apikey`提交到公共仓库!!!

    `ApiKey` 获取网址：https://platform.deepseek.com/usage

2.  **运行项目：**
    - 安装依赖：

        ```bash
        npm install 
        ```

    - 启动项目：

        ```bash
        npm run dev
        ```

    - 构建项目：

        ```bash
        npm run build
        ```

    - 部署构建后的文件到服务器
