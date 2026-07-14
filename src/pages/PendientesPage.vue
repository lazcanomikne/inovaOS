<template>
  <f7-page name="pendientes" ptr @ptr:refresh="onRefresh">
    <f7-navbar large transparent>
      <f7-nav-title>Pendientes</f7-nav-title>
      <f7-nav-title-large>Pendientes</f7-nav-title-large>
    </f7-navbar>

    <!-- Buscador: filtra por cualquier texto del pendiente -->
    <div class="buscador glass">
      <i class="f7-icons buscar-ico">search</i>
      <input type="search" v-model="busqueda" placeholder="Buscar en pendientes…" enterkeyhint="search" />
      <i v-if="busqueda" class="f7-icons buscar-limpiar" @click="busqueda = ''">xmark_circle_fill</i>
    </div>

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
        <li v-for="p in filtrados" :key="p.id" class="swipeout">
          <div class="swipeout-content">
            <a class="item-link item-content" @click="abrir(p.id)">
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
          </div>
          <div class="swipeout-actions-right">
            <a href="#" class="swipeout-close swipe-archivar" :class="{ desarchivar: verArchivados }" @click="alternarArchivo(p)">
              <i class="f7-icons">{{ verArchivados ? 'tray_arrow_up_fill' : 'archivebox_fill' }}</i>
              <span>{{ verArchivados ? 'Desarchivar' : 'Archivar' }}</span>
            </a>
          </div>
        </li>
        <li v-if="!filtrados.length">
          <div class="item-content">
            <div class="item-inner vacio">
              <span class="text-color-gray">{{ mensajeVacio }}</span>
              <a v-if="filtro !== 'inmediata' || relacion !== 'todas' || busqueda" class="link" @click="limpiarFiltros">Restablecer</a>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, setFiltro, refrescar } from '@/js/store.js';
import { estatusColor, etiquetaEstatus, formatFecha, relacionCon, CATEGORIAS, enCategoria } from '@/js/pendientes.js';

const props = defineProps({ f7router: Object });
const loading = ref(true);
const error = ref('');
const activos = ref([]);
const archivados = ref([]);
const archivadosCargados = ref(false);

const verArchivados = computed(() => filtro.value === 'archivados');
const items = computed(() => (verArchivados.value ? archivados.value : activos.value));

// Buscador: filtra por cualquier texto del pendiente, sin acentos ni mayúsculas.
const busqueda = ref('');
const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function coincideBusqueda(p) {
  const q = normTxt(busqueda.value.trim());
  if (!q) return true;
  const campos = [p.titulo, p.descripcion, p.responsable_nombre, p.area, p.cliente, p.tipo, p.prioridad, etiquetaEstatus(p.estatus)]
    .map(normTxt).join(' ');
  return campos.includes(q);
}

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

// Categorías: Atención inmediata, Vencidos, Hoy, Próximos 7 días, En espera,
// Sin fecha, Concluidos, Archivados. La regla vive en pendientes.js (enCategoria).
const filtros = CATEGORIAS;

const coincide = (p, key) => enCategoria(p, key, store.usuario);

// Primero acotamos por relación, luego por estatus (los conteos de los chips
// reflejan la relación elegida). En la vista de archivados no se filtra por estatus.
const enRelacion = computed(() => items.value.filter(coincideRelacion));
const filtrados = computed(() => {
  // Al buscar, se ignora el chip de categoría: se busca en todo lo visible.
  if (busqueda.value.trim()) return enRelacion.value.filter(coincideBusqueda);
  return verArchivados.value ? enRelacion.value : enRelacion.value.filter((p) => coincide(p, filtro.value));
});
const conteo = (key) => {
  if (key === 'archivados') return archivados.value.filter(coincideRelacion).length;
  return activos.value.filter(coincideRelacion).filter((p) => coincide(p, key)).length;
};
const etiquetaFiltro = computed(() => filtros.find((f) => f.key === filtro.value)?.label ?? '');

const mensajeVacio = computed(() => {
  if (busqueda.value.trim()) return `Sin resultados para «${busqueda.value.trim()}».`;
  if (verArchivados.value) return 'No tienes pendientes archivados.';
  if (filtro.value === 'inmediata') return 'Nada requiere tu atención inmediata 🎉';
  return `Nada en «${etiquetaFiltro.value}».`;
});

function limpiarFiltros() {
  filtro.value = 'inmediata';
  relacion.value = 'todas';
  busqueda.value = '';
}

function abrir(id) { props.f7router.navigate(`/pendientes/${id}/`); }

async function cargar(silencioso = false) {
  if (!silencioso) loading.value = true;
  error.value = '';
  try {
    activos.value = await api.pendientes.list();
    if (archivadosCargados.value) archivados.value = await api.pendientes.list('?archivados=1');
  } catch (e) {
    if (!silencioso) error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}
async function cargarArchivados() {
  try {
    archivados.value = await api.pendientes.list('?archivados=1');
    archivadosCargados.value = true;
  } catch (e) {
    f7.toast.create({ text: 'No se pudieron cargar los archivados', closeTimeout: 1800, position: 'center' }).open();
  }
}
function onRefresh(done) { cargar().finally(done); }

// Archivar (o desarchivar) un pendiente. No afecta el semáforo/métricas.
async function alternarArchivo(p) {
  const archivar = !verArchivados.value;
  // Optimista: lo quitamos de la lista actual de inmediato.
  activos.value = activos.value.filter((x) => x.id !== p.id);
  archivados.value = archivados.value.filter((x) => x.id !== p.id);
  try {
    await api.pendientes.archivar(p.id, archivar);
    if (archivar) archivados.value = [p, ...archivados.value];
    else activos.value = [p, ...activos.value];
    refrescar(); // sincroniza Inicio/Tablero (contadores)
    f7.toast.create({ text: archivar ? 'Archivado' : 'Desarchivado', closeTimeout: 1400, position: 'center' }).open();
  } catch (e) {
    f7.toast.create({ text: 'No se pudo archivar', closeTimeout: 1800, position: 'center' }).open();
    cargar();
    if (verArchivados.value) cargarArchivados();
  }
}

onMounted(cargar);
watch(() => store.tick, () => cargar(true)); // recarga silenciosa (sin parpadeo)
// Carga perezosa de archivados al entrar a esa vista.
watch(verArchivados, (v) => { if (v && !archivadosCargados.value) cargarArchivados(); });
</script>

<style scoped>
.buscador {
  display: flex; align-items: center; gap: 8px; margin: 10px 16px 0; padding: 9px 14px; border-radius: 14px;
}
.buscador .buscar-ico { font-size: 19px; color: rgba(60, 60, 67, 0.5); flex: 0 0 auto; }
.buscador input {
  flex: 1; border: none; background: transparent; outline: none; font-size: 16px; color: #1f1a33;
  font-family: inherit; min-width: 0;
}
.buscador input::-webkit-search-cancel-button { display: none; }
.buscador .buscar-limpiar { font-size: 19px; color: rgba(60, 60, 67, 0.4); cursor: pointer; flex: 0 0 auto; }

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

/* Botón que aparece al deslizar a la izquierda (estilo WhatsApp) */
.swipe-archivar {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  background: linear-gradient(135deg, #ff9f0a, #ffb340); color: #fff !important;
  font-size: 12px; font-weight: 700; padding: 0 20px; min-width: 96px;
}
.swipe-archivar i { font-size: 22px; }
.swipe-archivar.desarchivar { background: linear-gradient(135deg, #34c759, #30d158); }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
