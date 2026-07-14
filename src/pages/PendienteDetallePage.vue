<template>
  <f7-page name="pendiente-detalle">
    <f7-navbar transparent back-link="Atrás">
      <f7-nav-title>Detalle</f7-nav-title>
      <f7-nav-right v-if="p && puedeEditar(p, store.usuario)">
        <f7-link icon-f7="square_pencil" @click="editar" />
      </f7-nav-right>
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
              <div v-if="p.creador_nombre" class="det-creador">
                <i class="f7-icons">person_crop_circle</i> Delegado por {{ p.creador_nombre }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Acciones del flujo, según el rol de quien mira (pasos 2-6) -->
      <div class="block acciones">
        <f7-button
          v-for="a in acciones"
          :key="a.id"
          large
          :fill="!!a.fill"
          :class="{ 'glass-btn': !a.fill }"
          :color="a.color || undefined"
          :disabled="guardando"
          @click="ejecutar(a)"
        >
          {{ guardando ? 'Guardando…' : a.texto }}
        </f7-button>

        <div v-if="!acciones.length" class="sin-acciones glass">
          <i class="f7-icons">clock</i>
          <span>{{ motivoSinAcciones(p, store.usuario) }}</span>
        </div>
      </div>

      <!-- Checklist (paso 4) -->
      <div class="block-title">
        Checklist
        <span v-if="checklist.length" class="check-progreso">{{ hechos }}/{{ checklist.length }}</span>
      </div>
      <div class="list glass-list no-hairlines checklist-list">
        <ul>
          <li v-for="item in checklist" :key="item.id">
            <!-- Modo edición -->
            <div v-if="editandoId === item.id" class="chk-edit">
              <input class="chk-edit-input" type="text" v-model="editTexto"
                     @input="onInput('edit', $event.target.value)"
                     @keyup.enter="guardarEdicion(item)" placeholder="Editar paso… (usa @ para etiquetar)" />
              <div v-if="editAsignado" class="chk-chip">@{{ nombrePorId(editAsignado) }}
                <span class="chk-x" @click="editAsignado = null">✕</span></div>
              <div v-if="mencionCtx === 'edit' && sugerencias.length" class="chk-menciones">
                <button v-for="u in sugerencias" :key="u.id" type="button" class="chk-mencion" @click="elegirMencion(u)">
                  <span class="chk-ini">{{ inicial(u.nombre) }}</span> {{ u.nombre }}
                </button>
              </div>
              <div class="chk-edit-actions">
                <button type="button" class="chk-btn cancel" @click="cancelarEdicion">Cancelar</button>
                <button type="button" class="chk-btn save" @click="guardarEdicion(item)">Guardar</button>
              </div>
            </div>

            <!-- Modo lectura -->
            <div v-else class="chk-item item-content">
              <label class="chk-check">
                <input type="checkbox" :checked="!!item.completado" :disabled="!puedeToggle(item)"
                       @change="toggleItem(item, $event.target.checked)" />
                <i class="icon icon-checkbox"></i>
              </label>
              <div class="chk-body">
                <div class="item-title" :class="{ tachado: item.completado }">{{ item.texto }}</div>
                <span v-if="item.asignado_nombre" class="chk-tag"><i class="f7-icons">at</i>{{ item.asignado_nombre }}</span>
              </div>
              <div v-if="puedeEditarChecklist" class="chk-row-actions">
                <button type="button" class="chk-mini" @click="empezarEdicion(item)"><i class="f7-icons">pencil</i></button>
                <button type="button" class="chk-mini" @click="borrarItem(item)"><i class="f7-icons">trash</i></button>
              </div>
            </div>
          </li>

          <!-- Añadir -->
          <li v-if="puedeEditarChecklist" class="item-content item-input chk-add-li">
            <div class="chk-add">
              <input type="text" v-model="nuevoItem" placeholder="Añadir paso… (usa @ para etiquetar)"
                     @input="onInput('nuevo', $event.target.value)" @keyup.enter="agregarItem" />
              <span v-if="nuevoAsignado" class="chk-chip">@{{ nombrePorId(nuevoAsignado) }}
                <span class="chk-x" @click="nuevoAsignado = null">✕</span></span>
              <div v-if="mencionCtx === 'nuevo' && sugerencias.length" class="chk-menciones">
                <button v-for="u in sugerencias" :key="u.id" type="button" class="chk-mencion" @click="elegirMencion(u)">
                  <span class="chk-ini">{{ inicial(u.nombre) }}</span> {{ u.nombre }}
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- Evidencias (pasos 5-6): obligatorias para concluir -->
      <div class="block-title">
        Evidencias
        <span v-if="evidencias.length" class="check-progreso">{{ evidencias.length }}</span>
      </div>
      <div class="block no-padding-top">
        <div v-if="!evidencias.length && !subiendo" class="glass evid-vacio">
          <i class="f7-icons">paperclip</i>
          <span>Sin evidencias. Adjunta archivos (imágenes o PDF) para poder concluir.</span>
        </div>

        <div v-if="evidencias.length" class="evid-grid">
          <div v-for="e in evidencias" :key="e.id" class="glass evid-item">
            <a :href="e.url" target="_blank" rel="noopener" class="evid-abrir">
              <img v-if="esImagen(e)" :src="e.url" :alt="e.nombre" class="evid-thumb" />
              <div v-else class="evid-thumb evid-pdf"><i class="f7-icons">doc_text_fill</i></div>
            </a>
            <div class="evid-meta">
              <div class="evid-nombre">{{ e.nombre }}</div>
              <div class="evid-sub">{{ tamanoLegible(e.tamano) }}<span v-if="e.autor"> · {{ e.autor }}</span></div>
            </div>
            <button v-if="p && puedeVer(p, store.usuario)" type="button" class="evid-del" @click="quitarEvidencia(e)">
              <i class="f7-icons">trash</i>
            </button>
          </div>
        </div>

        <input ref="fileInput" type="file" accept="image/*,application/pdf" class="oculto" @change="onArchivo" />
        <f7-button class="glass-btn margin-top" :disabled="subiendo" @click="elegirArchivo">
          <i class="f7-icons" style="font-size:18px;margin-right:6px;">paperclip</i>
          {{ subiendo ? 'Subiendo…' : 'Adjuntar evidencia' }}
        </f7-button>
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

      <!-- Sólo el creador (o dirección) puede eliminar -->
      <div v-if="puedeEliminar(p, store.usuario)" class="block">
        <f7-button class="glass-btn" color="red" @click="eliminar">Eliminar pendiente</f7-button>
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, refrescar } from '@/js/store.js';
import {
  estatusColor, etiquetaEstatus, formatFecha, horaLocal,
  accionesDisponibles, motivoSinAcciones, puedeEditar, puedeEliminar, puedeVer,
} from '@/js/pendientes.js';
import { subirEvidencia, validarArchivo, esImagen, tamanoLegible } from '@/js/evidencias.js';
import { celebrar } from '@/js/celebracion.js';

