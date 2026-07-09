<template>
  <f7-page name="pendientes" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Pendientes</f7-nav-title>
      <f7-nav-title-large>Pendientes</f7-nav-title-large>
    </f7-navbar>

    <f7-ptr-preloader slot="fixed" />

    <!-- Filtros por estatus -->
    <div class="filtros-scroll">
      <div
        v-for="f in filtros"
        :key="f.key"
        class="glass filtro-chip"
        :class="{ active: filtro === f.key }"
        @click="filtro = f.key"
      >
        {{ f.label }}
      </div>
    </div>

    <div v-if="loading" class="block text-align-center">
      <f7-preloader />
    </div>

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
              <div class="item-subtitle">{{ p.responsable_nombre || 'Sin asignar' }} · {{ etiquetaEstatus(p.estatus) }}</div>
              <div class="item-text">Vence {{ formatFecha(p.fecha_compromiso) }}</div>
            </div>
          </a>
        </li>
        <li v-if="!filtrados.length">
          <div class="item-content"><div class="item-inner text-color-gray">Sin pendientes en este filtro.</div></div>
        </li>
      </ul>
    </div>

    <div style="height: 90px"></div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, getCurrentInstance } from 'vue';
import { api } from '@/js/api.js';

const { proxy } = getCurrentInstance();
const loading = ref(true);
const items = ref([]);
const filtro = ref('todos');

const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'hoy', label: 'Vencen hoy' },
  { key: 'activo', label: 'En curso' },
  { key: 'concluido', label: 'Concluidos' },
];

const filtrados = computed(() => {
  if (filtro.value === 'todos') return items.value;
  return items.value.filter((p) => {
    const c = estatusColor(p);
    if (filtro.value === 'concluido') return ['concluido', 'aprobado'].includes(p.estatus);
    if (filtro.value === 'activo') return !['concluido', 'aprobado'].includes(p.estatus);
    return c === filtro.value;
  });
});

function diasRestantes(fecha) {
  if (!fecha) return 999;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha); f.setHours(0,0,0,0);
  return Math.round((f - hoy) / 86400000);
}
function estatusColor(p) {
  if (['concluido','aprobado'].includes(p.estatus)) return 'concluido';
  if (p.estatus === 'en_espera') return 'espera';
  const d = diasRestantes(p.fecha_compromiso);
  if (d < 0) return 'vencido';
  if (d === 0) return 'hoy';
  if (d === 1) return 'manana';
  return 'tiempo';
}
function etiquetaEstatus(e) {
  return { capturado:'Capturado', delegado:'Delegado', aceptado:'Aceptado', en_progreso:'En progreso', en_espera:'En espera', concluido:'Concluido', aprobado:'Aprobado', reagendado:'Reagendado' }[e] || e;
}
function formatFecha(fecha) {
  const d = diasRestantes(fecha);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d < 0) return `hace ${-d} d`;
  if (d === 999) return '—';
  return `en ${d} d`;
}
function abrir(id) { proxy.$f7router.navigate(`/pendientes/${id}/`); }

async function cargar() {
  loading.value = true;
  try {
    items.value = await api.pendientes.list();
  } catch (e) {
    items.value = demo;
  } finally {
    loading.value = false;
  }
}
function onRefresh(done) { cargar().finally(done); }

const demo = [
  { id:'demo1', titulo:'Cotizar Mahle Audio', responsable_nombre:'Carlos Narváez', prioridad:'Alta', fecha_compromiso:new Date(Date.now()+86400000).toISOString(), estatus:'en_progreso' },
  { id:'demo2', titulo:'Enviar propuesta cliente Norte', responsable_nombre:'Ana López', prioridad:'Media', fecha_compromiso:new Date().toISOString(), estatus:'aceptado' },
  { id:'demo3', titulo:'Revisar contrato proveedor', responsable_nombre:'Carlos Narváez', prioridad:'Alta', fecha_compromiso:new Date(Date.now()-86400000).toISOString(), estatus:'delegado' },
  { id:'demo4', titulo:'Cierre mensual de ventas', responsable_nombre:'Carolina G.', prioridad:'Baja', fecha_compromiso:new Date(Date.now()-2*86400000).toISOString(), estatus:'aprobado' },
];

onMounted(cargar);
</script>

<style scoped>
.filtros-scroll {
  display: flex; gap: 8px; padding: 8px 16px; overflow-x: auto;
  -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.filtros-scroll::-webkit-scrollbar { display: none; }
.filtro-chip {
  padding: 8px 16px; border-radius: 999px; font-size: 14px; font-weight: 600;
  white-space: nowrap; cursor: pointer;
}
.filtro-chip.active {
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; border-color: transparent;
}
.item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
</style>
