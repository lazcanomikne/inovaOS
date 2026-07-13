<template>
  <f7-page name="asistente" class="asistente-page" :page-content="false">
    <f7-navbar>
      <f7-nav-left>
        <a class="link icon-only atras-btn" @click="volver"><i class="f7-icons">chevron_left</i></a>
      </f7-nav-left>
      <f7-nav-title>
        <span class="asis-title"><i class="f7-icons">sparkles</i> Asistente</span>
      </f7-nav-title>
    </f7-navbar>

    <!-- Mensajes -->
    <div class="chat-msgs" ref="scroller" :style="{ bottom: (kb + 78) + 'px' }">
      <!-- Bienvenida -->
      <div v-if="!mensajes.length" class="chat-welcome">
        <div class="cw-orb"><i class="f7-icons">sparkles</i></div>
        <h2>Hola{{ nombre ? `, ${nombre}` : '' }}</h2>
        <p>Pregúntame por tus pendientes o pídeme crear una tarea.</p>
        <div class="cw-chips">
          <button v-for="s in sugerencias" :key="s" class="cw-chip" @click="enviar(s)">{{ s }}</button>
        </div>
      </div>

      <!-- Conversación -->
      <div v-for="(m, i) in mensajes" :key="i" class="bubble-row" :class="m.rol">
        <div class="bubble" :class="m.rol">{{ m.texto }}</div>
      </div>

      <!-- Escribiendo… -->
      <div v-if="pensando" class="bubble-row assistant">
        <div class="bubble assistant escribiendo"><span></span><span></span><span></span></div>
      </div>
    </div>

    <!-- Compositor — se pega justo encima del teclado -->
    <div class="chat-composer" :style="kb ? { bottom: kb + 'px' } : {}">
      <textarea
        ref="entrada"
        v-model="texto"
        rows="1"
        placeholder="Escribe tu pregunta…"
        :disabled="pensando"
        @focus="alFondo"
        @keydown.enter.exact.prevent="enviar()"
        @input="autosize"
      ></textarea>
      <button class="enviar-btn" :disabled="pensando || !texto.trim()" @click="enviar()">
        <i class="f7-icons">arrow_up</i>
      </button>
    </div>
  </f7-page>
</template>

