<script setup lang="ts">
import ColorCard from "@/components/color-card.vue";
import { computed, onMounted, ref, watch } from "vue";

// Тип поддерживаемых цветовых кодов
type ColorCodeType = "HEX" | "RGB";

interface PaletteColor {
  value: string; // исходное значение (HEX без # или rgb(...))
  isPinned: boolean;
}

interface SavedPaletteState {
  colors: PaletteColor[];
  format: ColorCodeType;
  size: number;
  isDarkPreview: boolean;
}

interface SavedPaletteItem {
  id: string;
  name: string;
  tags: string[];
  colors: string[]; // HEX без #
  favorite: boolean;
  createdAt: string;
}

// Уровни доступности WCAG для обычного текста
const getAccessibilityLevel = (ratio: number): "AAA" | "AA" | "none" => {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  return "none";
};

// Парсер HEX-строки (без #) в rgb
const parseHexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null;
  return { r, g, b };
};

const STORAGE_KEY = "color-generator-palette-v1";
const LIBRARY_STORAGE_KEY = "palette_library";
const ACTIVE_PALETTE_KEY = "color-generator-active-from-library";

// Порог контрастности для AAA (обычный текст) по WCAG
const AAA_CONTRAST_RATIO = 7;

// Вспомогательная функция: случайное целое [min, max]
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Преобразование sRGB-канала (0–255) в линейное значение
const srgbChannelToLinear = (channel: number): number => {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};

// Относительная яркость цвета (по WCAG), r/g/b — 0–255
const getRelativeLuminance = (r: number, g: number, b: number): number => {
  const R = srgbChannelToLinear(r);
  const G = srgbChannelToLinear(g);
  const B = srgbChannelToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

// Контраст между двумя цветами по WCAG (l1 и l2 — относительные яркости)
const getContrastRatio = (l1: number, l2: number): number => {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Проверка: достаточно ли тёмный фон относительно белого текста для уровня AAA
const isAaaContrastWithWhite = (r: number, g: number, b: number): boolean => {
  const bgL = getRelativeLuminance(r, g, b);
  const whiteL = 1; // яркость белого
  const ratio = getContrastRatio(whiteL, bgL);
  return ratio >= AAA_CONTRAST_RATIO;
};

// Генерация одного случайного тёмного цвета, проходящего AAA с белым текстом
const getRandomAaaRgbColor = (): { r: number; g: number; b: number } => {
  while (true) {
    const r = getRandomInt(0, 120);
    const g = getRandomInt(0, 120);
    const b = getRandomInt(0, 120);

    if (isAaaContrastWithWhite(r, g, b)) {
      return { r, g, b };
    }
  }
};

// Формирование HEX из r/g/b
const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    r.toString(16).padStart(2, "0") +
    g.toString(16).padStart(2, "0") +
    b.toString(16).padStart(2, "0")
  );
};

// Основная функция генерации палитры AAA относительно белого текста
const generateRandomPaletteValues = (
  type: ColorCodeType,
  length: number
): string[] => {
  const result: string[] = [];

  for (let i = 0; i < length; i++) {
    const { r, g, b } = getRandomAaaRgbColor();

    if (type === "HEX") {
      result.push(rgbToHex(r, g, b));
    } else {
      result.push(`rgb(${r}, ${g}, ${b})`);
    }
  }

  return result;
};

// --- РЕАКТИВНОЕ СОСТОЯНИЕ ---

const format = ref<ColorCodeType>("HEX");
const paletteSize = ref<number>(5); // по ТЗ по умолчанию 5 цветов
const colors = ref<PaletteColor[]>([]);
const pinedColors = ref<PaletteColor[]>([]);
const isDarkPreview = ref<boolean>(true);

const toastMessage = ref<string>("");
const showToast = ref<boolean>(false);
let toastTimeoutId: number | null = null;

// --- ЛОКАЛЬНОЕ СОХРАНЕНИЕ ---

