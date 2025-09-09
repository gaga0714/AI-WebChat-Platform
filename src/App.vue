<script setup>
import { onMounted } from 'vue';
import { RouterView } from 'vue-router'

onMounted(() => {
  document.body.style.setProperty("--el-color-primary", "#fe2c55");
  document.body.style.setProperty("--el-color-primary-light-3", "#fe2c55");
  document.body.style.setProperty("--el-menu-active-color", "#1777DE");
  document.body.style.setProperty("--el-color-primary-light-9", "rgba(23,119,222,.2)");
})
</script>

<template>
  <RouterView/>
</template>

<style lang="scss">
@import url(highlight.js/styles/default.css);
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  width: 100vw;
  height: 100vh;
}
</style>
