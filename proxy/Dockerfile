FROM node:20-alpine
WORKDIR /app

# 先拷依赖清单
COPY package*.json ./

# 有 lock 用 ci；没 lock 就 install（仅生产依赖）
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# 再拷源码
COPY . .

ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
