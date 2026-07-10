<template>
  <f7-page name="editar-pendiente">
    <f7-navbar transparent back-link="Cancelar">
      <f7-nav-title>Editar</f7-nav-title>
      <f7-nav-right>
        <f7-link :class="{ disabled: !puedeGuardar }" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar' }}
        </f7-link>
      </f7-nav-right>
    </f7-navbar>

    <div v-if="loading" class="block text-align-center"><f7-preloader /></div>

    <div v-else-if="error" class="block">
      <div class="glass error-card">
        <i class="f7-icons">exclamationmark_triangle_fill</i>
        <div><strong>No se pudo cargar</strong><div class="error-sub">{{ error }}</div></div>
      </div>
    </div>

    <template v-else>
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
                  <div class="item-after">{{ responsableNombre || 'Sin asignar' }}</div>
                </div>
              </div>
            </a>
          </li>
          <li class="item-content item-input">
            <div class="item-inner">
              <div class="item-title item-label">Fecha compromiso</div>
              <div class="item-input-wrap">
                <input type="date" v-model="form.fecha_compromiso" />
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
        <f7-button large fill :disabled="!puedeGuardar" @click="guardar">
          {{ guardando ? 'Guardando…' : 'Guardar cambios' }}
        </f7-button>
        <div v-if="!hayCambios && form.titulo.trim()" class="hint">Sin cambios que guardar.</div>
      </div>
    </template>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, setUsuarios, refrescar } from '@/js/store.js';

const props = defineProps({ f7route: Object, f7router: Object });
const id = props.f7route.params.id;

const loading = ref(true);
const guardando = ref(false);
const error = ref('');
const original = ref(null);

const form = ref({
  titulo: '', descripcion: '', responsable_id: null,
  fecha_compromiso: '', prioridad: 'Media', area: '',
});

const responsableNombre = computed(() => store.usuarios.find((u) => u.id === form.value.responsable_id)?.nombre ?? '');
const prioridadClase = computed(() => ({ Alta: 'st-vencido', Media: 'st-hoy', Baja: 'st-tiempo' }[form.value.prioridad]));

// Sólo enviamos los campos que realmente cambiaron.
const cambios = computed(() => {
  if (!original.value) return {};
  const dif = {};
  for (const k of ['titulo', 'descripcion', 'responsable_id', 'fecha_compromiso', 'prioridad', 'area']) {
    const nuevo = form.value[k] === '' ? null : form.value[k];
    const viejo = original.value[k] ?? null;
    if (nuevo !== viejo) dif[k] = nuevo;
  }
  return dif;
});
const hayCambios = computed(() => Object.keys(cambios.value).length > 0);
const puedeGuardar = computed(() => !!form.value.titulo.trim() && hayCambios.value && !guardando.value);

async function cargar() {
  loading.value = true;
  try {
    const [{ pendiente }, usuarios] = await Promise.all([
      api.pendientes.get(id),
      store.usuarios.length ? Promise.resolve(store.usuarios) : api.usuarios.list(),
    ]);
    if (!store.usuarios.length) setUsuarios(usuarios);
    original.value = {
      titulo: pendiente.titulo,
      descripcion: pendiente.descripcion,
      responsable_id: pendiente.responsable_id,
      fecha_compromiso: pendiente.fecha_compromiso,
      prioridad: pendiente.prioridad,
      area: pendiente.area,
    };
    form.value = {
      titulo: pendiente.titulo ?? '',
      descripcion: pendiente.descripcion ?? '',
      responsable_id: pendiente.responsable_id,
      fecha_compromiso: pendiente.fecha_compromiso ?? '',
      prioridad: pendiente.prioridad ?? 'Media',
      area: pendiente.area ?? '',
    };
  } catch (e) {
    error.value = e.message || 'Error de red';
  } finally {
    loading.value = false;
  }
}

function pickResponsable() {
  f7.dialog.create({
    title: 'Responsable',
    buttons: [
      { text: 'Sin asignar', onClick: () => (form.value.responsable_id = null) },
      ...store.usuarios.map((u) => ({ text: u.nombre, onClick: () => (form.value.responsable_id = u.id) })),
      { text: 'Cancelar', color: 'gray' },
    ],
    verticalButtons: true,
  }).open();
}

function pickPrioridad() {
  f7.dialog.create({
    title: 'Prioridad',
    buttons: [
      ...['Alta', 'Media', 'Baja'].map((p) => ({ text: p, onClick: () => (form.value.prioridad = p) })),
      { text: 'Cancelar', color: 'gray' },
    ],
    verticalButtons: true,
  }).open();
}

async function guardar() {
  if (!puedeGuardar.value) return;
  guardando.value = true;
  try {
    await api.pendientes.update(id, cambios.value); // el autor lo pone el servidor
    refrescar();
    f7.toast.create({ text: 'Cambios guardados ✓', closeTimeout: 1800, position: 'center' }).open();
    props.f7router.back();
  } catch (e) {
    f7.dialog.alert(e.message || 'No se pudo guardar.', 'Error');
  } finally {
    guardando.value = false;
  }
}

onMounted(cargar);
</script>

<style scoped>
.form-list { margin-top: 8px; }
.hint { text-align: center; font-size: 13px; opacity: 0.5; margin-top: 10px; }
.error-card { border-radius: 18px; padding: 16px; display: flex; gap: 12px; align-items: center; }
.error-card i { font-size: 28px; color: var(--st-vencido); }
.error-sub { font-size: 13px; opacity: 0.7; margin-top: 2px; }
</style>
