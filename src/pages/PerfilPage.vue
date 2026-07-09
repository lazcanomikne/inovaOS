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
            <div class="item-after">{{ version }}</div>
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
import { ref, computed, getCurrentInstance } from 'vue';

const { proxy } = getCurrentInstance();
const usuario = ref({ nombre: 'Carolina G.', rol: 'Dirección General' });
const notif = ref(true);
const version = __APP_VERSION__ || '0.1.0';

const iniciales = computed(() =>
  usuario.value.nombre.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

const actualizando = ref(false);

async function buscarActualizacion() {
  if (actualizando.value) return;
  actualizando.value = true;
  const $f7 = proxy.$f7;
  const toast = $f7.toast.create({ text: 'Actualizando app…', position: 'center' });
  toast.open();

  try {
    // 1. Fuerza a cada SW registrado a re-checar si hay versión nueva
    //    y activa de inmediato el que esté "en espera".
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.map(async (r) => {
          try { await r.update(); } catch (_) {}
          if (r.waiting) r.waiting.postMessage({ type: 'SKIP_WAITING' });
        })
      );
    }
    // 2. LO CLAVE EN iOS: vacía TODO el precache de Workbox.
    //    Sin caché, el siguiente fetch baja de la red el index.html nuevo
    //    (que referencia los assets con hashes nuevos).
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) {
    /* ignore */
  }

  // 3. Recarga: al no haber caché, obtiene la última versión de red.
  window.location.reload();
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
