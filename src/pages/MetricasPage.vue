<template>
  <f7-page name="metricas" class="metricas-page">
    <f7-navbar>
      <f7-nav-title>
        <span class="met-title"><i class="f7-icons">chart_bar_alt_fill</i> Métricas</span>
      </f7-nav-title>
    </f7-navbar>

    <div class="met-wrap">
      <p class="met-sub">
        {{ esDireccion ? 'Desempeño de cada colaborador.' : 'Tu desempeño como responsable.' }}
      </p>

      <div v-if="cargando" class="met-loading"><f7-preloader /></div>

      <div v-else-if="!colaboradores.length" class="met-vacio">
        Aún no hay datos suficientes para calcular métricas.
      </div>

      <div v-else class="met-cards">
        <div v-for="c in colaboradores" :key="c.id" class="met-card">
          <div class="met-head">
            <div class="met-avatar">{{ inicial(c.nombre) }}</div>
            <div class="met-name">
              <strong>{{ c.nombre }}</strong>
              <span>{{ c.total }} asignados · {{ c.completados }} completados</span>
            </div>
          </div>

          <div class="met-grid">
            <div class="met-item">
              <div class="met-ico" :class="colorCumpl(c.cumplimiento)"><i class="f7-icons">checkmark_seal_fill</i></div>
              <div class="met-val">{{ c.cumplimiento === null ? '—' : c.cumplimiento + '%' }}</div>
              <div class="met-lbl">Cumplimiento</div>
            </div>
            <div class="met-item">
              <div class="met-ico azul"><i class="f7-icons">timer_fill</i></div>
              <div class="met-val">{{ tiempo(c.tiempo_respuesta_horas) }}</div>
              <div class="met-lbl">Tiempo de respuesta</div>
            </div>
            <div class="met-item">
              <div class="met-ico" :class="c.retrasos > 0 ? 'rojo' : 'verde'"><i class="f7-icons">exclamationmark_triangle_fill</i></div>
              <div class="met-val">{{ c.retrasos }}</div>
              <div class="met-lbl">Retrasos</div>
            </div>
            <div class="met-item">
              <div class="met-ico morado"><i class="f7-icons">paperclip</i></div>
              <div class="met-val">{{ c.calidad_evidencia === null ? '—' : c.calidad_evidencia }}</div>
              <div class="met-lbl">Calidad de evidencia</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { api } from '@/js/api.js';

const cargando = ref(true);
const esDireccion = ref(false);
const colaboradores = ref([]);

const inicial = (n) => (n || '?').trim().charAt(0).toUpperCase();
const colorCumpl = (v) => (v === null ? '' : v >= 80 ? 'verde' : v >= 50 ? 'ambar' : 'rojo');

function tiempo(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h} h`;
  return `${Math.round(h / 24)} d`;
}

onMounted(async () => {
  try {
    const { direccion, colaboradores: cols } = await api.tablero.metricas();
    esDireccion.value = direccion;
    colaboradores.value = cols;
  } catch (e) {
    colaboradores.value = [];
  } finally {
    cargando.value = false;
  }
});
</script>

<style scoped>
.met-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.met-title i { font-size: 18px; color: var(--inova-primary); }

.met-wrap { padding: calc(var(--f7-navbar-height, 56px) + env(safe-area-inset-top) + 8px) 14px calc(120px + env(safe-area-inset-bottom)); }
.met-sub { margin: 4px 2px 14px; font-size: 14px; color: #6b6780; }
.met-loading { text-align: center; padding: 40px 0; }
.met-vacio { text-align: center; padding: 40px 16px; color: #8a8699; font-size: 14px; }

.met-cards { display: flex; flex-direction: column; gap: 12px; }
.met-card {
  background: rgba(255, 255, 255, 0.78); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 20px; padding: 14px;
  box-shadow: 0 6px 20px rgba(17, 12, 46, 0.08);
}
.met-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.met-avatar {
  width: 40px; height: 40px; border-radius: 50%; flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; font-weight: 700; font-size: 17px;
}
.met-name { display: flex; flex-direction: column; min-width: 0; }
.met-name strong { font-size: 16px; color: #15102b; }
.met-name span { font-size: 12px; color: #8a8699; }

.met-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.met-item {
  background: rgba(255, 255, 255, 0.55); border-radius: 14px; padding: 12px 10px; text-align: center;
}
.met-ico {
  width: 34px; height: 34px; margin: 0 auto 6px; border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.met-ico i { font-size: 18px; color: #fff; }
.met-ico.verde { background: linear-gradient(135deg, #34c759, #30d158); }
.met-ico.ambar { background: linear-gradient(135deg, #ff9f0a, #ffb340); }
.met-ico.rojo { background: linear-gradient(135deg, #ff453a, #ff6961); }
.met-ico.azul { background: linear-gradient(135deg, #0a84ff, #409cff); }
.met-ico.morado { background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2)); }
.met-val { font-size: 20px; font-weight: 800; color: #15102b; letter-spacing: -0.02em; line-height: 1.1; }
.met-lbl { font-size: 11px; color: #6b6780; margin-top: 2px; }
</style>
