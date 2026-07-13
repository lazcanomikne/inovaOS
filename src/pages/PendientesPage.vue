<template>
  <f7-page name="pendientes" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Pendientes</f7-nav-title>
      <f7-nav-title-large>Pendientes</f7-nav-title-large>
    </f7-navbar>

    <!-- Relación: para mí / yo delegué -->
    <div class="segmentado glass">
      <button
        v-for="r in relaciones"
        :key="r.key"
        type="button"
        class="seg-btn"
        :class="{ active: relacion === r.key }"
        @click="relacion = r.key"
      >
        {{ r.label }}
      </button>
    </div>

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
                <span v-if="etiquetaRelacion(p)" class="rel-tag" :class="'rel-' + relacionCon(p, store.usuario)">
                  {{ etiquetaRelacion(p) }}
                </span>
                {{ p.responsable_nombre || 'Sin asignar' }} · {{ etiquetaEstatus(p.estatus) }}
              </div>
              <div class="item-text">Vence {{ formatFecha(p.fecha_compromiso) }}</div>
            </div>
          </a>
        </li>
        <li v-if="!filtrados.length">
          <div class="item-content">
            <div class="item-inner vacio">
              <span class="text-color-gray">{{ mensajeVacio }}</span>
              <a v-if="filtro !== 'todos' || relacion !== 'todas'" class="link" @click="limpiarFiltros">Ver todos</a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '@/js/api.js';
import { store, setFiltro } from '@/js/store.js';
import { estatusColor, etiquetaEstatus, formatFecha, CERRADOS, relacionCon } from '@/js/pendientes.js';

const props = defineProps({ f7router: Object });
const loading = ref(true);
const error = ref('');
const items = ref([]);

// Relación con el pendiente. Sobrevive a la navegación (la vista queda montada).
const relacion = ref('todas');
const relaciones = [
  { key: 'todas', label: 'Todas' },
  { key: 'mia', label: 'Para mí' },
  { key: 'delegada', label: 'Yo delegué' },
];
function coincideRelacion(p) {
  if (relacion.value === 'todas') return true;
  const r = relacionCon(p, store.usuario);
  if (relacion.value === 'mia') return r === 'mia' || r === 'ambas';
  if (relacion.value === 'delegada') return r === 'delegada' || r === 'ambas';
  return true;
}
function etiquetaRelacion(p) {
  const r = relacionCon(p, store.usuario);
  if (r === 'ambas') return 'Mío';
  if (r === 'mia') return 'Para mí';
  if (r === 'delegada') return 'Delegué';
  return '';
}
// Fuente única: el filtro vive en el store, así Inicio puede fijarlo
// (al tocar una tarjeta del semáforo) y la lista lo refleja al instante.
const filtro = computed({
  get: () => store.filtro,
  set: (v) => setFiltro(v),
});

// Mismas claves que el semáforo de Inicio, para que al tocar una tarjeta
// la lista muestre exactamente ese grupo.
const filtros = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'hoy', label: 'Vencen hoy' },
  { key: 'manana', label: 'Vencen mañana' },
  { key: 'tiempo', label: 'En tiempo' },
  { key: 'espera', label: 'En espera' },
  { key: 'concluido', label: 'Concluidos' },
];

function coincide(p, key) {
  if (key === 'todos') return true;
  if (key === 'concluido') return CERRADOS.includes(p.estatus);
  return estatusColor(p) === key;
}

// Primero acotamos por relación, luego por estatus (los conteos de los chips
// reflejan la relación elegida).
const enRelacion = computed(() => items.value.filter(coincideRelacion));
const filtrados = computed(() => enRelacion.value.filter((p) => coincide(p, filtro.value)));
const conteo = (key) => (key === 'todos' ? 0 : enRelacion.value.filter((p) => coincide(p, key)).length);
const etiquetaFiltro = computed(() => filtros.find((f) => f.key === filtro.value)?.label ?? '');

const mensajeVacio = computed(() => {
  if (filtro.value !== 'todos') return `Nada en «${etiquetaFiltro.value}».`;
  if (relacion.value === 'mia') return 'No tienes pendientes asignados.';
  if (relacion.value === 'delegada') return 'No has delegado pendientes.';
  return 'Aún no hay pendientes.';
});

function limpiarFiltros() {
  filtro.value = 'todos';
  relacion.value = 'todas';
}

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
.segmentado {
  display: flex; margin: 8px 16px 0; padding: 4px; border-radius: 14px; gap: 4px;
}
.seg-btn {
  flex: 1; border: none; background: transparent; cursor: pointer;
  padding: 8px 6px; border-radius: 10px; font-size: 13px; font-weight: 600;
  color: rgba(60, 60, 67, 0.6); transition: all 0.15s ease;
}
.seg-btn.active {
  background: #fff; color: var(--inova-primary);
  box-shadow: 0 1px 4px rgba(17, 12, 46, 0.12);
}
.rel-tag {
  font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 999px; margin-right: 6px;
}
.rel-mia, .rel-ambas { background: rgba(91, 91, 214, 0.14); color: var(--inova-primary); }
.rel-delegada { background: rgba(255, 159, 10, 0.16); color: #b26a00; }

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
.vacio { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.item-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
