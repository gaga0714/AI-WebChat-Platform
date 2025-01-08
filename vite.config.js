import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import path from "path";
// import { visualizer } from 'vite-bundle-visualizer';
import viteCompression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    vue(),
    viteCompression({
      verbose: true,
      disable: false,
      threshold: 10240,
      algorithm: 'gzip',
      ext: '.gz',
    }),
    // visualizer({
    //   open: false,
    //   gzipSize: true,
    //   brotliSize: true,
    // }),
  ],
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"), // 设置 @ 别名指向 src 目录
    },
  },
  build: {
    target: 'es2015',
    minify: 'terser',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]',
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router'],
          'element-plus-vendor': ['element-plus'],
        },
      },
    },
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    chunkSizeWarningLimit: 2000,
  },
  // server: {
  //   proxy: {
  //     "/user": {
  //       target: "https://api.deepseek.com/user",
  //       changeOrigin: true,
  //       secure: false,
  //       rewrite: (path) => path.replace(/^\/user/, "/"),
  //     },
  //   },
  // },
});
