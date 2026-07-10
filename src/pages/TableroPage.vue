<template>
  <f7-page name="tablero" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Tablero</f7-nav-title>
      <f7-nav-title-large>Tablero</f7-nav-title-large>
    </f7-navbar>
    <div v-if="error" class="block">
      <div class="glass error-card">
        <i class="f7-icons">exclamationmark_triangle_fill</i>
        <div><strong>No se pudo conectar</strong><div class="error-sub">{{ error }}</div></div>
      </div>
      <f7-button class="glass-btn margin-top" @click="cargar">Reintentar</f7-button>
    </div>

    <template v-else>
      <div class="block">
        <div class="card glass-strong dona-card">
          <div class="card-content card-content-padding dona-wrap">
            <svg viewBox="0 0 42 42" class="dona">
              <circle class="dona-bg" cx="21" cy="21" r="15.915" />
              <circle
                v-for="(seg, i) in segmentos"
                :key="i"
                class="dona-seg"
                :stroke="seg.color"
                cx="21" cy="21" r="15.915"
                :stroke-dasharray="`${seg.pct} ${100 - seg.pct}`"
                :stroke-dashoffset="seg.offset"
              />
              <text x="21" y="20" class="dona-total">{{ total }}</text>
              <text x="21" y="26" class="dona-sub">pendientes</text>
            </svg>
          </div>
        </div>
      </div>

      <div class="list glass-list simple-list no-hairlines">
        <ul>
          <li v-for="s in semaforo" :key="s.key">
            <span><span class="st-dot" :class="'st-' + s.key"></span> {{ s.label }}</span>
            <span class="badge-glass">{{ s.total }}</span>
          </li>
        </ul>
      </div>

      <div v-if="!total && !loading" class="block text-align-center text-color-gray">
        Aún no hay pendientes registrados.
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '@/js/api.js';
import { store } from '@/js/store.js';

const COLORES = {
  vencido: '#ff453a', hoy: '#ff9f0a', manana: '#ffd60a',
  tiempo: '#30d158', concluido: '#0a84ff', espera: '#bf5af2',
};

const loading = ref(true);
const error = ref('');
const semaforo = ref([
  { key: 'vencido', label: 'Vencidos', total: 0 },
  { key: 'hoy', label: 'Vencen hoy', total: 0 },
  { key: 'manana', label: 'Vencen mañana', total: 0 },
  { key: 'tiempo', label: 'En tiempo', total: 0 },
  { key: 'concluido', label: 'Concluidos', total: 0 },
  { key: 'espera', label: 'Esperando respuesta', total: 0 },
]);

const total = computed(() => semaforo.value.reduce((a, s) => a + s.total, 0));

const segmentos = computed(() => {
  const t = total.value || 1;
  let acc = 0;
  return semaforo.value
    .filter((s) => s.total > 0)
    .map((s) => {
      const pct = (s.total / t) * 100;
      const offset = 25 - acc;
      acc += pct;
      return { pct, offset, color: COLORES[s.key] };
    });
});

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.tablero.resumen();
    semaforo.value = semaforo.value.map((s) => ({ ...s, total: data.semaforo?.[s.key] ?? 0 }));
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
.dona-wrap { display: flex; justify-content: center; }
.dona { width: 220px; height: 220px; }
.dona-bg { fill: none; stroke: rgba(150, 150, 180, 0.15); stroke-width: 5; }
.dona-seg { fill: none; stroke-width: 5; stroke-linecap: round; transition: all 0.4s ease; }
.dona-total { font-size: 8px; font-weight: 800; text-anchor: middle; fill: currentColor; }
.dona-sub { font-size: 2.6px; text-anchor: middle; fill: currentColor; opacity: 0.6; }
.simple-list li { display: flex; justify-content: space-between; align-items: center; }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
