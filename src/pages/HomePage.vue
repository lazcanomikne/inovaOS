<template>
  <f7-page name="home" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>INOVATECH OS</f7-nav-title>
      <f7-nav-title-large>Hola, {{ usuario.nombre.split(' ')[0] }}</f7-nav-title-large>
      <f7-nav-right>
        <f7-link icon-f7="bell_fill" />
      </f7-nav-right>
    </f7-navbar>

    <f7-ptr-preloader slot="fixed" />

    <!-- Resumen semáforo -->
    <div class="block-title">Mis pendientes</div>
    <div class="semaforo-grid">
      <div
        v-for="s in semaforo"
        :key="s.key"
        class="glass semaforo-card"
        @click="irAPendientes(s.key)"
      >
        <span class="st-dot" :class="'st-' + s.key"></span>
        <div class="semaforo-num">{{ s.total }}</div>
        <div class="semaforo-label">{{ s.label }}</div>
      </div>
    </div>

    <!-- Acciones rápidas -->
    <div class="block-title">Acciones rápidas</div>
    <div class="acciones-row">
      <div class="glass accion-card" @click="$f7router.navigate('/captura/')">
        <i class="f7-icons accion-icon">plus_circle_fill</i>
        <span>Nuevo pendiente</span>
      </div>
      <div class="glass accion-card" @click="irTablero">
        <i class="f7-icons accion-icon">chart_pie_fill</i>
        <span>Ver tablero</span>
      </div>
    </div>

    <!-- Próximos a vencer -->
    <div class="block-title">Próximos a vencer</div>
    <div v-if="loading" class="block">
      <f7-preloader />
    </div>
    <div v-else class="list glass-list media-list no-margin-top no-hairlines">
      <ul>
        <li v-for="p in proximos" :key="p.id">
          <a class="item-link item-content" @click="abrir(p.id)">
            <div class="item-media">
              <span class="st-dot" :class="'st-' + estatusColor(p)"></span>
            </div>
            <div class="item-inner">
              <div class="item-title-row">
                <div class="item-title">{{ p.titulo }}</div>
                <div class="item-after badge-glass">{{ p.prioridad }}</div>
              </div>
              <div class="item-subtitle">{{ p.responsable_nombre || 'Sin asignar' }}</div>
              <div class="item-text">Vence {{ formatFecha(p.fecha_compromiso) }}</div>
            </div>
          </a>
        </li>
        <li v-if="!proximos.length">
          <div class="item-content">
            <div class="item-inner">
              <div class="item-title text-color-gray">Nada por vencer 🎉</div>
            </div>
          </div>
        </li>
      </ul>
    </div>

  </f7-page>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue';
import { api } from '@/js/api.js';

const { proxy } = getCurrentInstance();
const $f7 = proxy.$f7;

const loading = ref(true);
const usuario = ref({ nombre: 'Carolina G.' });
const proximos = ref([]);
const semaforo = ref([
  { key: 'vencido', label: 'Vencidos', total: 0 },
  { key: 'hoy', label: 'Vencen hoy', total: 0 },
  { key: 'manana', label: 'Vencen mañana', total: 0 },
  { key: 'tiempo', label: 'En tiempo', total: 0 },
  { key: 'concluido', label: 'Concluidos', total: 0 },
  { key: 'espera', label: 'En espera', total: 0 },
]);

function estatusColor(p) {
  if (p.estatus === 'concluido' || p.estatus === 'aprobado') return 'concluido';
  if (p.estatus === 'en_espera') return 'espera';
  const dias = diasRestantes(p.fecha_compromiso);
  if (dias < 0) return 'vencido';
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'manana';
  return 'tiempo';
}

function diasRestantes(fecha) {
  if (!fecha) return 999;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return Math.round((f - hoy) / 86400000);
}

function formatFecha(fecha) {
  if (!fecha) return '—';
  const d = diasRestantes(fecha);
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d < 0) return `hace ${-d} d`;
  return `en ${d} d`;
}

async function cargar() {
  loading.value = true;
  try {
    const data = await api.tablero.resumen();
    if (data?.semaforo) {
      semaforo.value = semaforo.value.map((s) => ({
        ...s,
        total: data.semaforo[s.key] ?? 0,
      }));
    }
    proximos.value = data?.proximos ?? [];
  } catch (e) {
    // Modo offline / API aún no configurada: datos de muestra
    proximos.value = demoProximos;
    aplicarDemoSemaforo();
  } finally {
    loading.value = false;
  }
}

function aplicarDemoSemaforo() {
  const demo = { vencido: 7, hoy: 14, manana: 9, tiempo: 62, concluido: 15, espera: 28 };
  semaforo.value = semaforo.value.map((s) => ({ ...s, total: demo[s.key] ?? 0 }));
}

const demoProximos = [
  { id: 'demo1', titulo: 'Cotizar Mahle Audio', responsable_nombre: 'Carlos Narváez', prioridad: 'Alta', fecha_compromiso: new Date(Date.now() + 86400000).toISOString(), estatus: 'en_progreso' },
  { id: 'demo2', titulo: 'Enviar propuesta a cliente Norte', responsable_nombre: 'Ana López', prioridad: 'Media', fecha_compromiso: new Date().toISOString(), estatus: 'aceptado' },
];

function abrir(id) {
  proxy.$f7router.navigate(`/pendientes/${id}/`);
}
function irAPendientes(filtro) {
  $f7.tab.show('#view-pendientes');
}
function irTablero() {
  $f7.tab.show('#view-tablero');
}
function onRefresh(done) {
  cargar().finally(() => done());
}

onMounted(cargar);
</script>

<style scoped>
.semaforo-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 0 16px;
}
.semaforo-card {
  border-radius: 20px;
  padding: 14px 12px;
  text-align: left;
  position: relative;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.semaforo-card:active { transform: scale(0.96); }
.semaforo-card .st-dot { position: absolute; top: 14px; right: 14px; }
.semaforo-num { font-size: 28px; font-weight: 800; letter-spacing: -0.02em; }
.semaforo-label { font-size: 12px; opacity: 0.7; margin-top: 2px; }

.acciones-row { display: flex; gap: 12px; padding: 0 16px; }
.accion-card {
  flex: 1;
  border-radius: 18px;
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
}
.accion-card:active { transform: scale(0.97); }
.accion-icon {
  font-size: 26px;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
</style>
