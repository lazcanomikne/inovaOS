# InovaOS — Resumen del stack (para reutilizar en un proyecto nuevo)

PWA de delegación y seguimiento de "pendientes" (tareas). Mobile-first, instalable,
con notificaciones nativas, IA integrada y backend serverless. Todo en un mismo repo.

---

## 1. Plantilla / Framework base

| Capa | Tecnología | Versión | Notas |
|---|---|---|---|
| **UI framework** | **Framework7** + **framework7-vue** | 8.3.x | Componentes mobile (navbar, tabs, listas, swipeout, dialog, toast, sheet). Estética iOS. |
| **Framework JS** | **Vue 3** (Composition API, `<script setup>`) | 3.5.x | Se integra vía `framework7-vue`. |
| **Bundler / dev** | **Vite** | 6.x | `@vitejs/plugin-vue`. Alias `@` → `src`. |
| **PWA** | **vite-plugin-pwa** (Workbox) | 0.21.x | `registerType: autoUpdate`, `skipWaiting`, `clientsClaim`. |
| **Iconos** | framework7-icons | 5.x | Set de iconos f7 (`<i class="f7-icons">`). |
| **Carrusel** | swiper | 11.x | Incluido con Framework7. |

> **Por qué esta plantilla:** Framework7 da un look "app nativa" (transiciones, gestos, swipe) sin
> React Native ni compilar binarios. Con Vite + PWA la misma web se instala en iOS/Android como app.

---

## 2. Arquitectura general

```
Navegador (PWA instalable)
  └─ Vue 3 + Framework7  ──HTTP──►  Vercel Serverless Functions (/api/*)
                                        ├─ Turso (libSQL/SQLite)      ← base de datos
                                        ├─ Vercel Blob                ← archivos/adjuntos
                                        ├─ Anthropic Claude API       ← asistente IA
                                        ├─ Web Push (VAPID)           ← notificaciones nativas
                                        └─ SMTP (nodemailer)          ← correos
```

- **Hosting:** Vercel. Push a `main` = deploy automático.
- **Frontend y backend en el mismo repo.** El front se sirve estático (`dist/`), el backend son funciones en `/api`.
- Plan Hobby de Vercel: **límite de 12 funciones serverless** (por eso varios endpoints se agrupan en uno solo usando query params).

---

## 3. Backend — Serverless Functions

- Node.js **ESM** (`"type": "module"`). Cada archivo en `/api` exporta `export default function handler(req, res)`.
- Rutas dinámicas con corchetes: `api/pendientes/[id].js`, catch-all `api/auth/[...ruta].js`.
- **Sin framework de backend** (no Express): funciones planas + helpers compartidos con prefijo `_`:
  - `_db.js` — cliente Turso + helpers `sendJson`, `sendError`, `readBody`.
  - `_auth.js` — sesión (JWT en cookie HttpOnly), códigos OTP, guard `requiereSesion`.
  - `_permisos.js` — reglas de visibilidad (quién ve qué).
  - `_push.js` — envío Web Push.
  - `_mail.js` — correos con nodemailer.
  - `_ia.js` — orquestación del asistente (tool-use loop de Claude).

Endpoints principales: `pendientes/`, `checklist/`, `evidencias/`, `tablero.js`, `usuarios.js`, `push.js`, `chat.js`, `auth/`, `cron/recordatorios.js`.

---

## 4. Base de datos — Turso (libSQL / SQLite)

- **Turso** = SQLite gestionado en la nube, cliente `@libsql/client`.
- Conexión por `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`.
- Migraciones en `migrations/000N_*.sql`, aplicadas con `scripts/migrate.mjs` (`npm run db:migrate`).
- `PRAGMA foreign_keys=1` para que funcione `ON DELETE CASCADE`.

**Tablas núcleo:** `usuarios`, `pendientes`, `checklist`, `evidencias`, `historial`,
`codigos_acceso` (OTP), `push_subs` (suscripciones push), más columnas añadidas por migración
(avatar, archivado, asignado en checklist, etc.).

---

## 5. Autenticación

- **Passwordless por código OTP al correo** (6 dígitos, HMAC-hasheados en BD, vigencia 10 min, rate-limit).
- Sesión = **JWT firmado (`jose`, HS256)** en **cookie HttpOnly SameSite=Lax** (Secure en prod). El JS del navegador nunca lee el token.
- **Passkeys / WebAuthn** disponible (`@simplewebauthn/browser` + `/server`).
- **Vía servicio server-to-server:** cabeceras `X-Service-Token` + `X-Actor-Email` (comparación en tiempo constante) para que un backend externo actúe como un usuario. Inerte si no se configura `SERVICE_TOKEN`.
- Roles: `direccion` | `jefe` | `colaborador` (dirección ve todo; colaborador solo lo suyo).

---

## 6. Almacenamiento de archivos — Vercel Blob

- `@vercel/blob`. El navegador sube **directo a Blob** (evita el límite de 4.5 MB de las funciones) vía `handleUploadUrl` → `/api/blob-upload`.
- URLs públicas con `Content-Disposition: inline` (para poder visualizar PDF/imágenes dentro de la app).
- Token: `BLOB_READ_WRITE_TOKEN`.

