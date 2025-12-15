<script setup lang="ts">
import MainHeader from "@/components/main-header.vue";
import { RouterLink, RouterView } from "vue-router";


</script>

<template>
  <MainHeader />

  <nav class="w-[60%] mx-auto mt-4 flex gap-4 border-b pb-2 text-sm">
    <RouterLink
      to="/"
      class="px-2 py-1 rounded-md"
      active-class="bg-blue-500 text-white"
    >
      Генератор
    </RouterLink>
    <RouterLink
      to="/flibrary"
      class="px-2 py-1 rounded-md"
      active-class="bg-blue-500 text-white"
    >
      Библиотека
    </RouterLink>
    <RouterLink
      to="//export"
      class="px-2 py-1 rounded-md"
      active-class="bg-blue-500 text-white"
    >
      Экспорт
    </RouterLink>
  </nav>

  <RouterView />
</template>
