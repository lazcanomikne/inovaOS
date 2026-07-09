<template>
  <f7-page name="tablero" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Tablero</f7-nav-title>
      <f7-nav-title-large>Tablero</f7-nav-title-large>
    </f7-navbar>
    <f7-ptr-preloader slot="fixed" />

    <!-- Dona de distribución -->
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
            <text x="21" y="20" class="dona-total">{{ totalPend }}</text>
            <text x="21" y="26" class="dona-sub">pendientes</text>
          </svg>
        </div>
      </div>
    </div>

    <!-- Leyenda semáforo -->
    <div class="list glass-list simple-list no-hairlines">
      <ul>
        <li v-for="s in semaforo" :key="s.key">
          <span><span class="st-dot" :class="'st-'+s.key"></span> {{ s.label }}</span>
          <span class="badge-glass">{{ s.total }}</span>
        </li>
      </ul>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '@/js/api.js';

const semaforo = ref([
  { key:'vencido', label:'Vencidos', total:7, color:'var(--st-vencido)' },
  { key:'hoy', label:'Vencen hoy', total:14, color:'var(--st-hoy)' },
  { key:'manana', label:'Vencen mañana', total:9, color:'var(--st-manana)' },
  { key:'tiempo', label:'En tiempo', total:62, color:'var(--st-tiempo)' },
  { key:'concluido', label:'Concluidos hoy', total:15, color:'var(--st-concluido)' },
  { key:'espera', label:'Esperando respuesta', total:28, color:'var(--st-espera)' },
]);

const colores = { vencido:'#ff453a', hoy:'#ff9f0a', manana:'#ffd60a', tiempo:'#30d158', concluido:'#0a84ff', espera:'#bf5af2' };

const totalPend = computed(() => semaforo.value.reduce((a, s) => a + s.total, 0));

const segmentos = computed(() => {
  const total = totalPend.value || 1;
  let acc = 0;
  return semaforo.value.map((s) => {
    const pct = (s.total / total) * 100;
    const offset = 25 - acc; // empieza arriba
    acc += pct;
    return { pct, offset, color: colores[s.key] };
  });
});

async function cargar() {
  try {
    const data = await api.tablero.resumen();
    if (data?.semaforo) {
      semaforo.value = semaforo.value.map((s) => ({ ...s, total: data.semaforo[s.key] ?? s.total }));
    }
  } catch (e) { /* usa demo */ }
}
function onRefresh(done){ cargar().finally(done); }
onMounted(cargar);
</script>

<style scoped>
.dona-wrap { display: flex; justify-content: center; }
.dona { width: 220px; height: 220px; transform: rotate(0deg); }
.dona-bg { fill: none; stroke: rgba(150,150,180,0.15); stroke-width: 5; }
.dona-seg { fill: none; stroke-width: 5; stroke-linecap: round; transition: all 0.4s ease; }
.dona-total { font-size: 8px; font-weight: 800; text-anchor: middle; fill: currentColor; }
.dona-sub { font-size: 2.6px; text-anchor: middle; fill: currentColor; opacity: 0.6; }
.simple-list li { display: flex; justify-content: space-between; align-items: center; }
</style>
