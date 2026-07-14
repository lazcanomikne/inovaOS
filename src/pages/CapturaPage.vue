<template>
  <f7-page name="captura">
    <f7-navbar large transparent>
      <f7-nav-title>Nuevo pendiente</f7-nav-title>
      <f7-nav-title-large>Capturar</f7-nav-title-large>
    </f7-navbar>

    <!-- Métodos de captura (paso 1) -->
    <div class="captura-metodos">
      <div class="glass metodo-card" :class="{ active: metodo === 'manual' }" @click="cambiarMetodo('manual')">
        <i class="f7-icons">pencil</i><span>Manual</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo === 'voz' }" @click="cambiarMetodo('voz')">
        <i class="f7-icons">mic_fill</i><span>Voz</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo === 'correo' }" @click="cambiarMetodo('correo')">
        <i class="f7-icons">envelope_fill</i><span>Correo</span>
      </div>
    </div>

    <!-- Dictado por voz -->
    <div v-if="metodo === 'voz'" class="block">
      <div class="glass voz-panel">
        <template v-if="soportado">
          <button
            type="button"
            class="mic-btn"
            :class="{ grabando: dictando }"
            @click="toggleDictado"
            :aria-label="dictando ? 'Detener dictado' : 'Iniciar dictado'"
          >
            <i class="f7-icons">{{ dictando ? 'stop_fill' : 'mic_fill' }}</i>
          </button>
          <div class="voz-estado">
            {{ dictando ? 'Escuchando… toca para detener' : 'Toca el micrófono y dicta el pendiente' }}
          </div>
          <div v-if="transcripcion || parcial" class="voz-texto">
            {{ transcripcion }}<span class="parcial"> {{ parcial }}</span>
          </div>
          <div v-if="detectado" class="voz-detectado">
            <i class="f7-icons">sparkles</i> Detectado: {{ detectado }}
          </div>
        </template>
        <div v-else class="voz-nosoporte">
          <i class="f7-icons">exclamationmark_triangle_fill</i>
          <div>
            <strong>Dictado no disponible</strong>
            <div class="voz-sub">Este navegador no soporta reconocimiento de voz. Escribe el pendiente abajo.</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Correo: aún no implementado, lo decimos claro -->
    <div v-if="metodo === 'correo'" class="block">
      <div class="glass voz-nosoporte">
        <i class="f7-icons">envelope_fill</i>
        <div>
          <strong>Captura desde correo</strong>
          <div class="voz-sub">Integración pendiente. Por ahora captura el pendiente a mano.</div>
        </div>
      </div>
    </div>

    <!-- Asignación rápida: para mí (tarea personal, cierre en un toque) -->
    <div class="para-mi-wrap">
      <button type="button" class="para-mi-btn" :class="{ active: esParaMi }" @click="toggleParaMi">
        <i class="f7-icons">{{ esParaMi ? 'checkmark_circle_fill' : 'person_crop_circle' }}</i>
        {{ esParaMi ? 'Es para mí' : 'Para mí' }}
      </button>
      <span v-if="esParaMi" class="para-mi-hint">Sin evidencia; la cierras en un toque.</span>
    </div>

    <!-- Delegación (paso 2) -->
    <div class="list glass-list no-hairlines-md form-list">
      <ul>
        <li class="item-content item-input">
          <div class="item-inner">
            <div class="item-title item-label">Pendiente</div>
            <div class="item-input-wrap">
              <input type="text" v-model="form.titulo" placeholder="¿Qué hay que hacer?" />
            </div>
          </div>
        </li>
        <li class="item-content item-input">
          <div class="item-inner">
            <div class="item-title item-label">Descripción</div>
            <div class="item-input-wrap">
              <textarea v-model="form.descripcion" placeholder="Detalles (opcional)"></textarea>
            </div>
          </div>
        </li>
        <li>
          <a class="item-link" @click="pickResponsable">
            <div class="item-content">
              <div class="item-inner">
                <div class="item-title">Responsable</div>
                <div class="item-after">{{ responsableNombre || 'Seleccionar' }}</div>
              </div>
            </div>
          </a>
        </li>
        <li class="item-content item-input fecha-li">
          <div class="item-inner">
            <div class="item-title item-label fecha-label"><i class="f7-icons">calendar</i> Fecha compromiso</div>
            <div class="item-input-wrap">
              <input ref="fechaInput" class="fecha-input" type="date" v-model="form.fecha_compromiso" :min="hoy" />
            </div>
          </div>
        </li>
        <li>
          <a class="item-link" @click="pickPrioridad">
            <div class="item-content">
              <div class="item-inner">
                <div class="item-title">Prioridad</div>
                <div class="item-after">
                  <span class="st-dot" :class="prioridadClase"></span> {{ form.prioridad }}
                </div>
              </div>
            </div>
          </a>
        </li>
        <li class="item-content item-input">
          <div class="item-inner">
            <div class="item-title item-label">Área</div>
            <div class="item-input-wrap">
              <input type="text" v-model="form.area" placeholder="Ventas, Compras..." />
            </div>
          </div>
        </li>
      </ul>
    </div>

    <div class="block">
      <f7-button large fill @click="delegar" :disabled="!form.titulo.trim() || saving">
        {{ saving ? 'Guardando…' : esParaMi ? 'Guardar para mí' : form.responsable_id ? 'Delegar' : 'Guardar sin asignar' }}
      </f7-button>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, setUsuarios, refrescar } from '@/js/store.js';
