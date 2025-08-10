FROM node:14 AS builder
WORKDIR /aiwebchat
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
FROM nginx
RUN mkdir /aiwebchat
COPY --from=builder /aiwebchat/dist /aiwebchat
COPY nginx.conf /etc/nginx/nginx.conf