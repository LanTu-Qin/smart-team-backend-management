<script setup></script>

<template>
  <!-- 整个应用最顶层只有一个出口：/login 或后台 Layout 在这里渲染 -->
  <RouterView />
</template>

<style>
/* 全局基础样式，非 scoped */
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; }
</style>