import { soportaDictado, crearDictado, interpretar, resumenInterpretacion } from '@/js/voz.js';

const metodo = ref('manual');
const saving = ref(false);
const hoy = new Date().toISOString().slice(0, 10);

/* ---------------- Dictado por voz ---------------- */
const soportado = soportaDictado();
const dictando = ref(false);
const transcripcion = ref('');
const parcial = ref('');
const detectado = ref('');
let sesion = null;

function cambiarMetodo(m) {
  if (metodo.value === 'voz' && m !== 'voz') pararDictado();
  metodo.value = m;
}

function pararDictado() {
  sesion?.detener();
  dictando.value = false;
  parcial.value = '';
}

function toggleDictado() {
  if (dictando.value) return pararDictado();

  transcripcion.value = '';
  parcial.value = '';
  detectado.value = '';

  sesion = crearDictado({
    onTexto: (final, interino) => {
      transcripcion.value = final;
      parcial.value = interino;
      if (final) form.value.titulo = final;
    },
    onError: (msg) => {
      dictando.value = false;
      parcial.value = '';
      f7.dialog.alert(msg, 'Dictado');
    },
    onFin: (final) => {
      dictando.value = false;
      parcial.value = '';
      aplicarDictado(final);
    },
  });
  sesion.iniciar();
  dictando.value = true;
}

// Lo dictado va al título; además deducimos prioridad y fecha si se mencionaron.
function aplicarDictado(texto) {
  if (!texto) return;
  form.value.titulo = texto;
  const det = interpretar(texto);
  if (det.prioridad) form.value.prioridad = det.prioridad;
  if (det.fecha_compromiso) form.value.fecha_compromiso = det.fecha_compromiso;
  detectado.value = resumenInterpretacion(det);
}

onUnmounted(pararDictado);

const form = ref({
  titulo: '',
  descripcion: '',
  responsable_id: null,
  fecha_compromiso: '',
  prioridad: 'Alta',
  area: '',
});

const esParaMi = computed(() => form.value.responsable_id === store.usuario?.id);

const responsableNombre = computed(() => {
  if (esParaMi.value) return 'Para mí';
  const u = store.usuarios.find((x) => x.id === form.value.responsable_id);
  return u ? u.nombre : '';
});

function toggleParaMi() {
  form.value.responsable_id = esParaMi.value ? null : store.usuario?.id;
}

const prioridadClase = computed(
  () => ({ Alta: 'st-vencido', Media: 'st-hoy', Baja: 'st-tiempo' }[form.value.prioridad])
);

async function cargarUsuarios() {
  if (store.usuarios.length) return;
  try {
    setUsuarios(await api.usuarios.list());
  } catch (e) {
    f7.toast.create({ text: 'No se pudo cargar usuarios', closeTimeout: 2000, position: 'center' }).open();
  }
}

async function pickResponsable() {
  // Si aún no llegaron, los esperamos antes de abrir (no dejamos el toque sin efecto).
  await cargarUsuarios();
  if (!store.usuarios.length) {
    f7.dialog.alert('No hay usuarios disponibles.', 'Responsable');
    return;
  }
  f7.dialog
    .create({
      title: 'Responsable',
      buttons: [
        { text: '⭐ Para mí', onClick: () => (form.value.responsable_id = store.usuario?.id) },
        { text: 'Sin asignar', onClick: () => (form.value.responsable_id = null) },
        ...store.usuarios.filter((u) => u.id !== store.usuario?.id).map((u) => ({
          text: u.nombre,
          onClick: () => (form.value.responsable_id = u.id),
        })),
        { text: 'Cancelar', color: 'gray' },
      ],
      verticalButtons: true,
    })
    .open();
}

function pickPrioridad() {
  f7.dialog
    .create({
      title: 'Prioridad',
      buttons: [
        ...['Alta', 'Media', 'Baja'].map((p) => ({ text: p, onClick: () => (form.value.prioridad = p) })),
        { text: 'Cancelar', color: 'gray' },
      ],
      verticalButtons: true,
    })
    .open();
}

const fechaInput = ref(null);
const hoyLegible = new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' });

function enfocarFecha() {
  const el = fechaInput.value;
  if (!el) return;
  el.focus();
  if (el.showPicker) { try { el.showPicker(); } catch (e) { /* requiere gesto; el focus basta */ } }
}