const saveToStorage = () => {
  const payload: SavedPaletteState = {
    colors: colors.value,
    format: format.value,
    size: paletteSize.value,
    isDarkPreview: isDarkPreview.value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

const savePalette = (pinned: PaletteColor[]) => {
  if (!pinned.length) return;

  const raw = localStorage.getItem(LIBRARY_STORAGE_KEY);
  let existing: SavedPaletteItem[] = [];
  if (raw) {
    try {
      existing = JSON.parse(raw) as SavedPaletteItem[];
      if (!Array.isArray(existing)) existing = [];
    } catch {
      existing = [];
    }
  }

  const hexColors = pinned.map((c) => {
    if (c.value.startsWith("rgb")) {
      const match = c.value.match(/rgb\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (!match) return "000000";
      const r = Number(match[1]);
      const g = Number(match[2]);
      const b = Number(match[3]);
      return rgbToHex(r, g, b);
    }
    return c.value.replace("#", "");
  });

  const newItem: SavedPaletteItem = {
    id: `pal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: `Палитра ${new Date().toLocaleString()}`,
    tags: ["generated"],
    colors: hexColors,
    favorite: false,
    createdAt: new Date().toISOString(),
  };

  const payload = [newItem, ...existing];
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(payload));
}

const loadFromStorage = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as SavedPaletteState;
    format.value = parsed.format;
    paletteSize.value = parsed.size;
    colors.value = parsed.colors;
    isDarkPreview.value = parsed.isDarkPreview;
  } catch {
    // некорректные данные — игнорируем
  }
};

// --- ГЕНЕРАЦИЯ ПАЛИТРЫ С УЧЁТОМ ЗАКРЕПЛЁННЫХ ЦВЕТОВ ---

const ensurePaletteSize = () => {
  // если в палитре меньше элементов, чем требуется, добиваем новыми (не закреплёнными)
  if (colors.value.length < paletteSize.value) {
    const missing = paletteSize.value - colors.value.length;
    const newValues = generateRandomPaletteValues(format.value, missing);
    colors.value.push(
      ...newValues
        .filter((v): v is string => v !== undefined)
        .map((v) => ({ value: v, isPinned: false }))
    );
  } else if (colors.value.length > paletteSize.value) {
    // если больше — обрезаем лишние незакреплённые в конце
    colors.value = colors.value.slice(0, paletteSize.value);
  }
};

const generateNewPalette = () => {
  const pinned = colors.value.filter((c) => c.isPinned);
  const pinnedCount = pinned.length;
  const needed = Math.max(0, paletteSize.value - pinnedCount);

  const newValues = generateRandomPaletteValues(format.value, needed);

  const result: PaletteColor[] = [];

  // Сначала добавляем закреплённые, сохраняя их порядок
  for (const c of colors.value) {
    if (c.isPinned) {
      result.push(c);
    }
  }

  // Затем добавляем новые случайные вместо незакреплённых
  let i = 0;
  for (const c of colors.value) {
    if (!c.isPinned && i < newValues.length) {
      const v = newValues[i];
      if (v !== undefined) {
        result.push({ value: v, isPinned: false });
      }
      i++;
    }
  }

  // Если закреплённых было меньше, чем размер, но из-за структуры массива чего-то не хватило — добиваем
  while (result.length < paletteSize.value) {
    const extraValues = generateRandomPaletteValues(format.value, 1);
    const v = extraValues[0];
    if (v !== undefined) {
      result.push({ value: v, isPinned: false });
    }
  }

  colors.value = result.slice(0, paletteSize.value);
};

// --- УПРАВЛЕНИЕ ЦВЕТАМИ ---

const handleCopyColor = async (rawValue: string) => {
  // Преобразуем в строку для отображения (HEX с #, либо как есть RGB)
  const display =
    format.value === "HEX"
      ? `#${rawValue}`
      : rawValue.startsWith("rgb")
      ? rawValue
      : rawValue;

  try {
    await navigator.clipboard.writeText(display);
    toastMessage.value = `${display} скопирован в буфер обмена`;
  } catch {
    toastMessage.value = `Не удалось скопировать ${display}`;
  }

  showToast.value = true;
  if (toastTimeoutId !== null) {
    window.clearTimeout(toastTimeoutId);
  }
  toastTimeoutId = window.setTimeout(() => {
    showToast.value = false;
  }, 2000);
};

const handleTogglePin = (index: number) => {
  const item = colors.value[index];
  if (!item) return;
  item.isPinned = !item.isPinned;
  pinedColors.value = colors.value.filter((c) => c.isPinned);
};

// --- ВЫБОР ФОРМАТА И КОЛИЧЕСТВА ---

const handleChangeSize = () => {
  ensurePaletteSize();
};

const handleChangeFormat = () => {
  // При смене формата просто перегенерируем незакреплённые в новом формате
  const pinned = colors.value.filter((c) => c.isPinned);
  const pinnedCount = pinned.length;
  const needed = Math.max(0, paletteSize.value - pinnedCount);
  const newValues = generateRandomPaletteValues(format.value, needed);

  const result: PaletteColor[] = [];

  for (const c of colors.value) {
    if (c.isPinned) {
      result.push(c);
    }
  }

  let i = 0;
  for (const c of colors.value) {
    if (!c.isPinned && i < newValues.length) {
      const value = newValues[i];
      if (value !== undefined) {
        result.push({ value, isPinned: false });
      }
      i++;
    }
  }

  while (result.length < paletteSize.value) {
    const extraValues = generateRandomPaletteValues(format.value, 1);
    const value = extraValues[0];
    if (value !== undefined) {
      result.push({ value, isPinned: false });
    }
  }

  colors.value = result.slice(0, paletteSize.value);
};

// --- ВЫЧИСЛЯЕМЫЕ СВОЙСТВА ДЛЯ ПРЕВЬЮ ---

const previewBackgroundClass = computed(() =>
  isDarkPreview.value ? "bg-gray-900" : "bg-gray-100"
);

const previewTextClass = computed(() =>
  isDarkPreview.value ? "text-white" : "text-gray-900"
);

// Анализ доступности для текущих цветов (контраст с белым и чёрным)
const accessibilityAnalysis = computed(() => {
  return colors.value.map((c) => {
    // Берём HEX-представление, даже если сейчас формат RGB
    const hex = c.value.startsWith("rgb") ? rgbStringToHex(c.value) : c.value;
    const rgb = parseHexToRgb(hex);
    if (!rgb) {
      return null;
    }
    const bgL = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
    const whiteRatio = getContrastRatio(1, bgL);
    const blackRatio = getContrastRatio(0, bgL);

    return {
      hex: `#${hex}`,
      whiteRatio,
      blackRatio,
      whiteLevel: getAccessibilityLevel(whiteRatio),
      blackLevel: getAccessibilityLevel(blackRatio),
    };
  }).filter(Boolean) as {
    hex: string;
    whiteRatio: number;
    blackRatio: number;
    whiteLevel: "AAA" | "AA" | "none";
    blackLevel: "AAA" | "AA" | "none";
  }[];
});

// Вспомогательная функция: перевод строки вида rgb(r,g,b) в HEX без #
const rgbStringToHex = (rgbStr: string): string => {
  const match = rgbStr.match(/rgb\s*\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (!match) return "000000";
  const r = Number(match[1]);
  const g = Number(match[2]);
  const b = Number(match[3]);
  return rgbToHex(r, g, b);
};

// Подбор акцентного цвета: выбираем наиболее контрастный к среднему цвету палитры
const accentColor = computed(() => {
  if (colors.value.length === 0) return null;

  const midIndex = Math.floor(colors.value.length / 2);
  const mid = colors.value[midIndex];
  if (!mid) return null;

  // Берём серединный цвет палитры как базовый фон (приблизительно)
  const midHex = mid.value.startsWith("rgb") ? rgbStringToHex(mid.value) : mid.value;
  const midRgb = parseHexToRgb(midHex);
  if (!midRgb) return null;

  const midL = getRelativeLuminance(midRgb.r, midRgb.g, midRgb.b);

  // Ищем цвет с максимальным контрастом к mid
  let best: { value: string; ratio: number } | null = null;
  for (const c of colors.value) {
    const h = c.value.startsWith("rgb") ? rgbStringToHex(c.value) : c.value;
    const rgb = parseHexToRgb(h);
    if (!rgb) continue;
    const l = getRelativeLuminance(rgb.r, rgb.g, rgb.b);
    const ratio = getContrastRatio(midL, l);
    if (!best || ratio > best.ratio) {
      best = { value: `#${h}`, ratio };
    }
  }

  return best;
});

// --- ХУКИ ЖИЗНЕННОГО ЦИКЛА ---

onMounted(() => {
  // сначала проверяем, не пришла ли палитра из библиотеки
  const activeRaw = localStorage.getItem(ACTIVE_PALETTE_KEY);
  if (activeRaw) {
    try {
      const parsed = JSON.parse(activeRaw) as { colors?: string[] };
      if (Array.isArray(parsed.colors) && parsed.colors.length) {
        // применяем палитру из библиотеки (HEX без #)
        const fromLibrary = parsed.colors.map((hex) => ({ value: hex, isPinned: false }));

        // если размер генератора меньше количества сохранённых цветов — подгоним размер
        if (paletteSize.value < fromLibrary.length) {
          paletteSize.value = fromLibrary.length;
        }

        // если сохранённых цветов меньше, чем размер палитры, добьём недостающие
        if (fromLibrary.length < paletteSize.value) {
          const missing = paletteSize.value - fromLibrary.length;
          const extra = generateRandomPaletteValues(format.value, missing)
            .filter((v): v is string => v !== undefined)
            .map((v) => ({ value: v, isPinned: false }));
          colors.value = [...fromLibrary, ...extra].slice(0, paletteSize.value);
        } else {
          colors.value = fromLibrary.slice(0, paletteSize.value);
        }
      }
    } catch {
      // ignore
    } finally {
      // очищаем ключ, чтобы палитра не применялась повторно
      localStorage.removeItem(ACTIVE_PALETTE_KEY);
    }
  } else {
    // обычная загрузка из локального состояния генератора
    loadFromStorage();
    if (colors.value.length === 0) {
      colors.value = generateRandomPaletteValues(format.value, paletteSize.value).map(
        (v) => ({ value: v, isPinned: false })
      );
    } else {
      ensurePaletteSize();
    }
  }
});

watch([colors, format, paletteSize, isDarkPreview], () => {
  saveToStorage();
});
</script>

<template>
  <div class="p-3 bg-white shadow-lg rounded-md mt-4 flex flex-col gap-4">
    <h2 class="text-2xl self-center">Генератор палитр</h2>

    <!-- Панель настроек -->
    <div class="flex flex-wrap gap-4 items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="font-medium">Количество цветов:</span>
        <select
          v-model.number="paletteSize"
          @change="handleChangeSize"
          class="border rounded-md px-2 py-1"
        >
          <option :value="3">3</option>
          <option :value="5">5</option>
          <option :value="7">7</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <span class="font-medium">Формат:</span>
        <select
          v-model="format"
          @change="handleChangeFormat"
          class="border rounded-md px-2 py-1"
        >
          <option value="HEX">HEX</option>
          <option value="RGB">RGB</option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <span class="font-medium">Фон превью:</span>
        <button
          class="border rounded-md px-2 py-1"
          @click="isDarkPreview = !isDarkPreview"
        >
          {{ isDarkPreview ? 'Тёмный' : 'Светлый' }}
        </button>
      </div>

      <button
        class="bg-blue-500 hover:bg-blue-400 text-white px-3 py-1 rounded-md"
        @click="generateNewPalette"
      >
        Случайная палитра
      </button>
    </div>

    <!-- Горизонтальная полоса палитры -->
    <div
      class="w-full border border-gray-300 rounded-md flex flex-row"
    >
      <div
        v-for="(item, index) in colors"
        :key="index + '-' + item.value"
        class="flex-1 min-w-0"
      >
        <ColorCard
          :color="item.value"
          :display-format="format"
          :is-pinned="item.isPinned"
          @copy="handleCopyColor"
          @toggle-pin="handleTogglePin(index)"
        />
      </div>
    </div>

    <!-- Простой просмотрщик (mockup интерфейса) -->
    <div class="mt-4 border border-gray-300 rounded-md p-4" :class="previewBackgroundClass">
      <div class="flex flex-col gap-4" :class="previewTextClass">
        <h3 class="text-xl font-semibold">Превью интерфейса</h3>

        <div class="flex gap-4 flex-wrap">
          <button
            class="px-4 py-2 rounded-md font-medium"
            :style="{ backgroundColor: format === 'HEX' ? '#' + colors[0]?.value : colors[0]?.value }"
          >
            Кнопка
          </button>

          <div
            class="px-4 py-3 rounded-md shadow"
            :style="{ backgroundColor: format === 'HEX' ? '#' + colors[1]?.value : colors[1]?.value }"
          >
            <h4 class="font-semibold mb-1">Карточка</h4>
            <p class="text-sm opacity-90">
              Текст на фоне цвета из палитры.
            </p>
          </div>
        </div>

        <div
          class="h-10 rounded-md flex items-center px-3 text-sm font-medium"
          :style="{ backgroundColor: format === 'HEX' ? '#' + colors[2]?.value : colors[2]?.value }"
        >
          Заголовок / панель навигации
        </div>
      </div>
    </div>

    <div
        v-if="pinedColors.length > 0"
        class="w-full border border-gray-300 p-2 rounded-md"
    >
      <div>
        <h2>Ваша палитра</h2>
        <button class="self-start my-1 bg-blue-500 hover:bg-blue-400 px-2 py-1 rounded-md text-white"
                @click="savePalette(pinedColors)">Сохранить в библиотеку</button>
      </div>
      <div class="flex">
        <div
            v-for="(item, index) in colors"
            :key="index + '-' + item.value"
            class="min-w-0"

        >
          <ColorCard
              v-if="item.isPinned"
              :color="item.value"
              :display-format="format"
              :is-pinned="item.isPinned"
              @copy="handleCopyColor"
              @toggle-pin="handleTogglePin(index)"
          />
        </div>
      </div>


    </div>

    <!-- Анализ доступности -->
    <div class="mt-4 border border-gray-200 rounded-md p-4 bg-gray-50">
      <h3 class="text-lg font-semibold mb-2">Анализ доступности (WCAG)</h3>
      <p class="text-sm text-gray-600 mb-3">
        Контраст рассчитывается между цветом палитры как фоном и белым/чёрным текстом.
      </p>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="text-left border-b">
            <th class="py-1 pr-2">Цвет</th>
            <th class="py-1 pr-2">Контраст с белым</th>
            <th class="py-1 pr-2">Уровень</th>
            <th class="py-1 pr-2">Контраст с чёрным</th>
            <th class="py-1 pr-2">Уровень</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in accessibilityAnalysis"
            :key="row.hex"
            class="border-b last:border-b-0"
          >
            <td class="py-1 pr-2">
              <span class="inline-block w-4 h-4 rounded mr-2" :style="{ backgroundColor: row.hex }" />
              {{ row.hex }}
            </td>
            <td class="py-1 pr-2">
              {{ row.whiteRatio.toFixed(2) }}
            </td>
            <td class="py-1 pr-2">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs',
                  row.whiteLevel === 'AAA'
                    ? 'bg-green-500 text-white'
                    : row.whiteLevel === 'AA'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-red-500 text-white',
                ]"
              >
                {{ row.whiteLevel === 'none' ? 'Недостаточно' : row.whiteLevel }}
              </span>
            </td>
            <td class="py-1 pr-2">
              {{ row.blackRatio.toFixed(2) }}
            </td>
            <td class="py-1 pr-2">
              <span
                :class="[
                  'px-2 py-0.5 rounded text-xs',
                  row.blackLevel === 'AAA'
                    ? 'bg-green-500 text-white'
                    : row.blackLevel === 'AA'
                    ? 'bg-yellow-400 text-black'
                    : 'bg-red-500 text-white',
                ]"
              >
                {{ row.blackLevel === 'none' ? 'Недостаточно' : row.blackLevel }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="accentColor" class="mt-4 text-sm">
        <h4 class="font-semibold mb-1">Рекомендуемый акцентный цвет</h4>
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-5 h-5 rounded"
            :style="{ backgroundColor: accentColor.value }"
          />
          <span>{{ accentColor.value }} (контраст с базовым ≈ {{ accentColor.ratio.toFixed(2) }})</span>
        </div>
      </div>
    </div>

    <!-- Тост-уведомление -->
    <transition name="fade">
      <div
        v-if="showToast"
        class="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-md text-sm shadow-lg"
      >
        {{ toastMessage }}
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