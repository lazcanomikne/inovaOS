<template>
  <f7-page name="home" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>InovaOS</f7-nav-title>
      <f7-nav-title-large>Hola, {{ primerNombre }}</f7-nav-title-large>
      <f7-nav-right>
        <f7-link icon-f7="bell_fill" />
      </f7-nav-right>
    </f7-navbar>

    <div v-if="error" class="block">
      <div class="glass error-card">
        <i class="f7-icons">exclamationmark_triangle_fill</i>
        <div>
          <strong>No se pudo conectar</strong>
          <div class="error-sub">{{ error }}</div>
        </div>
      </div>
      <f7-button class="glass-btn margin-top" @click="cargar">Reintentar</f7-button>
    </div>

    <template v-else>
      <div class="block-title">Mis pendientes</div>
      <div class="semaforo-grid">
        <div v-for="s in semaforo" :key="s.key" class="glass semaforo-card" @click="verFiltrados(s.key)">
          <span class="st-dot" :class="'st-' + s.key"></span>
          <div class="semaforo-num">{{ loading ? '·' : s.total }}</div>
          <div class="semaforo-label">{{ s.label }}</div>
        </div>
      </div>

      <div class="block-title">Acciones rápidas</div>
      <div class="acciones-row">
        <div class="glass accion-card" @click="irCaptura">
          <i class="f7-icons accion-icon">plus_circle_fill</i>
          <span>Nuevo pendiente</span>
        </div>
        <div class="glass accion-card" @click="irTablero">
          <i class="f7-icons accion-icon">chart_pie_fill</i>
          <span>Ver tablero</span>
        </div>
      </div>

      <div class="block-title">Próximos a vencer</div>
      <div v-if="loading" class="block text-align-center"><f7-preloader /></div>
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
              <div class="item-inner text-color-gray">Nada por vencer 🎉</div>
            </div>
          </li>
        </ul>
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, setFiltro } from '@/js/store.js';
import { estatusColor, formatFecha } from '@/js/pendientes.js';

// Framework7 pasa f7router a los componentes de ruta.
const props = defineProps({ f7router: Object });

const loading = ref(true);
const error = ref('');
const proximos = ref([]);
const semaforo = ref([
  { key: 'vencido', label: 'Vencidos', total: 0 },
  { key: 'hoy', label: 'Vencen hoy', total: 0 },
  { key: 'manana', label: 'Vencen mañana', total: 0 },
  { key: 'tiempo', label: 'En tiempo', total: 0 },
  { key: 'concluido', label: 'Concluidos', total: 0 },
  { key: 'espera', label: 'En espera', total: 0 },
]);

const primerNombre = computed(() => store.usuario.nombre.split(' ')[0]);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.tablero.resumen();
    semaforo.value = semaforo.value.map((s) => ({ ...s, total: data.semaforo?.[s.key] ?? 0 }));
    proximos.value = data.proximos ?? [];
  } catch (e) {
    error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}

function abrir(id) { props.f7router.navigate(`/pendientes/${id}/`); }
// Cada tarjeta del semáforo lleva a la lista, mapeada a las categorías nuevas.
const MAPA_FILTRO = {
  vencido: 'vencidos', hoy: 'hoy', manana: 'proximos',
  tiempo: 'proximos', concluido: 'concluidos', espera: 'espera',
};
function verFiltrados(key) {
  setFiltro(MAPA_FILTRO[key] || key);
  f7.tab.show('#view-pendientes');
}
function irCaptura() { f7.tab.show('#view-captura'); }
function irTablero() { f7.tab.show('#view-tablero'); }
function onRefresh(done) { cargar().finally(done); }

onMounted(cargar);
watch(() => store.tick, cargar);
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
  flex: 1; border-radius: 18px; padding: 18px 14px;
  display: flex; flex-direction: column; gap: 8px; cursor: pointer;
}
.accion-card:active { transform: scale(0.97); }
.accion-icon {
  font-size: 26px;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }

.error-card {
  border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center;
}
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
