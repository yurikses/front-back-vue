import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import ColorGeneratorView from '@/views/ColorGeneratorView.vue'
import PaletteLibraryView from '@/views/PaletteLibraryView.vue'
import ExportView from '@/views/ExportView.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'generator',
    component: ColorGeneratorView,
  },
  {
    path: '/library',
    name: 'library',
    component: PaletteLibraryView,
  },
  {
    path: '/export',
    name: 'export',
    component: ExportView,
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

