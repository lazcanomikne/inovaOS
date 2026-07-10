<template>
  <f7-page name="pendiente-detalle">
    <f7-navbar transparent back-link="Atrás">
      <f7-nav-title>Detalle</f7-nav-title>
    </f7-navbar>

    <div v-if="loading" class="block text-align-center"><f7-preloader /></div>

    <div v-else-if="error" class="block">
      <div class="glass error-card">
        <i class="f7-icons">exclamationmark_triangle_fill</i>
        <div><strong>No se pudo cargar</strong><div class="error-sub">{{ error }}</div></div>
      </div>
      <f7-button class="glass-btn margin-top" @click="cargar">Reintentar</f7-button>
    </div>

    <template v-else-if="p">
      <div class="block">
        <div class="card detalle-card">
          <div class="card-content card-content-padding">
            <div class="det-head">
              <span class="st-dot" :class="'st-' + estatusColor(p)"></span>
              <span class="badge-glass">{{ etiquetaEstatus(p.estatus) }}</span>
              <span class="badge-glass">{{ p.prioridad }}</span>
            </div>
            <h2 class="det-titulo">{{ p.titulo }}</h2>
            <p v-if="p.descripcion" class="det-desc">{{ p.descripcion }}</p>
            <div class="det-meta">
              <div><i class="f7-icons">person_fill</i> {{ p.responsable_nombre || 'Sin asignar' }}</div>
              <div><i class="f7-icons">calendar</i> Vence {{ formatFecha(p.fecha_compromiso) }}</div>
              <div v-if="p.area"><i class="f7-icons">square_grid_2x2_fill</i> {{ p.area }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Acción del flujo (pasos 3-6) -->
      <div v-if="accion" class="block">
        <f7-button large fill :color="accion.color || undefined" @click="cambiar(accion.estatus)" :disabled="guardando">
          {{ guardando ? 'Guardando…' : accion.texto }}
        </f7-button>
      </div>

      <!-- Checklist (paso 4) -->
      <div class="block-title">
        Checklist
        <span v-if="checklist.length" class="check-progreso">{{ hechos }}/{{ checklist.length }}</span>
      </div>
      <div class="list glass-list no-hairlines">
        <ul>
          <li v-for="item in checklist" :key="item.id">
            <label class="item-checkbox item-content">
              <input
                type="checkbox"
                :checked="!!item.completado"
                @change="toggleItem(item, $event.target.checked)"
              />
              <i class="icon icon-checkbox"></i>
              <div class="item-inner">
                <div class="item-title" :class="{ tachado: item.completado }">{{ item.texto }}</div>
              </div>
            </label>
          </li>
          <li class="item-content item-input">
            <div class="item-inner">
              <div class="item-input-wrap">
                <input
                  type="text"
                  v-model="nuevoItem"
                  placeholder="Añadir paso…"
                  @keyup.enter="agregarItem"
                />
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Historial / trazabilidad (paso 8) -->
      <div class="block-title">Historial</div>
      <div class="timeline">
        <div v-for="(h, i) in historial" :key="i" class="timeline-item">
          <div class="timeline-item-date">{{ horaLocal(h.created_at) }}</div>
          <div class="timeline-item-divider"></div>
          <div class="timeline-item-content glass">
            <div class="timeline-item-title">{{ h.evento }}</div>
            <div v-if="h.detalle" class="timeline-item-subtitle">{{ h.detalle }}</div>
          </div>
        </div>
        <div v-if="!historial.length" class="block text-color-gray">Sin eventos aún.</div>
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, refrescar } from '@/js/store.js';
import { estatusColor, etiquetaEstatus, formatFecha, siguienteAccion, horaLocal } from '@/js/pendientes.js';

// Framework7 pasa f7route/f7router a los componentes de ruta.
const props = defineProps({ f7route: Object, f7router: Object });
const id = props.f7route.params.id;

const loading = ref(true);
const guardando = ref(false);
const error = ref('');
const p = ref(null);
const historial = ref([]);
const checklist = ref([]);
const nuevoItem = ref('');

const accion = computed(() => (p.value ? siguienteAccion(p.value.estatus) : null));
const hechos = computed(() => checklist.value.filter((i) => i.completado).length);

async function cargar() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.pendientes.get(id);
    p.value = data.pendiente;
    historial.value = data.historial ?? [];
    checklist.value = data.checklist ?? [];
  } catch (e) {
    error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}

async function cambiar(nuevo) {
  guardando.value = true;
  try {
    await api.pendientes.update(id, { estatus: nuevo, actor_id: store.usuario.id });
    await cargar(); // trae el historial actualizado desde la BD
    refrescar();
    f7.toast.create({ text: `Estatus: ${etiquetaEstatus(nuevo)}`, closeTimeout: 1800, position: 'center' }).open();
  } catch (e) {
    f7.dialog.alert(e.message || 'No se pudo actualizar.', 'Error');
  } finally {
    guardando.value = false;
  }
}

async function agregarItem() {
  const texto = nuevoItem.value.trim();
  if (!texto) return;
  nuevoItem.value = '';
  try {
    const item = await api.checklist.create({ pendiente_id: Number(id), texto, orden: checklist.value.length });
    checklist.value.push(item);
  } catch (e) {
    f7.toast.create({ text: 'No se pudo añadir', closeTimeout: 1800, position: 'center' }).open();
  }
}

async function toggleItem(item, valor) {
  const previo = item.completado;
  item.completado = valor ? 1 : 0; // respuesta inmediata en UI
  try {
    await api.checklist.toggle(item.id, valor);
  } catch (e) {
    item.completado = previo; // revierte si falla
    f7.toast.create({ text: 'No se pudo guardar', closeTimeout: 1800, position: 'center' }).open();
  }
}

onMounted(cargar);
</script>

<style scoped>
.det-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.det-titulo { margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.det-desc { margin: 0 0 14px; opacity: 0.75; }
.det-meta { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.det-meta i { font-size: 17px; margin-right: 8px; color: var(--inova-primary); vertical-align: -2px; }
.timeline-item-content.glass { border-radius: 14px; }
.tachado { text-decoration: line-through; opacity: 0.5; }
.check-progreso {
  float: right; font-size: 13px; font-weight: 700; color: var(--inova-primary);
}
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