const props = defineProps({ f7route: Object, f7router: Object });
const id = props.f7route.params.id;

const loading = ref(true);
const guardando = ref(false);
const error = ref('');
const p = ref(null);
const historial = ref([]);
const checklist = ref([]);
const evidencias = ref([]);
const nuevoItem = ref('');
const usuarios = ref([]);
const nuevoAsignado = ref(null);
const editandoId = ref(null);
const editTexto = ref('');
const editAsignado = ref(null);
const mencionCtx = ref(null); // 'nuevo' | 'edit' | null
const mencionQuery = ref('');
const subiendo = ref(false);
const fileInput = ref(null);
const eliminado = ref(false); // evita recargar un pendiente ya borrado

const acciones = computed(() => accionesDisponibles(p.value, store.usuario));
const hechos = computed(() => checklist.value.filter((i) => i.completado).length);
const hoy = new Date().toISOString().slice(0, 10);

// Sólo el creador o el responsable editan el checklist; el etiquetado sólo
// puede marcar SU paso como completado.
const puedeEditarChecklist = computed(() => {
  const u = store.usuario, pp = p.value;
  if (!u || !pp) return false;
  return Number(pp.creado_por) === Number(u.id) || Number(pp.responsable_id) === Number(u.id);
});
function puedeToggle(item) {
  return puedeEditarChecklist.value || Number(item.asignado_a) === Number(store.usuario?.id);
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const inicial = (n) => (n || '?').trim().charAt(0).toUpperCase();
const nombrePorId = (id) => usuarios.value.find((u) => Number(u.id) === Number(id))?.nombre || '';

// Sugerencias de @mención (excluye a uno mismo).
const sugerencias = computed(() => {
  if (!mencionCtx.value) return [];
  const q = norm(mencionQuery.value);
  const yo = Number(store.usuario?.id);
  return usuarios.value.filter((u) => Number(u.id) !== yo && norm(u.nombre).includes(q)).slice(0, 6);
});

// Detecta un "@palabra" al final del texto para abrir el selector.
function onInput(ctx, valor) {
  const m = valor.match(/@([\p{L}]*)$/u);
  if (m) { mencionCtx.value = ctx; mencionQuery.value = m[1]; }
  else { mencionCtx.value = null; mencionQuery.value = ''; }
}
function elegirMencion(u) {
  const limpiar = (t) => t.replace(/@[\p{L}]*$/u, '').replace(/\s+$/, '');
  if (mencionCtx.value === 'nuevo') { nuevoItem.value = limpiar(nuevoItem.value); nuevoAsignado.value = u.id; }
  else { editTexto.value = limpiar(editTexto.value); editAsignado.value = u.id; }
  mencionCtx.value = null; mencionQuery.value = '';
}

function empezarEdicion(item) {
  editandoId.value = item.id;
  editTexto.value = item.texto;
  editAsignado.value = item.asignado_a || null;
  mencionCtx.value = null;
}
function cancelarEdicion() {
  editandoId.value = null;
  mencionCtx.value = null;
}
async function guardarEdicion(item) {
  const texto = editTexto.value.trim();
  if (!texto) return;
  try {
    const upd = await api.checklist.update(item.id, { texto, asignado_a: editAsignado.value });
    Object.assign(item, upd);
    cancelarEdicion();
  } catch (e) {
    f7.toast.create({ text: e.message || 'No se pudo guardar', closeTimeout: 1800, position: 'center' }).open();
  }
}
function borrarItem(item) {
  f7.dialog.confirm('¿Borrar este paso del checklist?', async () => {
    try {
      await api.checklist.remove(item.id);
      checklist.value = checklist.value.filter((i) => i.id !== item.id);
    } catch (e) {
      f7.toast.create({ text: 'No se pudo borrar', closeTimeout: 1800, position: 'center' }).open();
    }
  });
}

async function cargar() {
  if (eliminado.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await api.pendientes.get(id);
    p.value = data.pendiente;
    historial.value = data.historial ?? [];
    checklist.value = data.checklist ?? [];
    evidencias.value = data.evidencias ?? [];
    if (!usuarios.value.length) usuarios.value = await api.usuarios.list().catch(() => []);
  } catch (e) {
    error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}

// Enruta cada acción a su comportamiento
function ejecutar(a) {
  if (a.tipo === 'editar') return editar();
  if (a.tipo === 'reagendar') return abrirReagendar();
  if (a.id === 'aprobar') return aprobar();
  if (a.id === 'devolver') return devolver();
  // Paso 5: no se concluye sin evidencia (el servidor también lo exige).
  if (a.estatus === 'concluido' && !evidencias.value.length) {
    return f7.dialog.alert('Adjunta al menos una evidencia antes de concluir.', 'Falta evidencia');
  }
  return patch({ estatus: a.estatus });
}

function editar() {
  props.f7router.navigate(`/pendientes/${id}/editar/`);
}

async function patch(cambios) {
  guardando.value = true;
  try {
    await api.pendientes.update(id, cambios); // el autor lo pone el servidor
    // refrescar() dispara el watch de store.tick, que recarga esta página
    // (historial + estatus) y también Inicio/Lista/Tablero. Una sola petición.
    refrescar();
    if (cambios.estatus === 'concluido' || cambios.estatus === 'aprobado') {
      // ¡Se cerró! Confeti, "ka-ching" y "¡Excelente!".
      celebrar('¡Excelente!');
    } else if (cambios.estatus) {
      f7.toast.create({ text: `Estatus: ${etiquetaEstatus(cambios.estatus)}`, closeTimeout: 1800, position: 'center' }).open();
    }
  } catch (e) {
    f7.dialog.alert(e.message || 'No se pudo actualizar.', 'Error');
  } finally {
    guardando.value = false;
  }
}

// Paso 3: el responsable propone otra fecha compromiso.
function abrirReagendar() {
  const actual = p.value.fecha_compromiso || hoy;
  const dlg = f7.dialog.create({
    title: 'Reagendar',
    text: 'Elige la nueva fecha compromiso:',
    content: `<div class="dialog-input-field input"><input type="date" class="dialog-input" value="${actual}" min="${hoy}"></div>`,
    buttons: [
      { text: 'Cancelar', color: 'gray' },
      {
        text: 'Guardar',
        bold: true,
        onClick: (dialog) => {
          const nueva = dialog.$el.find('input.dialog-input').val();
          if (!nueva) return;
          patch({ estatus: 'reagendado', fecha_compromiso: nueva, detalle: `nueva fecha: ${nueva}` });
        },
      },
    ],
  });
  dlg.open();
}

// Paso 6: quien delegó aprueba, con comentario opcional.
function aprobar() {
  f7.dialog.prompt('Comentario (opcional)', 'Aprobar pendiente', (comentario) => {
    const cambios = { estatus: 'aprobado' };
    if (comentario?.trim()) cambios.comentario_cierre = comentario.trim();
    patch(cambios);
  });
}

// Devolver a revisión: pide el motivo para que quede en el historial.
function devolver() {
  f7.dialog.prompt('¿Qué falta corregir?', 'Devolver a revisión', (motivo) => {
    if (!motivo?.trim()) return;
    patch({ estatus: 'en_progreso', detalle: `devuelto: ${motivo.trim()}` });
  });
}

/* -------------------- Evidencias -------------------- */
function elegirArchivo() { fileInput.value?.click(); }

async function onArchivo(e) {
  const file = e.target.files?.[0];
  e.target.value = ''; // permite re-elegir el mismo archivo
  if (!file) return;
  const err = validarArchivo(file);
  if (err) return f7.dialog.alert(err, 'Evidencia');
  subiendo.value = true;
  try {
    const ev = await subirEvidencia(Number(id), file);
    evidencias.value.unshift(ev);
    refrescar(); // el historial cambió
    f7.toast.create({ text: 'Evidencia adjunta ✓', closeTimeout: 1600, position: 'center' }).open();
  } catch (e2) {
    f7.dialog.alert(e2.message || 'No se pudo subir el archivo.', 'Evidencia');
  } finally {
    subiendo.value = false;
  }
}

function quitarEvidencia(ev) {
  f7.dialog.confirm(`¿Quitar «${ev.nombre}»?`, 'Evidencia', async () => {
    try {
      await api.evidencias.remove(ev.id);
      evidencias.value = evidencias.value.filter((x) => x.id !== ev.id);
      refrescar();
    } catch (e) {
      f7.dialog.alert(e.message || 'No se pudo quitar.', 'Error');
    }
  });
}

function eliminar() {
  f7.dialog.confirm(
    `Se eliminará «${p.value.titulo}» con su historial y checklist. Esta acción no se puede deshacer.`,
    'Eliminar pendiente',
    async () => {
      try {
        eliminado.value = true; // el watch ya no intentará recargarlo
        await api.pendientes.remove(id);
        f7.toast.create({ text: 'Pendiente eliminado', closeTimeout: 1800, position: 'center' }).open();
        props.f7router.back();
        refrescar();
      } catch (e) {
        eliminado.value = false;
        f7.dialog.alert(e.message || 'No se pudo eliminar.', 'Error');
      }
    }
  );
}

async function agregarItem() {
  const texto = nuevoItem.value.trim();
  if (!texto) return;
  const asignado = nuevoAsignado.value;
  nuevoItem.value = '';
  nuevoAsignado.value = null;
  mencionCtx.value = null;
  try {
    const item = await api.checklist.create({ pendiente_id: Number(id), texto, orden: checklist.value.length, asignado_a: asignado });
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
// Al volver de "Editar" (o si otra pantalla cambia datos) esta página sigue
// montada en el stack: recargamos para no mostrar información vieja.
watch(() => store.tick, cargar);
</script>

<style scoped>
.det-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.det-titulo { margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.det-desc { margin: 0 0 14px; opacity: 0.75; }
.det-meta { display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
.det-meta i { font-size: 17px; margin-right: 8px; color: var(--inova-primary); vertical-align: -2px; }
.det-creador { opacity: 0.65; font-size: 13px; }
.acciones { display: flex; flex-direction: column; gap: 10px; }
.sin-acciones {
  border-radius: 16px; padding: 14px; display: flex; align-items: center; gap: 10px;
  font-size: 14px; opacity: 0.8;
}
.sin-acciones i { font-size: 20px; color: var(--inova-primary); }
.timeline-item-content.glass {
  border-radius: 14px;
  padding: 10px 14px;
  flex: 1;
}
.timeline-item-title { font-size: 15px; font-weight: 700; line-height: 1.25; }
.timeline-item-subtitle { font-size: 13px; opacity: 0.6; line-height: 1.35; margin-top: 1px; }
.tachado { text-decoration: line-through; opacity: 0.5; }
.check-progreso { float: right; font-size: 13px; font-weight: 700; color: var(--inova-primary); }

/* Checklist mejorado */
.chk-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; }
.chk-check { display: flex; align-items: center; position: relative; }
.chk-check input { position: absolute; opacity: 0; width: 22px; height: 22px; }
.chk-check input:disabled ~ .icon-checkbox { opacity: 0.4; }
.chk-body { flex: 1 1 auto; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.chk-body .item-title { flex: 0 1 auto; }
.tachado { text-decoration: line-through; color: #a5a1b5; }
.chk-tag {
  display: inline-flex; align-items: center; gap: 1px; font-size: 12px; font-weight: 700;
  color: var(--inova-primary); background: rgba(91, 91, 214, 0.1); border-radius: 8px; padding: 2px 8px 2px 5px;
}
.chk-tag i { font-size: 13px; }
.chk-row-actions { flex: 0 0 auto; display: flex; gap: 2px; }
.chk-mini {
  width: 30px; height: 30px; border: none; background: transparent; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; cursor: pointer; color: #8a8699;
}
.chk-mini i { font-size: 17px; }
.chk-mini:active { background: rgba(0, 0, 0, 0.05); }

.chk-edit { padding: 12px 14px; }
.chk-edit-input, .chk-add input {
  width: 100%; border: none; background: rgba(120, 120, 128, 0.1); border-radius: 12px;
  padding: 10px 12px; font-size: 15px; outline: none; color: #1f1a33; font-family: inherit;
}
.chk-edit-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.chk-btn { border: none; border-radius: 12px; padding: 8px 16px; font-size: 14px; font-weight: 700; cursor: pointer; }
.chk-btn.cancel { background: rgba(120, 120, 128, 0.14); color: #4a4560; }
.chk-btn.save { background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2)); color: #fff; }

.chk-add-li { display: block; }
.chk-add { position: relative; padding: 4px 0; }
.chk-chip {
  display: inline-flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 13px; font-weight: 700;
  color: var(--inova-primary); background: rgba(91, 91, 214, 0.12); border-radius: 10px; padding: 5px 10px;
}
.chk-x { cursor: pointer; font-size: 12px; opacity: 0.7; }

.chk-menciones {
  margin-top: 6px; background: #fff; border-radius: 14px; overflow: hidden;
  box-shadow: 0 8px 24px rgba(17, 12, 46, 0.16); border: 1px solid rgba(0, 0, 0, 0.05);
}
.chk-mencion {
  display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: none;
  background: transparent; padding: 10px 12px; font-size: 14px; color: #1f1a33; cursor: pointer;
}
.chk-mencion:not(:last-child) { border-bottom: 1px solid rgba(0, 0, 0, 0.05); }
.chk-mencion:active { background: rgba(91, 91, 214, 0.08); }
.chk-ini {
  width: 26px; height: 26px; border-radius: 50%; flex: 0 0 auto; font-size: 12px; font-weight: 700; color: #fff;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
}

.no-padding-top { padding-top: 0; }
.oculto { display: none; }
.evid-vacio {
  border-radius: 16px; padding: 14px; display: flex; gap: 10px; align-items: center;
  font-size: 13px; opacity: 0.8;
}
.evid-vacio i { font-size: 20px; color: var(--st-hoy); flex-shrink: 0; }
.evid-grid { display: flex; flex-direction: column; gap: 10px; }
.evid-item { border-radius: 14px; padding: 8px; display: flex; align-items: center; gap: 12px; }
.evid-abrir { flex: 0 0 auto; }
.evid-thumb {
  width: 52px; height: 52px; border-radius: 10px; object-fit: cover; display: block; background: rgba(0,0,0,0.05);
}
.evid-pdf { display: flex; align-items: center; justify-content: center; }
.evid-pdf i { font-size: 26px; color: var(--st-vencido); }
.evid-meta { flex: 1 1 auto; min-width: 0; }
.evid-nombre { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.evid-sub { font-size: 12px; opacity: 0.55; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.evid-del {
  flex: 0 0 auto; width: 40px; height: 40px; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; cursor: pointer;
  color: var(--st-vencido); opacity: 0.7;
}
.evid-del i { font-size: 20px; }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
