<template>
  <f7-page name="perfil">
    <f7-navbar large transparent>
      <f7-nav-title>Perfil</f7-nav-title>
      <f7-nav-title-large>Perfil</f7-nav-title-large>
    </f7-navbar>

    <div class="block">
      <div class="card glass-strong perfil-card">
        <div class="card-content card-content-padding perfil-head">
          <div class="perfil-avatar">{{ iniciales }}</div>
          <div>
            <div class="perfil-nombre">{{ usuario.nombre }}</div>
            <div class="perfil-rol">{{ usuario.rol }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="list glass-list no-hairlines">
      <ul>
        <li class="item-content">
          <div class="item-inner">
            <div class="item-title">Notificaciones push</div>
            <div class="item-after">
              <label class="toggle toggle-init">
                <input type="checkbox" v-model="notif" />
                <span class="toggle-icon"></span>
              </label>
            </div>
          </div>
        </li>
        <li class="item-content">
          <div class="item-inner">
            <div class="item-title">Versión</div>
            <div class="item-after">v{{ version }}</div>
          </div>
        </li>
        <li class="item-content">
          <div class="item-inner">
            <div class="item-title">Build</div>
            <div class="item-after">{{ buildId }}</div>
          </div>
        </li>
      </ul>
    </div>

    <div class="block">
      <f7-button large class="glass-btn" @click="buscarActualizacion" :disabled="actualizando">
        {{ actualizando ? 'Actualizando…' : 'Actualizar app' }}
      </f7-button>
      <div class="update-hint">Trae la última versión sin reinstalar la PWA.</div>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed } from 'vue';
import { f7 } from 'framework7-vue';
import { store } from '@/js/store.js';

const usuario = computed(() => store.usuario);
const notif = ref(true);
const version = __APP_VERSION__ || '0.1.0';
const buildId = __BUILD_ID__ || '—';

const iniciales = computed(() =>
  usuario.value.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

const actualizando = ref(false);

async function buscarActualizacion() {
  if (actualizando.value) return;
  actualizando.value = true;
  f7.toast.create({ text: 'Actualizando app…', position: 'center', closeTimeout: 4000 }).open();

  // Recarga forzando red (sin caché HTTP). Se llama sí o sí.
  const recargar = () => {
    const url = location.pathname + '?v=' + Date.now();
    location.replace(url);
  };
  // Salvavidas: si algo se cuelga en iOS (p. ej. reg.update sin responder),
  // recarga igual a los 3.5s para que el botón nunca se quede pegado.
  const salvavidas = setTimeout(recargar, 3500);

  try {
    // 1. Borra TODO el precache de Workbox (lo más importante en iOS).
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
    // 2. Desregistra los service workers = REFRESH COMPLETO. Al recargar,
    //    la app baja todo de red y registra el SW nuevo automáticamente.
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch (_) {
    /* ignore */
  }

  clearTimeout(salvavidas);
  recargar();
}
</script>

<style scoped>
.perfil-head { display: flex; align-items: center; gap: 16px; }
.perfil-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 800;
}
.perfil-nombre { font-size: 20px; font-weight: 800; }
.perfil-rol { opacity: 0.7; }
.update-hint { text-align: center; font-size: 13px; opacity: 0.55; margin-top: 10px; }
</style>
