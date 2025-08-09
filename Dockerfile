# Stage 1: 构建阶段
# 使用一个带有完整构建工具链的基础镜像
FROM node:18 AS build

# 设置工作目录，后续所有命令都将在这个目录下执行
WORKDIR /app

# 复制 package.json 和 package-lock.json
# 这一步是为了利用 Docker 的缓存机制，如果依赖没有变化，就不需要重新安装
COPY package*.json ./

# 安装项目依赖
RUN npm ci

# ✅ 添加这行：将外部传入的 DEEPSEEK_API_KEY 声明为构建参数
ARG DEEPSEEK_API_KEY
# ✅ 添加这行：将构建参数设置为环境变量
ENV DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}

# 复制项目所有文件到容器中
COPY . .

# 使用构建脚本构建应用
# 注意：如果你的项目是纯前端，构建后会生成一个静态文件目录（如 'dist'）
# 如果是后端应用，这一步可能不需要
RUN npm run build

# Stage 2: 运行阶段
# 使用一个更小、更轻量的基础镜像来运行应用，这能减小最终镜像体积
FROM node:18-alpine

# 将 Stage 1 构建好的产物复制到新的镜像中
# 对于纯前端应用，这里只复制构建好的静态文件目录
COPY --from=build /app/dist /usr/share/nginx/html/

# 对于后端应用，这里复制所有应用代码和依赖
# COPY --from=build /app ./

# 暴露应用监听的端口
# 这个端口需要和你在 Nginx 配置中代理的端口一致
EXPOSE 80

# 启动应用
# 对于前端应用，启动一个简单的静态文件服务器
# 对于后端应用，运行你的启动命令，比如 `npm run start`
CMD ["nginx", "-g", "daemon off;"]