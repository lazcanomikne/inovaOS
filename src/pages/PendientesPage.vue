<template>
  <f7-page name="pendientes" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Pendientes</f7-nav-title>
      <f7-nav-title-large>Pendientes</f7-nav-title-large>
    </f7-navbar>

    <div class="filtros-scroll">
      <div
        v-for="f in filtros"
        :key="f.key"
        class="glass filtro-chip"
        :class="{ active: filtro === f.key }"
        @click="filtro = f.key"
      >
        {{ f.label }}
        <span v-if="conteo(f.key)" class="chip-count">{{ conteo(f.key) }}</span>
      </div>
    </div>

    <div v-if="error" class="block">
      <div class="glass error-card">
        <i class="f7-icons">exclamationmark_triangle_fill</i>
        <div><strong>No se pudo conectar</strong><div class="error-sub">{{ error }}</div></div>
      </div>
      <f7-button class="glass-btn margin-top" @click="cargar">Reintentar</f7-button>
    </div>

    <div v-else-if="loading" class="block text-align-center"><f7-preloader /></div>

    <div v-else class="list glass-list media-list no-hairlines">
      <ul>
        <li v-for="p in filtrados" :key="p.id" @click="abrir(p.id)">
          <a class="item-link item-content">
            <div class="item-media">
              <span class="st-dot" :class="'st-' + estatusColor(p)"></span>
            </div>
            <div class="item-inner">
              <div class="item-title-row">
                <div class="item-title">{{ p.titulo }}</div>
                <div class="item-after badge-glass">{{ p.prioridad }}</div>
              </div>
              <div class="item-subtitle">
                {{ p.responsable_nombre || 'Sin asignar' }} · {{ etiquetaEstatus(p.estatus) }}
              </div>
              <div class="item-text">Vence {{ formatFecha(p.fecha_compromiso) }}</div>
            </div>
          </a>
        </li>
        <li v-if="!filtrados.length">
          <div class="item-content">
            <div class="item-inner text-color-gray">Sin pendientes en este filtro.</div>
          </div>
        </li>
      </ul>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '@/js/api.js';
import { store } from '@/js/store.js';
import { estatusColor, etiquetaEstatus, formatFecha, CERRADOS } from '@/js/pendientes.js';

const props = defineProps({ f7router: Object });
const loading = ref(true);
const error = ref('');
const items = ref([]);
const filtro = ref('todos');

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'hoy', label: 'Vencen hoy' },
  { key: 'activo', label: 'En curso' },
  { key: 'concluido', label: 'Concluidos' },
];

function coincide(p, key) {
  if (key === 'todos') return true;
  if (key === 'concluido') return CERRADOS.includes(p.estatus);
  if (key === 'activo') return !CERRADOS.includes(p.estatus);
  return estatusColor(p) === key;
}

const filtrados = computed(() => items.value.filter((p) => coincide(p, filtro.value)));
const conteo = (key) => (key === 'todos' ? 0 : items.value.filter((p) => coincide(p, key)).length);

function abrir(id) { props.f7router.navigate(`/pendientes/${id}/`); }

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await api.pendientes.list();
  } catch (e) {
    error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}
function onRefresh(done) { cargar().finally(done); }

onMounted(cargar);
watch(() => store.tick, cargar);
</script>

<style scoped>
.filtros-scroll {
  display: flex; gap: 8px; padding: 8px 16px; overflow-x: auto;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.filtros-scroll::-webkit-scrollbar { display: none; }
.filtro-chip {
  padding: 8px 14px; border-radius: 999px; font-size: 14px; font-weight: 600;
  white-space: nowrap; cursor: pointer; display: flex; align-items: center; gap: 6px;
}
.filtro-chip.active {
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; border-color: transparent;
}
.chip-count {
  font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
}
.filtro-chip.active .chip-count { background: rgba(255, 255, 255, 0.25); }
.item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
