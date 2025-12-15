<script setup lang="ts">
const props = defineProps<{
  color: string; // исходное значение (HEX без # или rgb(...))
  displayFormat: "HEX" | "RGB"; // текущий формат отображения
  isPinned: boolean; // закреплён ли цвет
}>();

const emit = defineEmits<{
  (e: "copy", value: string): void;
  (e: "toggle-pin"): void;
}>();

const handleCopy = () => {
  emit("copy", props.color);
};

const handleTogglePin = (event: MouseEvent) => {
  event.stopPropagation();
  emit("toggle-pin");
};
</script>

<template>
  <div
    class="group cursor-pointer w-full h-60 p-8 flex flex-col items-center justify-center relative"
    :style="{ backgroundColor: displayFormat === 'HEX' ? '#' + color : color }"
    @click="handleCopy"
  >
    <!-- Индикация закрепления -->
    <button
      class="absolute top-1 right-1 text-xs px-1 py-0.5 rounded-md"
      :class="isPinned ? 'bg-yellow-400 text-black' : 'bg-black/40 text-white'"
      @click="handleTogglePin"
    >
      {{ isPinned ? '❌' : '📌' }}
    </button>

    <!-- Текстовое значение цвета -->
    <span
      class="text-white bg-gray-400/60 rounded-md p-1 group-hover:hidden"
    >
      {{ displayFormat === 'HEX' ? '#' + color : color }}
    </span>
    <span
      class="group-hover:block group-hover:bg-gray-400/60 text-white h-fit p-1 rounded-md hidden"
    >
      Copy
    </span>
  </div>
</template>

<style scoped>

</style>