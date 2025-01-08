import axios from "axios";

const service = axios.create({
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

service.interceptors.request.use(
  (config) => {
    // DeepSeek-GPT的sk码
    if (config.params.deepseek == "Y" || config.data.deepseek == "Y") {
      const token = config.params.gptToken || config.data.gptToken;
      config.headers["Authorization"] = "Bearer " + token;
    }
    // 普通的接口请求
    if (sessionStorage.getItem("token")) {
      const token = sessionStorage.getItem("token");
      config.headers["Authorization"] = "Bearer " + token;
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      if (error.request.status == 0) {
        error.message = "服务器发生错误，请检查服务器。";
      }
    }
    return Promise.reject(error);
  }
);

export default service;
