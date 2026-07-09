<template>
  <f7-page name="pendiente-detalle">
    <f7-navbar transparent back-link="Atrás">
      <f7-nav-title>Detalle</f7-nav-title>
    </f7-navbar>

    <div v-if="loading" class="block text-align-center"><f7-preloader /></div>

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

      <!-- Acciones según estatus -->
      <div class="block">
        <f7-button v-if="p.estatus==='delegado'" large fill @click="cambiar('aceptado')">Aceptar</f7-button>
        <f7-button v-if="p.estatus==='aceptado'" large fill @click="cambiar('en_progreso')">Iniciar</f7-button>
        <f7-button v-if="p.estatus==='en_progreso'" large fill @click="cambiar('concluido')">Concluir con evidencia</f7-button>
        <f7-button v-if="p.estatus==='concluido'" large fill color="green" @click="cambiar('aprobado')">Aprobar</f7-button>
      </div>

      <!-- Historial / trazabilidad (paso 8) -->
      <div class="block-title">Historial</div>
      <div class="timeline">
        <div v-for="(h, i) in historial" :key="i" class="timeline-item">
          <div class="timeline-item-date">{{ h.hora }}</div>
          <div class="timeline-item-divider"></div>
          <div class="timeline-item-content glass">
            <div class="timeline-item-title">{{ h.evento }}</div>
            <div class="timeline-item-subtitle">{{ h.detalle }}</div>
          </div>
        </div>
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, onMounted, getCurrentInstance } from 'vue';
import { api } from '@/js/api.js';

const { proxy } = getCurrentInstance();
const $f7 = proxy.$f7;
const id = proxy.$f7route.params.id;

const loading = ref(true);
const p = ref(null);
const historial = ref([]);

function diasRestantes(f){ if(!f) return 999; const h=new Date();h.setHours(0,0,0,0); const d=new Date(f);d.setHours(0,0,0,0); return Math.round((d-h)/86400000); }
function estatusColor(p){ if(['concluido','aprobado'].includes(p.estatus)) return 'concluido'; const d=diasRestantes(p.fecha_compromiso); if(d<0)return'vencido'; if(d===0)return'hoy'; if(d===1)return'manana'; return'tiempo'; }
function etiquetaEstatus(e){ return {capturado:'Capturado',delegado:'Delegado',aceptado:'Aceptado',en_progreso:'En progreso',en_espera:'En espera',concluido:'Concluido',aprobado:'Aprobado',reagendado:'Reagendado'}[e]||e; }
function formatFecha(f){ const d=diasRestantes(f); if(d===0)return'hoy'; if(d===1)return'mañana'; if(d<0)return`hace ${-d} d`; if(d===999)return'—'; return`en ${d} d`; }

async function cargar() {
  loading.value = true;
  try {
    const data = await api.pendientes.get(id);
    p.value = data.pendiente || data;
    historial.value = data.historial || demoHist;
  } catch (e) {
    p.value = { id, titulo:'Cotizar Mahle Audio', descripcion:'Cotización para viernes con proveedor.', responsable_nombre:'Carlos Narváez', prioridad:'Alta', area:'Ventas', fecha_compromiso:new Date(Date.now()+86400000).toISOString(), estatus:'en_progreso' };
    historial.value = demoHist;
  } finally {
    loading.value = false;
  }
}

const demoHist = [
  { hora:'08:35', evento:'Creado', detalle:'por Carolina G.' },
  { hora:'08:36', evento:'Delegado', detalle:'a Carlos Narváez' },
  { hora:'08:37', evento:'Aceptado', detalle:'Carlos aceptó' },
  { hora:'10:15', evento:'Solicitó información', detalle:'al proveedor' },
];

async function cambiar(nuevo) {
  try {
    await api.pendientes.update(id, { estatus: nuevo });
    p.value.estatus = nuevo;
    $f7.toast.create({ text: `Estatus: ${etiquetaEstatus(nuevo)}`, closeTimeout: 1800, position:'center' }).open();
  } catch (e) {
    p.value.estatus = nuevo; // optimista en demo
    $f7.toast.create({ text: `Estatus: ${etiquetaEstatus(nuevo)} (demo)`, closeTimeout: 1800, position:'center' }).open();
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
</style>