// La fecha de compromiso importa: si no la pusieron, la pedimos antes de guardar.
function delegar() {
  if (!form.value.titulo.trim() || saving.value) return;
  if (!form.value.fecha_compromiso) {
    f7.dialog
      .create({
        title: 'Fecha de compromiso',
        text: '¿Para cuándo debe estar listo este pendiente?',
        buttons: [
          { text: `Usar hoy (${hoyLegible})`, bold: true, onClick: () => { form.value.fecha_compromiso = hoy; guardar(); } },
          { text: 'Indicar otra fecha', onClick: () => enfocarFecha() },
          { text: 'Guardar sin fecha', color: 'gray', onClick: () => guardar() },
        ],
        verticalButtons: true,
      })
      .open();
    return;
  }
  guardar();
}

async function guardar() {
  saving.value = true;
  try {
    await api.pendientes.create({
      titulo: form.value.titulo.trim(),
      descripcion: form.value.descripcion.trim() || null,
      responsable_id: form.value.responsable_id,
      fecha_compromiso: form.value.fecha_compromiso || null,
      prioridad: form.value.prioridad,
      area: form.value.area.trim() || null,
      origen: metodo.value,
    });
    f7.toast.create({ text: 'Pendiente guardado ✓', closeTimeout: 2000, position: 'center' }).open();
    reset();
    refrescar(); // avisa a Home/Pendientes/Tablero que recarguen
    f7.tab.show('#view-pendientes');
  } catch (e) {
    f7.dialog.alert(e.message || 'No se pudo guardar.', 'Error');
  } finally {
    saving.value = false;
  }
}

function reset() {
  form.value = {
    titulo: '', descripcion: '', responsable_id: null,
    fecha_compromiso: '', prioridad: 'Alta', area: '',
  };
  pararDictado();
  transcripcion.value = '';
  detectado.value = '';
  metodo.value = 'manual';
}

onMounted(cargarUsuarios);
</script>

<style scoped>
.captura-metodos { display: flex; gap: 12px; padding: 8px 16px 4px; }
.metodo-card {
  flex: 1; border-radius: 16px; padding: 16px 8px;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  font-size: 13px; cursor: pointer; transition: all 0.15s ease;
}
.metodo-card i { font-size: 22px; }
.metodo-card.active {
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; border-color: transparent;
}
.form-list { margin-top: 8px; }

/* Atajo "Para mí" */
.para-mi-wrap { display: flex; align-items: center; gap: 10px; padding: 10px 16px 0; flex-wrap: wrap; }
.para-mi-btn {
  display: inline-flex; align-items: center; gap: 7px; border: 1.5px solid rgba(91, 91, 214, 0.35);
  background: rgba(91, 91, 214, 0.08); color: var(--inova-primary); border-radius: 999px;
  padding: 9px 16px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.15s ease;
}
.para-mi-btn i { font-size: 18px; }
.para-mi-btn:active { transform: scale(0.96); }
.para-mi-btn.active {
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; border-color: transparent; box-shadow: 0 6px 16px rgba(91, 91, 214, 0.35);
}
.para-mi-hint { font-size: 12px; color: #8a8699; }

/* Fecha de compromiso destacada (es importante) */
.fecha-label { display: inline-flex; align-items: center; gap: 6px; font-size: 15px !important; font-weight: 700 !important; color: #2a2540 !important; }
.fecha-label i { font-size: 17px; color: var(--inova-primary); }
.fecha-input {
  font-size: 19px !important; font-weight: 700 !important; color: var(--inova-primary) !important;
  width: 100%; height: 46px; padding: 6px 10px !important; border: 1.5px solid rgba(91, 91, 214, 0.3) !important;
  border-radius: 12px; background: rgba(91, 91, 214, 0.06); font-family: inherit;
}

/* ---- Panel de dictado ---- */
.voz-panel {
  border-radius: 20px; padding: 20px 16px;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.mic-btn {
  width: 76px; height: 76px; border-radius: 50%; border: none; cursor: pointer;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 22px rgba(91, 91, 214, 0.4);
  transition: transform 0.15s ease;
}
.mic-btn i { font-size: 32px; }
.mic-btn:active { transform: scale(0.93); }
.mic-btn.grabando {
  background: linear-gradient(135deg, #ff453a, #ff6b60);
  box-shadow: 0 8px 22px rgba(255, 69, 58, 0.45);
  animation: pulso 1.4s ease-out infinite;
}
@keyframes pulso {
  0% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0.5); }
  70% { box-shadow: 0 0 0 18px rgba(255, 69, 58, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 69, 58, 0); }
}
.voz-estado { font-size: 13px; opacity: 0.7; text-align: center; }
.voz-texto {
  width: 100%; font-size: 15px; line-height: 1.4; text-align: center;
  background: rgba(255, 255, 255, 0.5); border-radius: 14px; padding: 10px 12px;
}
.voz-texto .parcial { opacity: 0.45; font-style: italic; }
.voz-detectado {
  font-size: 13px; font-weight: 600; color: var(--inova-primary);
  display: flex; align-items: center; gap: 6px;
}
.voz-detectado i { font-size: 15px; }
.voz-nosoporte {
  border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center;
}
.voz-nosoporte i { font-size: 26px; color: var(--st-hoy); }
.voz-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
