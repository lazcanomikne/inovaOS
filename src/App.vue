<template>
  <f7-app v-bind="f7params">
    <!-- Mientras preguntamos al servidor si hay sesión, no parpadeamos el login -->
    <div v-if="store.comprobandoSesion" class="arranque">
      <f7-preloader size="32" />
    </div>

    <LoginPage v-else-if="!store.autenticado" />

    <template v-else>
      <f7-views tabs class="safe-areas">
        <f7-view id="view-home" main tab tab-active url="/" />
        <f7-view id="view-pendientes" tab url="/pendientes/" />
        <f7-view id="view-metricas" tab url="/metricas/" />
        <f7-view id="view-captura" tab url="/captura/" />
        <f7-view id="view-tablero" tab url="/tablero/" />
        <f7-view id="view-asistente" tab url="/asistente/" />
        <f7-view id="view-perfil" tab url="/perfil/" />
      </f7-views>

      <!-- Pastilla flotante (glass) — en <body> para que quede sobre todo.
           Se oculta en el chat de IA para dar una vista de conversación completa. -->
      <Teleport to="body">
        <nav class="floating-nav" v-show="active !== 'asistente'">
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
    </template>
  </f7-app>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { f7, f7ready } from 'framework7-vue';
import routes from '@/js/routes.js';
import { api } from '@/js/api.js';
import { store, setSesion } from '@/js/store.js';
import LoginPage from '@/pages/LoginPage.vue';

const f7params = reactive({
  name: 'InovaOS',
  theme: 'ios',
  darkMode: false,
  colors: { primary: '#5b5bd6' },
  routes,
  view: { iosDynamicNavbar: true, pushState: false },
  touch: { tapHold: true },
});

// 7 ítems con "Crear" siempre al centro (índice 3: 3 a cada lado).
const tabs = [
  { id: 'home', label: 'Inicio', icon: 'house_fill' },
  { id: 'pendientes', label: 'Tareas', icon: 'square_list_fill' },
  { id: 'metricas', label: 'Métricas', icon: 'chart_bar_alt_fill' },
  { id: 'captura', label: 'Crear', icon: 'plus' },
  { id: 'tablero', label: 'Tablero', icon: 'chart_pie_fill' },
  { id: 'asistente', label: 'IA', icon: 'sparkles' },
  { id: 'perfil', label: 'Perfil', icon: 'person_fill' },
];

const active = ref('home');

function show(id) {
  f7.tab.show(`#view-${id}`);
}

// Mantiene el resaltado de la pastilla sincronizado, incluso cuando otra
// pantalla cambia de tab por código.
onMounted(async () => {
  f7ready(() => {
    f7.on('tabShow', (tabEl) => {
      const id = tabEl?.id?.replace('view-', '');
      if (id) active.value = id;
    });
  });

  // ¿Hay cookie de sesión válida?
  try {
    const { usuario } = await api.auth.yo();
    setSesion(usuario);
  } catch {
    setSesion(null); // 401: se muestra el login
  } finally {
    store.comprobandoSesion = false;
  }
});
</script>

<style scoped>
.arranque {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
