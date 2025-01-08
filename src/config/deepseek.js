import { apiKey } from "./key";
// DeepSeek配置文件
// API配置
export const API_CONFIG = {
    baseURL: "https://api.deepseek.com",
    apiKey: apiKey, // 换成自己的apiKey
    dangerouslyAllowBrowser: true
};

// 模型配置
export const MODEL_CONFIG = {
    stream: true,
    max_tokens: 8192, // 限制一次请求中模型生成 completion 的最大 token 数
    temperature: 0.6, // 严谨与想象 越低越严谨 官方建议0.6
}

// 本地存储键名配置
export const STORAGE_KEYS = {
    sessionList: "list",
    activeIndex: "index"
};