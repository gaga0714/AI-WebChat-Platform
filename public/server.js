// 从window对象导出，部分js文件不能直接读取到window，因此直接引入该文件即可
export const data = {
  baseUrl: window.config.baseUrl,
  deepseekUrl: window.config.deepseekUrl,
};
