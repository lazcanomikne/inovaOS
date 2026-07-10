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
          <div class="perfil-datos">
            <div class="perfil-nombre">{{ usuario.nombre }}</div>
            <div class="perfil-rol">{{ etiquetaRol }}</div>
            <div class="perfil-email">{{ usuario.email }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Face ID / passkeys -->
    <div class="block-title">Acceso rápido</div>
    <div class="list glass-list no-hairlines">
      <ul>
        <li v-for="pk in passkeys" :key="pk.id">
          <div class="item-content">
            <div class="item-media"><i class="f7-icons pk-icono">faceid</i></div>
            <div class="item-inner">
              <div class="item-title">
                {{ pk.dispositivo }}
                <div class="item-footer">{{ pk.last_used_at ? 'Último uso: ' + fecha(pk.last_used_at) : 'Sin usar aún' }}</div>
              </div>
              <div class="item-after">
                <a class="link text-color-red" @click="quitarPasskey(pk)">Quitar</a>
              </div>
            </div>
          </div>
        </li>

        <li v-if="!passkeys.length && soportaFaceId">
          <a class="item-link item-content" @click="activarFaceId">
            <div class="item-media"><i class="f7-icons pk-icono">faceid</i></div>
            <div class="item-inner">
              <div class="item-title">
                Activar Face ID en este dispositivo
                <div class="item-footer">Entra con un toque, sin escribir el código</div>
              </div>
            </div>
          </a>
        </li>

        <li v-else-if="!passkeys.length">
          <div class="item-content">
            <div class="item-inner text-color-gray">
              Este dispositivo no soporta Face ID / passkeys.
            </div>
          </div>
        </li>

        <li v-if="passkeys.length && soportaFaceId">
          <a class="item-link item-content" @click="activarFaceId">
            <div class="item-inner"><div class="item-title text-color-primary">Añadir otro dispositivo</div></div>
          </a>
        </li>
      </ul>
    </div>

    <div class="list glass-list no-hairlines">
      <ul>
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

    <div class="block">
      <f7-button large class="glass-btn" color="red" @click="salir">Cerrar sesión</f7-button>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store, limpiarSesion } from '@/js/store.js';
import { tieneFaceId, registrarPasskey } from '@/js/passkey.js';

const usuario = computed(() => store.usuario ?? { nombre: '', rol: '', email: '' });
const version = __APP_VERSION__ || '0.1.0';
const buildId = __BUILD_ID__ || '—';

const ROLES = { direccion: 'Dirección General', jefe: 'Jefe directo', colaborador: 'Colaborador' };
const etiquetaRol = computed(() => ROLES[usuario.value.rol] ?? usuario.value.rol);

const iniciales = computed(() =>
  (usuario.value.nombre || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
);

const passkeys = ref([]);
const soportaFaceId = ref(false);
const actualizando = ref(false);

const fecha = (iso) => new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString();

async function cargarPasskeys() {
  try { passkeys.value = await api.auth.passkey.mias(); } catch { passkeys.value = []; }
}

async function activarFaceId() {
  try {
    const r = await registrarPasskey();
    await cargarPasskeys();
    f7.toast.create({ text: `Face ID activado en ${r.dispositivo} ✓`, closeTimeout: 2200, position: 'center' }).open();
  } catch (e) {
    f7.dialog.alert(e.message, 'Face ID');
  }
}

function quitarPasskey(pk) {
  f7.dialog.confirm(`Ya no podrás entrar con Face ID desde ${pk.dispositivo}.`, 'Quitar acceso', async () => {
    try {
      await api.auth.passkey.eliminar(pk.id);
      await cargarPasskeys();
    } catch (e) {
      f7.dialog.alert(e.message, 'Error');
    }
  });
}

function salir() {
  f7.dialog.confirm('¿Cerrar sesión en este dispositivo?', 'Cerrar sesión', async () => {
    try { await api.auth.salir(); } catch { /* aunque falle, limpiamos local */ }
    limpiarSesion();
  });
}

async function buscarActualizacion() {
  if (actualizando.value) return;
  actualizando.value = true;
  f7.toast.create({ text: 'Actualizando app…', position: 'center', closeTimeout: 4000 }).open();

  const recargar = () => location.replace(location.pathname + '?v=' + Date.now());
  const salvavidas = setTimeout(recargar, 3500);

  try {
    if (window.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch (_) { /* ignore */ }

  clearTimeout(salvavidas);
  recargar();
}

onMounted(async () => {
  soportaFaceId.value = await tieneFaceId();
  await cargarPasskeys();
});
</script>

<style scoped>
.perfil-head { display: flex; align-items: center; gap: 16px; }
.perfil-datos { flex: 1; min-width: 0; }
.perfil-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 800; flex-shrink: 0;
}
.perfil-nombre { font-size: 20px; font-weight: 800; }
.perfil-rol { opacity: 0.7; font-size: 14px; }
.perfil-email { opacity: 0.45; font-size: 12px; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; }
.pk-icono { font-size: 26px; color: var(--inova-primary); }
.update-hint { text-align: center; font-size: 13px; opacity: 0.55; margin-top: 10px; }
</style>
