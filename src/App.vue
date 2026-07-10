<template>
  <f7-app v-bind="f7params">
    <f7-views tabs class="safe-areas">
      <!-- Cada tab es un stack de navegación independiente -->
      <f7-view id="view-home" main tab tab-active url="/" />
      <f7-view id="view-pendientes" tab url="/pendientes/" />
      <f7-view id="view-captura" tab url="/captura/" />
      <f7-view id="view-tablero" tab url="/tablero/" />
      <f7-view id="view-perfil" tab url="/perfil/" />
    </f7-views>

    <!-- Pastilla flotante (glass) — teletransportada a <body> para que
         quede fija sobre todo el contenido y no la recorte ningún contenedor. -->
    <Teleport to="body">
      <nav class="floating-nav">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="fnav-item"
          :class="{ active: active === t.id, create: t.id === 'captura' }"
          @click="show(t.id)"
        >
          <i class="f7-icons">{{ t.icon }}</i>
          <span>{{ t.label }}</span>
        </button>
      </nav>
    </Teleport>
  </f7-app>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { f7, f7ready } from 'framework7-vue';
import routes from '@/js/routes.js';

const f7params = reactive({
  name: 'INOVATECH OS',
  theme: 'ios',
  darkMode: false, // Modo claro por defecto
  colors: { primary: '#5b5bd6' },
  routes,
  view: { iosDynamicNavbar: true, pushState: false },
  touch: { tapHold: true },
});

const tabs = [
  { id: 'home', label: 'Inicio', icon: 'house_fill' },
  { id: 'pendientes', label: 'Pendientes', icon: 'square_list_fill' },
  { id: 'captura', label: 'Crear', icon: 'plus' },
  { id: 'tablero', label: 'Tablero', icon: 'chart_pie_fill' },
  { id: 'perfil', label: 'Perfil', icon: 'person_fill' },
];

const active = ref('home');

function show(id) {
  f7.tab.show(`#view-${id}`);
}

// Mantiene el resaltado de la pastilla sincronizado, incluso cuando otra
// pantalla cambia de tab por código (p. ej. al guardar un pendiente).
onMounted(() => {
  f7ready(() => {
    f7.on('tabShow', (tabEl) => {
      const id = tabEl?.id?.replace('view-', '');
      if (id) active.value = id;
    });
  });
});
</script>
