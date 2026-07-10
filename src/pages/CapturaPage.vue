<template>
  <f7-page name="captura">
    <f7-navbar large transparent>
      <f7-nav-title>Nuevo pendiente</f7-nav-title>
      <f7-nav-title-large>Capturar</f7-nav-title-large>
    </f7-navbar>

    <!-- Métodos de captura (paso 1) -->
    <div class="captura-metodos">
      <div class="glass metodo-card" :class="{ active: metodo === 'manual' }" @click="metodo = 'manual'">
        <i class="f7-icons">pencil</i><span>Manual</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo === 'voz' }" @click="metodo = 'voz'">
        <i class="f7-icons">mic_fill</i><span>Voz</span>
      </div>
      <div class="glass metodo-card" :class="{ active: metodo === 'correo' }" @click="metodo = 'correo'">
        <i class="f7-icons">envelope_fill</i><span>Correo</span>
      </div>
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
        <li class="item-content item-input">
          <div class="item-inner">
            <div class="item-title item-label">Fecha compromiso</div>
            <div class="item-input-wrap">
              <input type="date" v-model="form.fecha_compromiso" :min="hoy" />
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
        {{ saving ? 'Delegando…' : form.responsable_id ? 'Delegar' : 'Guardar sin asignar' }}
      </f7-button>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, setUsuarios, refrescar } from '@/js/store.js';

const metodo = ref('manual');
const saving = ref(false);
const hoy = new Date().toISOString().slice(0, 10);

const form = ref({
  titulo: '',
  descripcion: '',
  responsable_id: null,
  fecha_compromiso: '',
  prioridad: 'Alta',
  area: '',
});

const responsableNombre = computed(() => {
  const u = store.usuarios.find((x) => x.id === form.value.responsable_id);
  return u ? u.nombre : '';
});

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
        { text: 'Sin asignar', onClick: () => (form.value.responsable_id = null) },
        ...store.usuarios.map((u) => ({
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

async function delegar() {
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
      creado_por: store.usuario.id,
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
</style>
