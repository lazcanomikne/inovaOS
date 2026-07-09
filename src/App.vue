<template>
  <f7-app v-bind="f7params">
    <f7-views tabs class="safe-areas">
      <!-- Tab bar inferior estilo Instagram: solo iconos, glass translúcido -->
      <f7-toolbar tabbar bottom class="ig-tabbar">
        <f7-link tab-link="#view-home" tab-link-active icon-f7="house_fill" />
        <f7-link tab-link="#view-pendientes" icon-f7="square_list_fill" />
        <f7-link tab-link="#view-captura" class="tab-create">
          <span class="create-btn"><i class="f7-icons">plus</i></span>
        </f7-link>
        <f7-link tab-link="#view-tablero" icon-f7="chart_pie_fill" />
        <f7-link tab-link="#view-perfil" icon-f7="person_fill" />
      </f7-toolbar>

      <!-- Cada tab es un stack de navegación independiente -->
      <f7-view id="view-home" main tab tab-active url="/" />
      <f7-view id="view-pendientes" tab url="/pendientes/" />
      <f7-view id="view-captura" tab url="/captura/" />
      <f7-view id="view-tablero" tab url="/tablero/" />
      <f7-view id="view-perfil" tab url="/perfil/" />
    </f7-views>
  </f7-app>
</template>

<script setup>
import { reactive } from 'vue';
import routes from '@/js/routes.js';

const f7params = reactive({
  name: 'INOVATECH OS',
  theme: 'ios',
  darkMode: false, // Modo claro por defecto
  colors: { primary: '#5b5bd6' },
  routes,
  view: {
    iosDynamicNavbar: true,
    pushState: false,
  },
  touch: { tapHold: true },
});
</script>
