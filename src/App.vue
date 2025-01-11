<script setup>
import { onMounted } from 'vue';

onMounted(() => {
  document.body.style.setProperty("--el-color-primary", "#fe2c55");
  document.body.style.setProperty("--el-color-primary-light-3", "#fe2c55");
  document.body.style.setProperty("--el-menu-active-color", "#1777DE");
  document.body.style.setProperty("--el-color-primary-light-9", "rgba(23,119,222,.2)");
})
</script>

<template>
  <router-view></router-view>
</template>

<style lang="scss">
@import url(highlight.js/styles/default.css);

*::-webkit-scrollbar {
  width: 7px;
  display: none;
}

*::-webkit-scrollbar-thumb {
  border-radius: 8px;
  background-color: #03044a;
  display: none;
}

*::-webkit-scrollbar-track {
  display: none;
  border-radius: 8px;
  background-color: #03044a87;
  border: 1px solid #03044a87;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  width: 100vw;
  height: 100vh;
}
</style>
