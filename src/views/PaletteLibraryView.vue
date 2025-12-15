<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

interface SavedPaletteItem {
  id: string
  name: string
  tags: string[]
  colors: string[] // HEX без #
  favorite: boolean
  createdAt: string
}

const STORAGE_KEY = 'palette_library'
const ACTIVE_PALETTE_KEY = 'color-generator-active-from-library'

const router = useRouter()

const items = ref<SavedPaletteItem[]>([])
const search = ref('')
const tagFilter = ref('')
const showFavoritesOnly = ref(false)

const loadFromStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as SavedPaletteItem[]
    items.value = parsed
  } catch {
    // ignore
  }
}

const saveToStorage = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
}

onMounted(() => {
  loadFromStorage()
})

watch(items, () => {
  saveToStorage()
}, { deep: true })

const allTags = computed(() => {
  const set = new Set<string>()
  for (const it of items.value) {
    for (const t of it.tags) {
      set.add(t)
    }
  }
  return Array.from(set).sort()
})

const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  const tag = tagFilter.value.trim().toLowerCase()

  return items.value.filter((it) => {
    if (showFavoritesOnly.value && !it.favorite) return false

    if (q) {
      const inName = it.name.toLowerCase().includes(q)
      const inTags = it.tags.some((t) => t.toLowerCase().includes(q))
      if (!inName && !inTags) return false
    }

    if (tag) {
      if (!it.tags.some((t) => t.toLowerCase() === tag)) return false
    }

    return true
  })
})

const toggleFavorite = (id: string) => {
  const found = items.value.find((i) => i.id === id)
  if (!found) return
  found.favorite = !found.favorite
}

const deleteItem = (id: string) => {
  items.value = items.value.filter((i) => i.id !== id)
}

const startEdit = (item: SavedPaletteItem) => {
  editingId.value = item.id
  editName.value = item.name
  editTags.value = item.tags.join(', ')
}

const editingId = ref<string | null>(null)
const editName = ref('')
const editTags = ref('')

const saveEdit = () => {
  if (!editingId.value) return
  const found = items.value.find((i) => i.id === editingId.value)
  if (!found) return

  found.name = editName.value.trim() || found.name
  found.tags = editTags.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  editingId.value = null
  editName.value = ''
  editTags.value = ''
}

const cancelEdit = () => {
  editingId.value = null
  editName.value = ''
  editTags.value = ''
}

const applyPalette = (item: SavedPaletteItem) => {
  // сохраняем выбранную палитру для генератора
  localStorage.setItem(
    ACTIVE_PALETTE_KEY,
    JSON.stringify({
      colors: item.colors, // массив HEX без #
    }),
  )
  // переходим на главную страницу генератора
  router.push({ name: 'generator' })
}
</script>

<template>
  <div class="w-[70%] mx-auto mt-6 flex flex-col gap-4">
    <h2 class="text-2xl font-semibold mb-2">Библиотека палитр</h2>

    <p class="text-gray-700 text-sm">
      Здесь хранятся сохранённые палитры. Их можно фильтровать по названию и тегам, отмечать
      как избранные и редактировать.
    </p>

    <!-- Панель фильтров -->
    <div class="flex flex-wrap gap-3 items-center border p-3 rounded-md bg-white">
      <input
        v-model="search"
        type="text"
        placeholder="Поиск по названию или тегам"
        class="border rounded-md px-2 py-1 flex-1 min-w-[180px]"
      />

      <select
        v-model="tagFilter"
        class="border rounded-md px-2 py-1 min-w-[160px]"
      >
        <option value="">Все теги</option>
        <option
          v-for="tag in allTags"
          :key="tag"
          :value="tag.toLowerCase()"
        >
          {{ tag }}
        </option>
      </select>

      <label class="flex items-center gap-1 text-sm cursor-pointer">
        <input type="checkbox" v-model="showFavoritesOnly" />
        Только избранные
      </label>
    </div>

    <!-- Список палитр -->
    <div v-if="filteredItems.length" class="flex flex-col gap-3">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="border rounded-md bg-white p-3 flex flex-col gap-2"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <h3 class="font-semibold">{{ item.name }}</h3>
              <button
                class="text-xs px-2 py-0.5 rounded-md"
                :class="item.favorite ? 'bg-yellow-400 text-black' : 'bg-gray-200 text-gray-800'"
                @click="toggleFavorite(item.id)"
              >
                {{ item.favorite ? 'Избранная' : 'В избранное' }}
              </button>
            </div>
            <span class="text-xs text-gray-500">
              {{ new Date(item.createdAt).toLocaleString() }}
            </span>
          </div>

          <div class="flex gap-2 text-xs">
            <button
              class="px-2 py-1 rounded-md border border-gray-300"
              @click="startEdit(item)"
            >
              Редактировать
            </button>
            <button
              class="px-2 py-1 rounded-md border border-green-400 text-green-700"
              @click="applyPalette(item)"
            >
              Выбрать
            </button>
            <button
              class="px-2 py-1 rounded-md border border-red-300 text-red-700"
              @click="deleteItem(item.id)"
            >
              Удалить
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-1 mt-2">
          <span
            v-for="tag in item.tags"
            :key="tag"
            class="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700"
          >
            {{ tag }}
          </span>
          <span v-if="!item.tags.length" class="text-xs text-gray-400">
            Теги не указаны
          </span>
        </div>

        <div class="flex flex-row w-full overflow-hidden rounded-md mt-1">
          <div
            v-for="c in item.colors"
            :key="c"
            class="flex-1 h-8"
            :style="{ backgroundColor: '#' + c }"
          />
        </div>
      </div>
    </div>
    <div v-else class="text-sm text-gray-500 border rounded-md p-3 bg-white">
      Пока нет сохранённых палитр. Сохрани палитру из генератора, чтобы увидеть её здесь.
    </div>

    <!-- Редактирование палитры -->
    <div v-if="editingId" class="mt-4 border rounded-md bg-white p-3 flex flex-col gap-2">
      <h3 class="font-semibold">Редактирование палитры</h3>
      <label class="text-sm flex flex-col gap-1">
        Название
        <input v-model="editName" type="text" class="border rounded-md px-2 py-1" />
      </label>
      <label class="text-sm flex flex-col gap-1">
        Теги (через запятую)
        <input v-model="editTags" type="text" class="border rounded-md px-2 py-1" />
      </label>
      <div class="flex gap-2 mt-2 text-sm">
        <button
          class="px-3 py-1 rounded-md bg-blue-500 text-white"
          @click="saveEdit"
        >
          Сохранить
        </button>
        <button
          class="px-3 py-1 rounded-md border border-gray-300"
          @click="cancelEdit"
        >
          Отмена
        </button>
      </div>
    </div>
  </div>
</template>