---

## 7. Notificaciones

- **Push nativas:** Web Push + VAPID (`web-push`). Tabla `push_subs`. En iOS requiere PWA instalada (standalone) + permiso. Handlers del SW en `public/push-sw.js` (inyectado por Workbox `importScripts`).
- **Correo:** `nodemailer` sobre SMTP (`SMTP_HOST/PORT/USER/PASS/FROM`). Se usa para OTP, avisos y recordatorios.
- **Recordatorios automáticos:** Vercel Cron (`vercel.json`) → `/api/cron/recordatorios` diario. Protegido con `CRON_SECRET`.

---

## 8. Asistente de IA

- **Anthropic Claude** vía `@anthropic-ai/sdk`, modelo `claude-haiku-4-5`.
- **Manual tool-use loop** (no agente gestionado): el modelo puede leer la BD y ejecutar acciones mediante herramientas definidas en `_ia.js` (listar/detallar pendientes, listar usuarios, crear, cambiar estatus, actualizar, clasificar por texto área/importancia, notificar usuario por push+correo).
- Endpoint `chat.js`. Clave `ANTHROPIC_API_KEY`.
- Entrada por voz opcional (`src/js/voz.js`, Web Speech API).

---

## 9. PWA / detalles de cliente

- **Instalable** (manifest: standalone, portrait, theme color, iconos 192/512 + maskable).
- **Auto-update:** SW con `autoUpdate` + `skipWaiting` + `clientsClaim`; `cleanupOutdatedCaches`. `__BUILD_ID__` inyectado por Vite para verificar versión.
- **Caché:** assets precacheados; `/api/*` con `NetworkFirst` (timeout 5 s, TTL 5 min); `/api/auth` **nunca** se cachea (evita sesión falsa).
- Temas visuales (temáticas + paletas de color) con CSS custom properties (`--inova-primary`, `--f7-theme-color-rgb`, `data-tematica`/`data-color` en `<html>`), en `src/js/tema.js`.
- Estado global ligero con un store propio reactivo (`src/js/store.js`), sin Vuex/Pinia.
- Efectos: confeti + sonido sintetizado (Web Audio API) al concluir (`src/js/celebracion.js`).

---

## 10. Estructura del repo

```
├─ api/                     # funciones serverless (backend)
│  ├─ _db.js _auth.js _push.js _mail.js _ia.js _permisos.js
│  ├─ pendientes/  checklist/  evidencias/  auth/  cron/
│  └─ tablero.js usuarios.js push.js chat.js blob-upload.js
├─ migrations/              # 000N_*.sql
├─ scripts/migrate.mjs      # runner de migraciones
├─ src/
│  ├─ main.js  App.vue
│  ├─ pages/                # una pantalla por archivo .vue
│  ├─ js/  (api, store, routes, tema, push, evidencias, celebracion, voz, passkey, pendientes)
│  └─ css/app.css
├─ public/                  # push-sw.js, iconos, manifest assets
├─ vite.config.js           # Vue + PWA + proxy /api a :3000 en dev
├─ vercel.json              # crons
└─ package.json             # "type": "module"
```

---

## 11. Variables de entorno

```
AUTH_SECRET                 # firma de JWT y HMAC de OTP
TURSO_DATABASE_URL          # base de datos
TURSO_AUTH_TOKEN
BLOB_READ_WRITE_TOKEN       # Vercel Blob
ANTHROPIC_API_KEY           # IA
VAPID_PUBLIC_KEY            # Web Push
VAPID_PRIVATE_KEY
VAPID_SUBJECT               # mailto:...
SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASS SMTP_FROM SMTP_SECURE
CRON_SECRET                 # protege el endpoint de cron
SERVICE_TOKEN               # (opcional) vía server-to-server
WEBAUTHN_RP_ID WEBAUTHN_RP_NAME WEBAUTHN_ORIGIN   # passkeys
```

---

## 12. Flujo de desarrollo y deploy

- **Dev:** `npm run dev` (Vite :5173). Para probar el API en local: `vercel dev` (:3000); Vite le hace proxy. Sin backend, las pantallas caen a datos demo.
- **Build:** `npm run build` → `dist/`.
- **DB:** `npm run db:migrate` / `node scripts/migrate.mjs 000N_x.sql`.
- **Deploy:** push a `main` → Vercel construye y publica solo.

---

## Resumen en una línea

> **Vue 3 + Framework7 (PWA con Vite/Workbox)** al frente · **funciones serverless de Vercel (Node ESM)** al fondo ·
> **Turso (libSQL/SQLite)** de base de datos · **Vercel Blob** para archivos · **auth passwordless OTP + JWT en cookie (con passkeys y vía server-to-server)** ·
> **Web Push (VAPID) + SMTP** para notificaciones · **Claude (Anthropic SDK) con tool-use** como asistente. Todo en un repo, deploy por `git push`.
