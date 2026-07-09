<template>
  <f7-page name="captura">
    <f7-navbar large transparent>
      <f7-nav-title>Nuevo pendiente</f7-nav-title>
      <f7-nav-title-large>Capturar</f7-nav-title-large>
    </f7-navbar>

    <!-- Métodos de captura (paso 1 del diagrama) -->
    <div class="captura-metodos">
      <div class="glass metodo-card" :class="{ active: metodo==='manual' }" @click="metodo='manual'">
        <i class="f7-icons">pencil</i><span>Manual</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo==='voz' }" @click="metodo='voz'">
        <i class="f7-icons">mic_fill</i><span>Voz</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo==='correo' }" @click="metodo='correo'">
        <i class="f7-icons">envelope_fill</i><span>Correo</span>
      </div>
    </div>

    <!-- Formulario de delegación (pasos 1-2) -->
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
          <a class="item-link smart-select" @click="pickResponsable">
            <div class="item-content">
              <div class="item-inner">
                <div class="item-title">Responsable</div>
                <div class="item-after">{{ form.responsable_nombre || 'Seleccionar' }}</div>
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
                  <span class="st-dot" :class="prioridadClase"></span>
                  {{ form.prioridad }}
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
      <f7-button large fill @click="delegar" :disabled="!form.titulo || saving">
        {{ saving ? 'Delegando…' : 'Delegar' }}
      </f7-button>
    </div>
    <div style="height: 90px"></div>
  </f7-page>
</template>

<script setup>
import { ref, computed, getCurrentInstance } from 'vue';
import { api } from '@/js/api.js';

const { proxy } = getCurrentInstance();
const $f7 = proxy.$f7;

const metodo = ref('manual');
const saving = ref(false);
const form = ref({
  titulo: '',
  descripcion: '',
  responsable_id: null,
  responsable_nombre: '',
  fecha_compromiso: '',
  prioridad: 'Alta',
  area: '',
});

const prioridadClase = computed(() => {
  return { Alta: 'st-vencido', Media: 'st-hoy', Baja: 'st-tiempo' }[form.value.prioridad] || 'st-tiempo';
});

function pickResponsable() {
  $f7.dialog.create({
    title: 'Responsable',
    buttons: [
      { text: 'Carlos Narváez', onClick: () => set('Carlos Narváez', 2) },
      { text: 'Ana López', onClick: () => set('Ana López', 3) },
      { text: 'Cancelar', color: 'gray' },
    ],
    verticalButtons: true,
  }).open();
  function set(nombre, id) {
    form.value.responsable_nombre = nombre;
    form.value.responsable_id = id;
  }
}

function pickPrioridad() {
  $f7.dialog.create({
    title: 'Prioridad',
    buttons: [
      { text: 'Alta', onClick: () => (form.value.prioridad = 'Alta') },
      { text: 'Media', onClick: () => (form.value.prioridad = 'Media') },
      { text: 'Baja', onClick: () => (form.value.prioridad = 'Baja') },
      { text: 'Cancelar', color: 'gray' },
    ],
    verticalButtons: true,
  }).open();
}

async function delegar() {
  saving.value = true;
  try {
    await api.pendientes.create({
      titulo: form.value.titulo,
      descripcion: form.value.descripcion,
      responsable_id: form.value.responsable_id,
      fecha_compromiso: form.value.fecha_compromiso || null,
      prioridad: form.value.prioridad,
      area: form.value.area,
      origen: metodo.value,
    });
    $f7.toast.create({ text: 'Pendiente delegado ✓', closeTimeout: 2000, position: 'center' }).open();
    reset();
    $f7.tab.show('#view-pendientes');
  } catch (e) {
    $f7.dialog.alert(e.message || 'No se pudo guardar. Revisa el API/D1.', 'Error');
  } finally {
    saving.value = false;
  }
}

function reset() {
  form.value = { titulo: '', descripcion: '', responsable_id: null, responsable_nombre: '', fecha_compromiso: '', prioridad: 'Alta', area: '' };
  metodo.value = 'manual';
}
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
</style>