<script setup>
import { ref, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { f7 } from 'framework7-vue';
import { api } from '@/js/api.js';
import { store } from '@/js/store.js';

const nombre = (store.usuario?.nombre || '').split(' ')[0];
const sugerencias = [
  '¿Qué pendientes tengo?',
  '¿Qué está atrasado?',
  '¿Qué necesita mi respuesta?',
  '¿Qué falta por aceptar?',
];

const mensajes = ref([]);
const texto = ref('');
const pensando = ref(false);
const scroller = ref(null);
const entrada = ref(null);
const kb = ref(0); // alto del teclado en px (0 si está cerrado)

function volver() {
  f7.tab.show('#view-home');
}

// Sigue al teclado con la API de visualViewport (como iMessage/WhatsApp).
function alTeclado() {
  const vv = window.visualViewport;
  if (!vv) return;
  const alto = window.innerHeight - vv.height - vv.offsetTop;
  kb.value = Math.max(0, Math.round(alto));
  alFondo();
}

function autosize() {
  const el = entrada.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

async function alFondo() {
  await nextTick();
  const el = scroller.value;
  if (el) el.scrollTop = el.scrollHeight;
}

async function enviar(preset) {
  const t = (preset ?? texto.value).trim();
  if (!t || pensando.value) return;
  mensajes.value.push({ rol: 'user', texto: t });
  texto.value = '';
  autosize();
  pensando.value = true;
  alFondo();

  try {
    const { respuesta } = await api.chat.enviar(mensajes.value);
    mensajes.value.push({ rol: 'assistant', texto: respuesta });
  } catch (e) {
    mensajes.value.push({ rol: 'assistant', texto: `Ups: ${e.message}` });
  } finally {
    pensando.value = false;
    alFondo();
  }
}

onMounted(() => {
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', alTeclado);
    vv.addEventListener('scroll', alTeclado);
  }
});
onBeforeUnmount(() => {
  const vv = window.visualViewport;
  if (vv) {
    vv.removeEventListener('resize', alTeclado);
    vv.removeEventListener('scroll', alTeclado);
  }
});
</script>

<style scoped>
.asis-title { display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.asis-title i { font-size: 18px; color: var(--inova-primary); }
.atras-btn i { font-size: 28px; color: var(--inova-primary); }

.chat-msgs {
  position: absolute;
  top: 0; left: 0; right: 0;
  /* bottom se ajusta por JS (teclado + alto del compositor) */
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: calc(var(--f7-navbar-height, 56px) + env(safe-area-inset-top) + 12px) 14px 8px;
  transition: bottom 0.18s ease;
}

/* Bienvenida */
.chat-welcome { text-align: center; padding: 32px 12px 8px; }
.cw-orb {
  width: 68px; height: 68px; margin: 0 auto 14px; border-radius: 22px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  box-shadow: 0 10px 26px rgba(91, 91, 214, 0.4);
}
.cw-orb i { color: #fff; font-size: 32px; }
.chat-welcome h2 { margin: 0 0 4px; font-size: 22px; font-weight: 800; color: #15102b; letter-spacing: -0.02em; }
.chat-welcome p { margin: 0 0 18px; font-size: 14px; color: #6b6780; }
.cw-chips { display: flex; flex-direction: column; gap: 8px; max-width: 320px; margin: 0 auto; }
.cw-chip {
  background: rgba(255, 255, 255, 0.72); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  padding: 12px 16px; border-radius: 14px; font-size: 14px; font-weight: 600; color: #3a3550;
  cursor: pointer; transition: transform 0.1s ease;
}
.cw-chip:active { transform: scale(0.97); }

/* Burbujas */
.bubble-row { display: flex; margin-bottom: 8px; }
.bubble-row.user { justify-content: flex-end; }
.bubble-row.assistant { justify-content: flex-start; }
.bubble {
  max-width: 82%; padding: 10px 14px; border-radius: 18px; font-size: 15px; line-height: 1.4;
  white-space: pre-wrap; word-wrap: break-word;
}
.bubble.user {
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  color: #fff; border-bottom-right-radius: 6px;
}
.bubble.assistant {
  background: rgba(255, 255, 255, 0.82); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.6); color: #1f1a33; border-bottom-left-radius: 6px;
}

/* Escribiendo… */
.escribiendo { display: flex; gap: 4px; align-items: center; }
.escribiendo span {
  width: 7px; height: 7px; border-radius: 50%; background: #b7b3c8; display: inline-block;
  animation: bounce 1.2s infinite ease-in-out;
}
.escribiendo span:nth-child(2) { animation-delay: 0.15s; }
.escribiendo span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce { 0%, 80%, 100% { transform: translateY(0); opacity: 0.5; } 40% { transform: translateY(-5px); opacity: 1; } }

/* Compositor — pegado al fondo; sube con el teclado (bottom por JS) */
.chat-composer {
  position: absolute; left: 0; right: 0;
  bottom: calc(10px + env(safe-area-inset-bottom));
  margin: 0 14px; padding: 6px 6px 6px 14px;
  display: flex; align-items: flex-end; gap: 8px;
  background: rgba(255, 255, 255, 0.82); -webkit-backdrop-filter: blur(22px) saturate(180%); backdrop-filter: blur(22px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6); border-radius: 24px;
  box-shadow: 0 8px 26px rgba(17, 12, 46, 0.16);
  transition: bottom 0.18s ease;
}
.chat-composer textarea {
  flex: 1; border: none; background: transparent; resize: none; outline: none;
  font-size: 16px; line-height: 1.35; max-height: 120px; padding: 8px 0; color: #1f1a33; font-family: inherit;
}
.enviar-btn {
  flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--inova-primary), var(--inova-primary-2));
  box-shadow: 0 4px 12px rgba(91, 91, 214, 0.4);
  transition: transform 0.1s ease, opacity 0.15s ease;
}
.enviar-btn i { color: #fff; font-size: 20px; font-weight: 700; }
.enviar-btn:disabled { opacity: 0.4; box-shadow: none; }
.enviar-btn:active:not(:disabled) { transform: scale(0.9); }
</style>
