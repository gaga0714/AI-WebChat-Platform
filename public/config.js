const QUERY_BASE_URL = "http://127.0.0.1:3000"; // 接口请求基础地址
const DEEP_SEEK = "https://api.deepseek.com"; // deepseek-gpt基础地址

/**
 * 注册到window对象上
 */
window.config = {
  baseUrl: QUERY_BASE_URL,
  deepseekUrl: DEEP_SEEK,
};
