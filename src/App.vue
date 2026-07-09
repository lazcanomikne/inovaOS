<template>
  <f7-app v-bind="f7params">
    <f7-views tabs class="safe-areas">
      <!-- Tab bar inferior estilo iOS (glass) -->
      <f7-toolbar tabbar labels bottom class="glass-tabbar">
        <f7-link tab-link="#view-home" tab-link-active icon-f7="house_fill" text="Inicio" />
        <f7-link tab-link="#view-pendientes" icon-f7="checkmark_seal_fill" text="Pendientes" />
        <f7-link tab-link="#view-captura" icon-f7="plus_circle_fill" text="Capturar" class="tab-captura" />
        <f7-link tab-link="#view-tablero" icon-f7="chart_pie_fill" text="Tablero" />
        <f7-link tab-link="#view-perfil" icon-f7="person_crop_circle_fill" text="Perfil" />
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
  darkMode: 'auto',
  colors: { primary: '#5b5bd6' },
  routes,
  view: {
    iosDynamicNavbar: true,
    pushState: false,
  },
  touch: { tapHold: true },
});
</script>

<style>
.glass-tabbar {
  --f7-tabbar-link-active-color: var(--inova-primary);
}
.tab-captura i {
  font-size: 30px;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
</style>
