# InovaOS — Look & Feel, Push, Auto-update y adaptación a iPhone

Detalle de *cómo* se logró la sensación "app nativa de iOS" en una PWA web, para replicarlo.

---

## 1. Estética general (liquid glass + fondo aurora)

**Superficies "glass" reutilizables.** Todo se apoya en variables CSS y una clase utilitaria:

```css
:root {
  --glass-bg: rgba(255,255,255,0.14);
  --glass-bg-strong: rgba(255,255,255,0.24);
  --glass-border: rgba(255,255,255,0.28);
  --glass-shadow: 0 8px 32px rgba(17,12,46,0.18);
  --glass-blur: 22px;
}
.glass {
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  backdrop-filter: blur(var(--glass-blur)) saturate(180%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

- Se aplica a tarjetas, listas, navbar, botones y badges (`.glass`, `.glass-strong`, `.glass-list`, `.glass-btn`, `.badge-glass`).
- La clave del efecto vidrio es **`backdrop-filter: blur() saturate()`** (con prefijo `-webkit-` para Safari) sobre fondos semitransparentes.

**Fondo "aurora" continuo.** Cada `.page` pinta su propio degradado (no el body), porque Framework7 *apila* páginas al navegar y si fueran transparentes se vería la anterior:

```css
.page {
  background-color: var(--aurora-color) !important;
  background-image: var(--tematica-image, none), var(--aurora-image);
}
```

**Temas (paletas + temáticas).** Se cambian con custom properties en `<html data-tematica data-color>` (`src/js/tema.js`). Un solo lugar redefine `--inova-primary` y `--f7-theme-color-rgb/shade/tint`, y **toda la UI (incluida la franja del notch) se re-tinta sola**. Paletas: Aurora multicolor → Índigo, Azul, Turquesa, Esmeralda, Atardecer, Rosa, Grafito/Negro. Temáticas (patrón de iconos): Perritos, Cómputo, Fútbol, F1, Sin temática.

---

## 2. Menú en modo "pila" (pastilla flotante inferior)

Barra de navegación como **pastilla flotante centrada** (no la toolbar clásica), con truco anti-bug de iOS:

```css
.floating-nav {
  position: fixed;
  left: 0; right: 0; margin: 0 auto;      /* centrado SIN transform */
  width: fit-content;
  bottom: calc(14px + env(safe-area-inset-bottom));  /* respeta el home indicator */
  border-radius: 999px;
  z-index: 13500;
  isolation: isolate;
}
.floating-nav::before {                    /* el VIDRIO va en un pseudo-elemento */
  content: ''; position: absolute; inset: 0; z-index: -1;
  border-radius: inherit;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(22px) saturate(180%);
}
```

**Por qué el `::before`:** en iOS Safari un `position:fixed` con `backdrop-filter` *propio* se desplaza o desaparece al hacer scroll. Moviendo el blur a un pseudo-elemento, la pastilla queda fija y estable y los toques siempre llegan.

- Ítems (`.fnav-item`): icono f7 24px + etiqueta 9px, columna centrada, `:active { transform: scale(0.9) }` para feedback táctil, `.active` con color del tema.
- Ítem central **"Crear"** destacado como botón en gradiente (`linear-gradient` de la marca) con sombra de color.
- El contenido nunca queda tapado: `.page-content { padding-bottom: calc(100px + env(safe-area-inset-bottom)); }`.

---

## 3. Adaptación "perfecta" al iPhone (edge-to-edge + safe areas)

**Meta viewport y modo app (en `index.html`):**
```html
<meta name="viewport" content="...viewport-fit=cover, user-scalable=no" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="InovaOS" />
```
- **`viewport-fit=cover`** = el fondo llega al borde físico (notch / Dynamic Island / home indicator).
- **`black-translucent`** = la barra de estado se vuelve translúcida y la app ocupa toda la pantalla.

**Zonas seguras.** El contenido se mantiene fuera del notch y del home indicator con `env(safe-area-inset-*)` (Framework7 ya lo aplica; la pastilla y el padding lo usan explícitamente).

**Sin blancos en el rebote (overscroll).** En standalone se fija el color de fondo de `html/body` para que el "bounce" no muestre blanco:
```css
@media all and (display-mode: standalone) {
  html, body { background-color: #ece9fb; }   /* #0b0b13 en modo oscuro */
}
```

**Franja del notch tintada con el tema.** Como la status bar es translúcida (texto blanco: reloj/batería), se pinta una franja bajo ella con el color de marca para que se lea bien, y **sigue el tema activo**:
```css
body::before {
  position: fixed; top: 0; left: 0; right: 0;
  height: env(safe-area-inset-top);
  background: linear-gradient(180deg,
    rgba(var(--f7-theme-color-rgb),0.92),
    rgba(var(--f7-theme-color-rgb),0.5));
  z-index: 12000; pointer-events: none;
}
```

**Modo oscuro** contemplado en todas las superficies (`.dark ...`).

---

## 4. Notificaciones push nativas

**Cliente (`src/js/push.js`):**
- Detecta soporte (`serviceWorker`, `PushManager`, `Notification`) y si corre **instalada** (`display-mode: standalone` o `navigator.standalone`).
- **En iPhone las push SOLO funcionan con la PWA instalada** (iOS 16.4+) y permiso concedido → estados: `no-soportado | no-instalada | bloqueado | activo | inactivo`.
- Al activar: pide permiso → `pushManager.subscribe({ userVisibleOnly, applicationServerKey })` con la **VAPID public key** → registra la suscripción en el backend junto al **nombre del dispositivo** (iPhone/iPad/Mac/Android/Windows).
- **Cambio de teléfono / reactivar:** al activar de nuevo se guarda la **nueva suscripción**, así el dispositivo actual vuelve a recibir push.

**Servidor:** `web-push` + VAPID, tabla `push_subs`. Los envíos con status 404/410 (app desinstalada o permiso revocado) **borran la suscripción muerta** automáticamente. El Service Worker maneja el evento `push` y el clic (handlers en `public/push-sw.js`, inyectados por Workbox con `importScripts`).

---

## 5. Auto-actualización SIN borrar el icono de inicio

El objetivo: que al publicar una mejora, el usuario la reciba **sin desinstalar ni reinstalar la PWA**. Se logra con la config del Service Worker (Workbox vía `vite-plugin-pwa`):

```js
VitePWA({
  registerType: 'autoUpdate',   // el SW nuevo se registra y toma control solo
  workbox: {
    skipWaiting: true,          // el SW nuevo NO espera: activa de inmediato
    clientsClaim: true,         // toma control de las pestañas ya abiertas
    cleanupOutdatedCaches: true // borra cachés viejas al activar
  }
})
```

- **El icono en la pantalla de inicio nunca cambia:** solo se actualiza el *contenido* cacheado (JS/CSS/HTML), no la instalación. Al cerrar y reabrir la app, el SW nuevo ya está activo y sirve la versión nueva.
- **Caché de API con `NetworkFirst`** (timeout 5 s, TTL 5 min): siempre intenta red primero, así los datos no se quedan viejos; y **`/api/auth` queda fuera de la caché** (una sesión cacheada dejaría al usuario "dentro/fuera" falsamente).
- `__BUILD_ID__` (fecha de compilación inyectada por Vite) permite verificar en la app qué versión está corriendo.
- Por eso, tras cada mejora, basta con avisar por push: **"cierra y abre la app"** — se actualiza sola.

---

## Resumen en una línea

> Sensación nativa iOS = **Framework7** (gestos/transiciones) + **liquid glass** (`backdrop-filter` sobre variables CSS) + **fondo aurora temable** + **pastilla de navegación flotante** (vidrio en `::before` para no romperse en Safari) + **edge-to-edge con `viewport-fit=cover` y `env(safe-area-inset-*)`** + franja de notch tintada con el tema.
> **Push** nativas con VAPID (solo PWA instalada en iOS, re-suscribe al cambiar de equipo).
> **Auto-update** con SW `autoUpdate + skipWaiting + clientsClaim`: se refresca el contenido sin tocar el icono de inicio.
