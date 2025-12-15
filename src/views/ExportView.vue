<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

interface PaletteColor {
  value: string // HEX без #
  isPinned: boolean
}

interface SavedPaletteState {
  colors: PaletteColor[]
  format: 'HEX' | 'RGB'
  size: number
  isDarkPreview: boolean
}

const STORAGE_KEY = 'color-generator-palette-v1'

const colors = ref<string[]>([])

onMounted(() => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as SavedPaletteState
    colors.value = parsed.colors.map((c) => c.value)
  } catch {
    // ignore
  }
})

const cssVariables = computed(() => {
  const lines: string[] = [':root {']
  colors.value.forEach((c, idx) => {
    const hex = c.startsWith('#') ? c : `#${c}`
    lines.push(`  --color-${idx + 1}: ${hex};`)
  })
  lines.push('}')
  return lines.join('\n')
})

const scssVariables = computed(() => {
  return colors.value
    .map((c, idx) => {
      const hex = c.startsWith('#') ? c : `#${c}`
      return `$color-${idx + 1}: ${hex};`
    })
    .join('\n')
})

const tailwindConfig = computed(() => {
  const lines: string[] = ['// Фрагмент tailwind.config.js', 'module.exports = {', '  theme: {', '    extend: {', '      colors: {']

  colors.value.forEach((c, idx) => {
    const hex = c.startsWith('#') ? c : `#${c}`
    lines.push(`        color${idx + 1}: '${hex}',`)
  })

  lines.push('      },', '    },', '  },', '}', '')
  return lines.join('\n')
})

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedMessage.value = 'Код скопирован в буфер обмена'
  } catch {
    copiedMessage.value = 'Не удалось скопировать код'
  }

  showCopied.value = true
  window.setTimeout(() => {
    showCopied.value = false
  }, 2000)
}

const showCopied = ref(false)
const copiedMessage = ref('')
</script>

<template>
  <div class="w-[70%] mx-auto mt-6 flex flex-col gap-4">
    <h2 class="text-2xl font-semibold mb-2">Экспорт и интеграция</h2>

    <p class="text-gray-700 text-sm">
      Ниже представлен код для использования текущей палитры в разных форматах. Палитра берётся
      из последнего состояния генератора.
    </p>

    <div v-if="colors.length" class="flex flex-col gap-4">
      <div class="border rounded-md bg-white p-3 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h3 class="font-semibold text-sm">CSS variables</h3>
          <button
            class="text-xs px-2 py-1 rounded-md border border-gray-300"
            @click="copyText(cssVariables)"
          >
            Копировать
          </button>
        </div>
        <pre class="bg-gray-900 text-green-200 text-xs p-2 rounded-md overflow-x-auto">
{{ cssVariables }}
        </pre>
      </div>

      <div class="border rounded-md bg-white p-3 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h3 class="font-semibold text-sm">SCSS variables</h3>
          <button
            class="text-xs px-2 py-1 rounded-md border border-gray-300"
            @click="copyText(scssVariables)"
          >
            Копировать
          </button>
        </div>
        <pre class="bg-gray-900 text-green-200 text-xs p-2 rounded-md overflow-x-auto">
{{ scssVariables }}
        </pre>
      </div>

      <div class="border rounded-md bg-white p-3 flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <h3 class="font-semibold text-sm">Tailwind config</h3>
          <button
            class="text-xs px-2 py-1 rounded-md border border-gray-300"
            @click="copyText(tailwindConfig)"
          >
            Копировать
          </button>
        </div>
        <pre class="bg-gray-900 text-green-200 text-xs p-2 rounded-md overflow-x-auto">
{{ tailwindConfig }}
        </pre>
      </div>

      <!-- Простое превью с разными UI-компонентами -->
      <div class="border rounded-md bg-white p-3 flex flex-col gap-3">
        <h3 class="font-semibold text-sm">Превью компонентов</h3>
        <div class="flex flex-wrap gap-3">
          <button
            class="px-4 py-2 rounded-md text-white text-sm"
            :style="{ backgroundColor: '#' + colors[0] }"
          >
            Основная кнопка
          </button>
          <button
            class="px-4 py-2 rounded-md text-sm border"
            :style="{ borderColor: '#' + colors[1], color: '#' + colors[1] }"
          >
            Вторичная кнопка
          </button>
        </div>

        <div class="flex flex-wrap gap-3">
          <div
            class="px-4 py-3 rounded-md shadow text-sm"
            :style="{ backgroundColor: '#' + colors[2], color: 'white' }"
          >
            Карточка с текстом на фоне цвета 3
          </div>
          <div
            class="px-4 py-3 rounded-md text-sm border"
            :style="{ borderColor: '#' + colors[3] }"
          >
            <div class="font-semibold mb-1">Заголовок</div>
            <div class="text-xs">Текст на нейтральном фоне, акцент цветом 4 в бордере.</div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-sm text-gray-500 border rounded-md p-3 bg-white">
      Палитра ещё не сохранена в генераторе. Открой генератор, сгенерируй палитру и вернись сюда.
    </div>

    <transition name="fade">
      <div
        v-if="showCopied"
        class="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-md text-sm shadow-lg"
      >
        {{ copiedMessage }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
