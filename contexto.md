# Contexto técnico y funcional de InovaOS

> Fotografía del repositorio tomada el 15 de julio de 2026. Rama `main`, commit analizado `ebf39c2` (`feat: buscador de texto en Pendientes`). El árbol de trabajo estaba limpio antes de crear este documento. No se leyeron ni copiaron secretos de `.env` o `.env.local`.

## 1. Resumen ejecutivo

InovaOS es una PWA móvil, orientada principalmente a iPhone, para capturar, delegar, ejecutar y supervisar pendientes. El producto combina:

- Captura manual o por dictado.
- Delegación con responsables, prioridad, área y fecha compromiso.
- Flujo formal de aceptación, ejecución, evidencia, conclusión y aprobación.
- Tareas personales con cierre simplificado.
- Checklist con asignación de pasos mediante `@menciones`.
- Evidencias en imagen o PDF.
- Historial de actividad.
- Tablero tipo semáforo y métricas por colaborador.
- Notificaciones push, correo y recordatorios diarios.
- Autenticación por código de correo y passkeys/Face ID.
- Asistente de IA que consulta y también puede modificar pendientes mediante herramientas internas.
- Personalización visual por temática y color.

La aplicación es una SPA con Vue 3 y Framework7. El frontend se construye con Vite y se publica en Vercel junto con funciones serverless bajo `/api`. Los datos viven en Turso/libSQL; los archivos, en Vercel Blob; el correo sale por SMTP; las notificaciones usan Web Push/VAPID; y el asistente usa el SDK de Anthropic.

Estado general observado:

- El proyecto compila correctamente para producción.
- El producto ya tiene un flujo funcional amplio y coherente en su camino principal.
- No hay pruebas automatizadas, lint, typecheck ni configuración de CI dentro del repositorio.
- El README quedó atrás respecto de las funciones actuales.
- Hay riesgos relevantes en migraciones, caché PWA, fechas, registro abierto, privacidad de evidencias y consistencia entre la API principal y la IA. Se detallan en la sección de hallazgos.

## 2. Objetivo y usuarios

La descripción del paquete es: “INOVATECH OS — Delegación y seguimiento de pendientes (PWA)”. El README lo presenta como una herramienta para Dirección General, pero el producto también contempla jefes y colaboradores.

Roles almacenados:

- `direccion`
- `jefe`
- `colaborador`

El rol no se usa de manera uniforme:

- En la API normal de pendientes, `direccion` ve únicamente lo creado por esa persona o asignado a ella, igual que cualquier colaborador.
- En métricas, Dirección puede ver a todos los usuarios.
- En el asistente de IA, Dirección puede leer todos los pendientes de la organización.

Esta separación parece deliberada en comentarios del código, pero constituye un modelo de acceso híbrido que conviene validar como decisión formal de producto.

## 3. Arquitectura

```text
Navegador / PWA
  Vue 3 + Framework7 + Vite
  Web Speech / WebAuthn / Push API / Service Worker
            |
            | mismo origen, cookie HttpOnly
            v
Funciones serverless de Vercel (/api/*)
  Auth, permisos, pendientes, checklist, evidencias,
  tablero, métricas, chat, push, correo y cron
       |             |             |              |
       v             v             v              v
  Turso/libSQL   Vercel Blob   SMTP propio   Anthropic API
                                      \
                                       Web Push/VAPID
```

Características arquitectónicas:

- SPA sin renderizado en servidor.
- API y frontend comparten origen; la sesión viaja en una cookie, no en `localStorage`.
- No se usa Pinia/Vuex. Hay un store reactivo mínimo en `src/js/store.js`.
- Las pantallas se mantienen como siete vistas/tabs de Framework7.
- Las funciones serverless acceden directamente a Turso; no hay ORM ni capa de repositorios.
- Las consultas SQL están escritas a mano y, en general, parametrizadas.
- No hay transacciones explícitas para operaciones de varios pasos.
- No existe un proceso formal de migraciones aplicado automáticamente por despliegue.

## 4. Tecnologías y dependencias

### Frontend

| Tecnología | Uso |
|---|---|
| Vue 3 | Componentes y reactividad |
| Framework7 8 + Framework7 Vue | UI móvil con tema iOS, navegación y diálogos |
| Vite 6 | Desarrollo y compilación |
| vite-plugin-pwa | Manifest, precache, service worker y actualización automática |
| Framework7 Icons | Iconografía |
| Web Speech API | Dictado en español de México |
| WebAuthn | Passkeys/Face ID |
| Push API + service worker | Notificaciones nativas |
| Web Audio + Canvas | Celebración con sonido y confeti |

### Backend e infraestructura

| Tecnología | Uso |
|---|---|
| Vercel Functions | API serverless |
| Turso / libSQL / SQLite | Persistencia relacional |
| `jose` | JWT de sesión y token temporal de registro |
| SimpleWebAuthn | Registro y autenticación con passkeys |
| Vercel Blob | Evidencias |
| Nodemailer | OTP, recordatorios y avisos por SMTP |
| `web-push` | Envío de push con VAPID |
| Anthropic SDK | Asistente con tool use |

Versión de la app en `package.json`: `0.1.1`.

El entorno local inspeccionado usa Node `v22.23.1` y npm `10.9.8`, pero `package.json` no declara `engines`. La instalación local contiene numerosas dependencias “extraneous”, principalmente asociadas a Vercel; no forman parte del manifiesto del proyecto y un `npm ci` limpio debería eliminarlas.

Dependencias directas aparentemente no importadas por el código propio: `dom7`, `skeleton-elements` y `swiper`. Pueden ser requisitos históricos o indirectos de Framework7; conviene confirmar antes de retirarlas.

## 5. Estructura del repositorio

```text
api/
  _auth.js              Sesión JWT, OTP y registro
  _db.js                Cliente Turso y helpers
  _ia.js                Herramientas y prompt del asistente
  _mail.js              OTP, recordatorios y avisos por SMTP
  _permisos.js          Autorización de pendientes
  _push.js              Envío de Web Push
  auth/[...ruta].js     Router de autenticación y passkeys
  pendientes/           Lista, creación, detalle, edición y borrado
  checklist/index.js    CRUD de checklist y etiquetado
  evidencias/           Metadatos y eliminación de evidencias
  blob-upload.js        Autorización de carga directa a Vercel Blob
  tablero.js            Semáforo y métricas
  usuarios.js           Directorio y avatar propio
  push.js               Alta/baja de suscripciones
  chat.js               Bucle de IA y ejecución de herramientas
  cron/recordatorios.js Recordatorios programados

migrations/             Esquema inicial, datos y cambios 0001–0009
scripts/migrate.mjs     Ejecutor manual de SQL contra Turso

src/
  App.vue               Arranque, sesión y navegación principal
  main.js               Montaje de Vue/Framework7
  css/app.css           Tema Liquid Glass, auroras y navegación
  js/                   Cliente API y lógica compartida
  pages/                Pantallas de la aplicación

public/                 Iconos y handlers de push del service worker
vite.config.js          Build, PWA, manifest y proxy local
vercel.json             Cron diario
README.md               Documentación de arranque, parcialmente obsoleta
```

También existen localmente `.env`, `.env.local` y `.vercel/`, todos ignorados por Git. `.env.example` sí está versionado.

## 6. Arranque, navegación y estado del frontend

### Arranque

1. `src/main.js` aplica el tema guardado.
2. Inicializa Framework7 con Vue.
3. `App.vue` pregunta a `/api/auth/yo` si la cookie de sesión sigue siendo válida.
4. Mientras espera, muestra un preloader para evitar el parpadeo del login.
5. Si hay sesión, sincroniza una suscripción push ya existente con el usuario actual.
6. Si recibe `401`, limpia el estado y muestra el login.

### Navegación

La barra flotante contiene siete vistas persistentes:

1. Inicio
2. Tareas/Pendientes
3. Métricas
4. Crear
5. Tablero
6. IA
7. Perfil

“Crear” ocupa el centro. La pastilla se oculta dentro de la conversación con IA. Framework7 usa `pushState: false`, así que la navegación no sincroniza rutas con el historial real del navegador.

Rutas:

| Ruta | Pantalla |
|---|---|
| `/` | Inicio |
| `/captura/` | Crear pendiente |
| `/pendientes/` | Lista de pendientes |
| `/pendientes/:id/` | Detalle |
| `/pendientes/:id/editar/` | Edición |
| `/tablero/` | Tablero circular |
| `/metricas/` | Métricas |
| `/asistente/` | Chat de IA |
| `/perfil/` | Perfil y configuración |

### Estado compartido

`src/js/store.js` mantiene:

- Usuario y estado de autenticación.
- Catálogo de usuarios.
- Filtro actual de la lista.
- Un contador `tick` que obliga a recargar pantallas tras cambios.

El último correo usado se guarda en `localStorage` únicamente como comodidad para ofrecer Face ID. Temática y color también se guardan localmente por dispositivo.

## 7. Pantallas y comportamiento

### Login

- Paso 1: correo.
- Paso 2: código OTP de seis dígitos.
- Paso 3: nombre, únicamente si el correo aún no existe.
- Acceso directo con Face ID/passkey si el dispositivo lo permite y existe un último correo recordado.
- Temporizador de 60 segundos antes de reenviar código.

### Inicio

- Saludo con el primer nombre.
- Seis contadores de semáforo.
- Acciones rápidas para crear y abrir el tablero.
- Cinco pendientes “próximos a vencer”, ordenados por fecha.
- Pull-to-refresh.
- El icono de campana no tiene acción asociada actualmente.

### Pendientes

- Búsqueda sin distinguir mayúsculas ni acentos sobre título, descripción, responsable, área, cliente, tipo, prioridad y estatus.
- Segmentos: Todas, Para mí y Yo delegué.
- Categorías de negocio.
- Archivo/desarchivo con swipe.
- Los archivados se cargan de manera perezosa.
- Al buscar se ignora la categoría activa y se busca dentro de la relación seleccionada.

### Captura

- Modo manual o voz.
- Campos: título, descripción, responsable, fecha, prioridad y área.
- Prioridad inicial: Alta.
- Responsable opcional, incluida la opción “Para mí”.
- Si falta fecha, se pregunta si se usa hoy, otra fecha o se guarda sin fecha.
- El dictado usa `es-MX`, coloca la transcripción completa como título e intenta detectar prioridad y fechas como hoy, mañana, pasado mañana, “en N días” o un día de la semana.

### Detalle

- Datos principales, responsable, creador, prioridad, área y fecha.
- Acciones disponibles según estatus y relación con el usuario.
- Checklist editable por creador o responsable.
- Asignación de un paso a otro usuario escribiendo `@`.
- El usuario etiquetado puede marcar su propio paso.
- Evidencias con vista previa para imágenes y enlace para otros archivos.
- Historial cronológico.
- Edición y borrado para el creador.
- Reagendado, comentario de aprobación y motivo de devolución.
- Celebración al concluir/aprobar.

### Tablero y métricas

- Tablero: gráfico circular SVG con los seis colores del semáforo.
- Métricas: total asignado, completados, retrasos abiertos, porcentaje de cumplimiento, tiempo promedio hasta aceptación y evidencias promedio por pendiente completado.
- Dirección ve métricas de todos; otro usuario ve sólo sus métricas.

### Perfil

- Avatar editable, recortado y comprimido a JPEG en el navegador.
- Registro y eliminación de passkeys.
- Activación/desactivación de push.
- Selección independiente de temática y color.
- Versión y build ID.
- “Buscar actualización” borra caches, desregistra service workers y recarga.
- Cierre de sesión.

## 8. Modelo de dominio: pendientes

### Estatus

| Estatus | Significado |
|---|---|
| `capturado` | Creado sin responsable |
| `delegado` | Asignado y esperando aceptación |
| `reagendado` | Responsable propuso otra fecha; vuelve a esperar aceptación |
| `aceptado` | Responsable aceptó |
| `en_progreso` | Trabajo iniciado o devuelto para ajustes |
| `en_espera` | Bloqueado/esperando a un tercero |
| `concluido` | Responsable terminó; creador debe revisar |
| `aprobado` | Cierre definitivo |

Flujo principal:

```text
capturado --asignar--> delegado --aceptar--> aceptado --iniciar--> en_progreso
                              \--reagendar--> reagendado --aceptar--/

en_progreso --poner en espera--> en_espera --retomar--> en_progreso
en_progreso --concluir con evidencia--> concluido --aprobar--> aprobado
                                             \--devolver--> en_progreso
```

### Tareas personales

Si creador y responsable son la misma persona:

- Se crean como `en_progreso` desde la API principal.
- Se pueden cerrar directamente como `aprobado`.
- No requieren evidencia ni revisión de un tercero.

La creación desde la IA no replica exactamente esta regla; se detalla en hallazgos.

### Permisos normales

- Creador: ve, edita, elimina, delega, aprueba y devuelve.
- Responsable: ve, acepta, reagenda, inicia, pone en espera, retoma y concluye.
- Creador o responsable: administran checklist, evidencias y archivo.
- Usuario etiquetado en checklist: el pendiente aparece en su lista, puede abrir el detalle y marcar su ítem; no adquiere permisos generales de edición.
- Un pendiente aprobado ya no se edita.
- La evidencia mínima para concluir se valida tanto en cliente como en servidor, excepto en tareas personales.

### Categorías de la lista

- Atención inmediata: abierto y vencido, vence hoy, prioridad Alta con vencimiento en dos días o menos, o espera aceptación del usuario.
- Vencidos.
- Hoy.
- Próximos siete días.
- En espera.
- Sin fecha.
- Concluidos: incluye `concluido` y `aprobado`.
- Archivados.

Un pendiente puede pertenecer a varias categorías. Los archivados se excluyen del semáforo, métricas y recordatorios.

### Semáforo

| Color lógico | Regla |
|---|---|
| `vencido` | Fecha pasada y no cerrado |
| `hoy` | Vence hoy |
| `manana` | Vence mañana |
| `tiempo` | Más de un día o sin fecha |
| `concluido` | Concluido o aprobado |
| `espera` | En espera |

La clasificación “sin fecha = en tiempo/verde” puede ser engañosa aunque exista una categoría separada “Sin fecha”.

## 9. Modelo de datos

El esquema final resulta de `0001` más las migraciones `0003` a `0009`.

### `usuarios`

- `id`
- `nombre`
- `email` único
- `rol`
- `avatar` como data URL
- `created_at`

### `pendientes`

- Datos: `titulo`, `descripcion`, `cliente`, `tipo`, `prioridad`, `area`, `origen`.
- Relaciones: `creado_por`, `responsable_id`.
- Control: `fecha_compromiso`, `estatus`, `comentario_cierre`, `archivado`.
- Auditoría: `created_at`, `updated_at`.
- Índices por responsable, estatus, fecha y archivado.

### `checklist`

- `pendiente_id`
- `texto`
- `completado`
- `orden`
- `asignado_a`

### `evidencias`

- `pendiente_id`
- `nombre`, `url`, `tipo`, `tamano`, `comentario`
- `subido_por`
- `created_at`

### `historial`

- `pendiente_id`
- `evento`
- `detalle`
- `actor_id`
- `created_at`

### Autenticación

- `codigos_acceso`: hash HMAC del OTP, expiración, intentos y uso.
- `credenciales`: passkeys, llave pública, contador, transports y dispositivo.
- `retos_webauthn`: challenges de registro/login con expiración.

### Notificaciones

- `recordatorios_enviados`: idempotencia por pendiente y tipo.
- `push_subs`: una suscripción por endpoint/dispositivo y usuario.

Las claves foráneas hacia pendientes usan `ON DELETE CASCADE` en varias tablas, pero el borrado de una fila de evidencia no equivale al borrado del archivo externo en Blob.

Datos incluidos en migraciones:

- `0002_seed.sql`: tres usuarios demo, cuatro pendientes y cuatro eventos.
- `0004_usuarios_reales.sql`: siete usuarios de organización, cinco colaboradores y dos de Dirección. Es aditiva mediante `INSERT OR IGNORE`.

## 10. API real

Todas las rutas, salvo la llave pública VAPID y el cron bajo su secreto, están pensadas para mismo origen. Las rutas protegidas usan la cookie de sesión.

### Autenticación

| Método | Ruta | Función |
|---|---|---|
| POST | `/api/auth/solicitar-codigo` | Genera y envía OTP |
| POST | `/api/auth/verificar-codigo` | Valida OTP; inicia sesión o emite token de registro |
| POST | `/api/auth/registrar` | Crea colaborador tras verificar correo |
| GET | `/api/auth/yo` | Devuelve sesión, avatar y número de passkeys |
| POST | `/api/auth/salir` | Borra cookie |
| POST | `/api/auth/passkey/registro/opciones` | Opciones de registro |
| POST | `/api/auth/passkey/registro/verificar` | Guarda passkey |
| POST | `/api/auth/passkey/login/opciones` | Opciones de login |
| POST | `/api/auth/passkey/login/verificar` | Verifica passkey e inicia sesión |
| GET | `/api/auth/passkey/mias` | Lista dispositivos registrados |
| POST | `/api/auth/passkey/eliminar` | Elimina una passkey propia |

### Pendientes y colaboración

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/pendientes` | Lista activos visibles |
| GET | `/api/pendientes?archivados=1` | Lista sólo archivados visibles |
| POST | `/api/pendientes` | Crea pendiente |
| GET | `/api/pendientes/:id` | Detalle, historial, checklist y evidencias |
| PATCH/PUT | `/api/pendientes/:id` | Edita, cambia estatus o archiva |
| DELETE | `/api/pendientes/:id` | Elimina el pendiente |
| GET | `/api/checklist?pendiente_id=:id` | Lista checklist |
| POST | `/api/checklist` | Crea ítem |
| PATCH | `/api/checklist?item=:id` | Edita/asigna/completa ítem |
| DELETE | `/api/checklist?item=:id` | Borra ítem |
| GET | `/api/evidencias?pendiente_id=:id` | Lista evidencias |
| POST | `/api/evidencias` | Registra metadato tras subir archivo |
| DELETE | `/api/evidencias/:id` | Borra registro e intenta borrar Blob |
| POST | `/api/blob-upload` | Autoriza carga directa a Blob |

### Usuarios, tablero y comunicaciones

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/usuarios` | Directorio de usuarios con email, rol y avatar |
| PATCH | `/api/usuarios` | Actualiza avatar propio |
| GET | `/api/tablero` | Semáforo y cinco próximos |
| GET | `/api/tablero?metricas=1` | Métricas por colaborador |
| GET | `/api/push` | Llave pública VAPID |
| POST | `/api/push` | Upsert de suscripción |
| DELETE | `/api/push` | Baja de suscripción propia |
| POST | `/api/chat` | Conversación con el asistente |
| GET | `/api/cron/recordatorios` | Ejecución programada; admite `?dry=1` |

## 11. Autenticación y seguridad implementada

### OTP y registro

- Código criptográficamente aleatorio de seis dígitos.
- Se almacena un HMAC, nunca el código en claro.
- Vigencia: diez minutos.
- Máximo de cinco intentos por código.
- Un envío por minuto por correo.
- Máximo de tres solicitudes en quince minutos por correo.
- Al validar un correo desconocido se emite un JWT de registro de quince minutos.
- El registro es abierto para cualquier correo sintácticamente válido.

### Sesión

- JWT HS256 firmado con `AUTH_SECRET`.
- Duración: 30 días.
- Cookie `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en Vercel.
- El navegador no puede leer el token.
- Un `401` en cualquier endpoint protegido limpia la sesión local.

### Passkeys

- Challenges de cinco minutos y un solo uso.
- Credenciales ligadas al RP ID y origin derivados del request o de variables de entorno.
- Autenticador de plataforma preferido.
- Contador actualizado tras autenticación.
- La verificación del servidor usa `requireUserVerification: false`; por ello técnicamente se exige una passkey válida, pero no se obliga a que el autenticador pruebe biometría/PIN en todos los casos.

### Autorización

- Las reglas decisivas viven en el backend (`api/_permisos.js`).
- Las consultas usan parámetros SQL en los caminos revisados.
- Los recursos no visibles suelen responder `404` para no revelar existencia.
- El autor de un pendiente siempre sale de la sesión, no del body enviado por el cliente.

## 12. Evidencias

Flujo:

1. Cliente valida imagen/PDF y máximo de 15 MB.
2. `/api/blob-upload` comprueba sesión y acceso al pendiente.
3. Navegador sube directamente a Vercel Blob.
4. Cliente registra URL y metadatos en Turso.
5. Se agrega evento al historial.

Tipos aceptados: JPEG, PNG, HEIC/HEIF, WebP, GIF y PDF.

Los blobs se crean con `access: 'public'`. Los permisos de InovaOS protegen el descubrimiento de la URL, pero quien obtenga esa URL puede acceder al archivo sin pasar por la sesión de InovaOS.

## 13. Correo, push y recordatorios

### Correo

- SMTP propio mediante Nodemailer.
- Logo incrustado por CID.
- Plantillas HTML para OTP, recordatorios y avisos libres.
- URL de la app hardcodeada como `https://inovaos.mikne.com.mx`.

### Push en tiempo real

- Web Push con VAPID.
- Una suscripción por endpoint; un usuario puede tener varios dispositivos.
- Al cambiar de sesión en el mismo endpoint, la suscripción se reasigna al usuario actual.
- Suscripciones expiradas se eliminan al recibir `404` o `410` del servicio push.
- Los cambios de estatus notifican a la otra parte.
- Una `@mención` en checklist notifica al usuario etiquetado.
- El asistente puede enviar un aviso por push y correo.

Los payloads usan actualmente `url: '/'`, por lo que una notificación no abre directamente el pendiente involucrado.

### Cron

Vercel ejecuta `/api/cron/recordatorios` a las `14:00 UTC`, aproximadamente 8:00 de Monterrey.

Ventanas de recordatorio:

- Pendiente sin aceptar: todos los días mientras esté `delegado` o `reagendado`.
- Tres, dos y un día antes.
- Día de vencimiento.
- Uno, dos y tres días vencido.

Cada ventana normal se envía una sola vez. Después de tres días vencido ya no hay nuevas ventanas. El cron omite cerrados, archivados, pendientes sin responsable/email y, salvo los que esperan aceptación, pendientes sin fecha.

El endpoint sólo exige autorización si existe `CRON_SECRET`; si la variable falta, queda invocable sin secreto.

## 14. Asistente de IA

Configuración observada:

- SDK: Anthropic.
- Modelo hardcodeado: `claude-haiku-4-5`.
- Máximo de seis rondas de herramientas por mensaje.
- Máximo de 1,024 tokens de salida por ronda.
- Envía al modelo hasta los últimos veinte mensajes visibles.
- Respuestas en español y texto plano, sin Markdown.

El prompt de sistema presenta al bot como “asistente de InovaOS”, creado por Leonardo Lazcano y basado en infraestructura de Mikne. También le ordena no revelar Anthropic, Claude u otro proveedor/modelo externo, aunque el código sí usa explícitamente Anthropic.

Herramientas disponibles:

1. `listar_pendientes`
2. `detalle_pendiente`
3. `listar_usuarios`
4. `clasificar_pendientes`
5. `actualizar_pendiente`
6. `notificar_usuario`
7. `crear_pendiente`
8. `cambiar_estatus`

Las herramientas no dan acceso SQL directo al modelo: el servidor recibe la solicitud, ejecuta SQL parametrizado y aplica permisos. No obstante, la obligación de pedir confirmación antes de crear, editar, notificar o cambiar estatus existe únicamente en el prompt; no hay un token/estado de confirmación validado por el servidor.

Excepciones de acceso de la IA:

- Dirección puede listar, clasificar y consultar cualquier pendiente.
- Usuarios normales sólo acceden a pendientes donde son creador o responsable.
- Los pendientes visibles únicamente por una etiqueta de checklist no se incluyen en el aislamiento de la IA.

## 15. PWA, caché y apariencia

### PWA

- Manifest en español.
- Modo standalone y orientación vertical.
- `viewport-fit=cover` y tratamiento especial de safe areas/notch.
- `registerType: autoUpdate`, `skipWaiting` y `clientsClaim`.
- Limpieza de caches antiguos.
- Iconos 192, 512, maskable y Apple Touch.
- Push integrado al service worker generado mediante `importScripts('/push-sw.js')`.

### Caché

- Assets estáticos se precachean.
- Las rutas `/api/auth/*` quedan fuera del runtime cache.
- El resto de `/api/*` usa `NetworkFirst`, timeout de cinco segundos, máximo de cien entradas y vigencia de cinco minutos.

Esto proporciona tolerancia breve a fallos de red, no una experiencia offline completa. No hay cola de mutaciones ni datos demo reales.

### Apariencia

- Tema iOS “Liquid Glass”.
- Aurora de fondo y navegación flotante.
- Ocho paletas: Aurora, Índigo, Azul, Turquesa, Esmeralda, Atardecer, Rosa y Negro/Grafito.
- Cinco temáticas: ninguna, perritos, equipo de cómputo, fútbol y Fórmula 1.
- Existe CSS para modo oscuro, pero `darkMode` está desactivado y no hay selector de modo oscuro.

## 16. Desarrollo, despliegue y variables de entorno

### Scripts

| Script | Acción real |
|---|---|
| `npm run dev` | Vite en 5173; proxy `/api` a 3000 |
| `npm run build` | Build en `dist` |
| `npm run preview` | Preview de Vite |
| `npm run db:migrate` | Ejecuta sólo `0001_init.sql`, que es destructivo |
| `npm run db:seed` | Ejecuta sólo `0001_init.sql` y `0002_seed.sql`, también destructivo |

Para frontend + API local se requiere `vercel dev --listen 3000` en paralelo con Vite, o ejecutar directamente `vercel dev` como describe el README.

### Variables detectadas

Core:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `AUTH_SECRET`
- `SMTP_HOST`
- `SMTP_PORT` (default 465)
- `SMTP_SECURE` (default `true`)
- `SMTP_USER`
- `SMTP_PASS`

Funciones opcionales o específicas:

- `BLOB_READ_WRITE_TOKEN`
- `ANTHROPIC_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `CRON_SECRET`
- `WEBAUTHN_RP_ID`
- `WEBAUTHN_ORIGIN`
- `WEBAUTHN_RP_NAME`
- `VERCEL` es aportada por la plataforma y activa cookies `Secure`.

`.env.example` contiene únicamente las dos variables de Turso, por lo que no alcanza para iniciar la aplicación completa.

### Despliegue

El README afirma que cada push a `main` despliega automáticamente en Vercel mediante GitHub. El repositorio local apunta a `https://github.com/lazcanomikne/inovaOS.git`; no se verificó el panel remoto de Vercel ni sus variables.

## 17. Verificación realizada

Comando ejecutado:

```bash
npm run build
```

Resultado: exitoso.

- 459 módulos transformados.
- CSS minificado: 563.71 kB, 84.13 kB gzip.
- JavaScript minificado: 1,136.93 kB, 318.89 kB gzip.
- Precache PWA: 19 entradas, aproximadamente 2.03 MiB.
- Vite advierte que existe un chunk superior a 500 kB.

No se ejecutaron pruebas porque el proyecto no contiene archivos ni script de pruebas. Tampoco hay scripts de lint, formato, typecheck o auditoría.

## 18. Hallazgos y riesgos priorizados

### Prioridad crítica/alta

#### 1. El proceso de migración no construye el esquema actual y puede destruir datos

- `db:migrate` sólo ejecuta `0001_init.sql`.
- `db:seed` sólo ejecuta `0001` y `0002`.
- Ninguno aplica `0003`–`0009` automáticamente.
- `0001` hace `DROP TABLE` de las tablas principales.
- Seguir el README en una base nueva deja fuera autenticación, passkeys, recordatorios, push, autor de evidencia, asignación de checklist y archivo; el login fallaría al no existir `codigos_acceso`.
- Ejecutar `db:migrate` en una base existente puede borrar negocio y dejar tablas auxiliares/referencias en estado inconsistente.
- No existe tabla de migraciones aplicadas ni una estrategia transaccional/idempotente.

Recomendación: reemplazar los scripts por un runner incremental que aplique todas las migraciones pendientes, registrar versiones y separar claramente `reset/seed` destructivo de `migrate` no destructivo.

#### 2. El service worker cachea respuestas autenticadas sin separar usuarios

`NetworkFirst` guarda `/api/pendientes`, `/api/tablero`, `/api/usuarios`, etc. bajo la URL, sin que la cookie forme parte de la clave. La caché tampoco se limpia al cerrar sesión. En un dispositivo compartido, un segundo usuario podría recibir como fallback offline/timeout una respuesta cacheada del usuario anterior.

Recomendación: usar `NetworkOnly` para datos protegidos o implementar una caché explícitamente asociada al usuario y purgarla en login/logout.

#### 3. Fechas `YYYY-MM-DD` se desplazan un día en Monterrey

`src/js/pendientes.js` usa `new Date('YYYY-MM-DD')` y luego `setHours(0,0,0,0)`. JavaScript interpreta esa cadena como UTC. Verificación realizada con `TZ=America/Monterrey`:

```text
entrada: 2026-07-15
fecha local resultante: 2026-07-14
```

Esto puede alterar semáforo, texto “vence…”, categorías y acciones de fecha. Además, varias pantallas obtienen “hoy” con `new Date().toISOString().slice(0,10)`, que cambia al día siguiente a partir de las 18:00 locales en UTC-6.

Recomendación: tratar fechas de negocio como fecha local pura, parseando componentes (`new Date(año, mes-1, día)`) o usando una utilidad central con zona `America/Monterrey`.

#### 4. Registro abierto y directorio completo para cualquier cuenta autenticada

Cualquier correo válido puede recibir OTP y crear una cuenta `colaborador`. No hay allowlist de dominio, invitación ni aprobación. Después, cualquier usuario autenticado puede obtener nombres, correos, roles y avatares de todo el directorio, crear pendientes para otros y provocar notificaciones.

Si InovaOS es interno, esto requiere allowlist/invitaciones y límites adicionales por IP/usuario, no sólo por correo.

#### 5. Evidencias públicas

Los archivos se crean con acceso público. Un enlace filtrado evita completamente los permisos de la aplicación. Esto es especialmente relevante si las evidencias contienen información de clientes, contratos o datos personales.

Recomendación: blobs privados o un proxy autenticado con URLs firmadas y corta vigencia.

#### 6. Sesiones de 30 días conservan nombre y rol del JWT

Los endpoints confían en `rol`, `nombre` y `email` embebidos en el JWT. `/api/auth/yo` sólo vuelve a leer el avatar. Una baja o cambio de rol no se refleja hasta renovar/expirar la cookie; una persona removida de Dirección podría conservar durante ese plazo el acceso ampliado de métricas e IA.

Recomendación: resolver el usuario actual en base de datos para cada sesión o usar versión/revocación de sesión.

### Prioridad media

#### 7. Confirmación de acciones de IA no se valida en servidor

Crear, editar, cambiar estatus y enviar avisos dependen de que el modelo obedezca el prompt “¿Lo confirmo?”. No hay estado firmado que pruebe que la persona confirmó. Una mala interpretación o prompt injection podría ejecutar una mutación.

Recomendación: devolver una propuesta estructurada y exigir un segundo request de confirmación con ID/nonce antes de ejecutar.

#### 8. Diferencias entre IA y API principal

- Dirección ve todo en IA, pero no en pendientes normales.
- La IA no contempla visibilidad por etiqueta de checklist.
- `listar_pendientes` de IA no excluye archivados por defecto.
- La IA crea una tarea asignada al propio creador como `delegado`; la API principal la crea `en_progreso`.
- La IA exige evidencia al concluir incluso una tarea personal; la API principal la exenta.
- La asignación desde IA no replica exactamente los eventos de historial de la API normal.

Recomendación: centralizar reglas de dominio en funciones compartidas del backend y reutilizarlas desde endpoints y herramientas de IA.

#### 9. Operaciones de varios pasos sin transacción

Crear/editar un pendiente, escribir historial y enviar notificación son operaciones separadas. Si falla un paso intermedio pueden quedar cambios sin historial o historial parcial. Lo mismo aplica a algunos flujos de checklist y evidencia.

Recomendación: usar transacciones o `batch` atómico para cambios de base; tratar notificaciones con outbox/reintentos fuera de la transacción.

#### 10. Posibles blobs huérfanos

- Si la subida directa termina pero falla el registro del metadato, el archivo queda sin referencia.
- Al borrar un pendiente, el `DELETE` en cascada elimina filas de evidencias, pero no llama a Vercel Blob para borrar los archivos.
- Al borrar una evidencia individual, si `del()` falla se borra de todos modos la fila y el blob queda huérfano.

Recomendación: job de conciliación, borrado explícito previo del conjunto de URLs y registro de reintentos.

#### 11. Passkeys no obligan a user verification

El autenticador de plataforma se prefiere, pero las verificaciones usan `requireUserVerification: false`. La etiqueta “Face ID” es más fuerte que la garantía técnica actual.

Recomendación: establecer `userVerification: 'required'` y `requireUserVerification: true` si el producto realmente exige biometría/PIN.

#### 12. `CRON_SECRET` es opcional en la validación

Si la variable no está configurada, cualquiera que conozca la ruta puede disparar envíos y escrituras de idempotencia.

Recomendación: fallar con `500/503` si no existe el secreto y aceptar únicamente el bearer exacto.

#### 13. HTML de recordatorios sin escape uniforme

Título, descripción, nombres y otros campos se interpolan directamente en la plantilla HTML de recordatorios. El aviso libre sí escapa texto, pero los recordatorios y parte del OTP no aplican el mismo helper.

Recomendación: escapar todos los datos de usuario antes de insertarlos en HTML.

#### 14. Validación de entrada limitada

El backend valida presencia de algunos campos, pero no hay esquemas formales ni límites generales para títulos, descripciones, fechas, prioridad, área, IDs o contenido del avatar. Vue evita XSS en texto visible, pero los datos también llegan a correos e integraciones.

Recomendación: validación por esquema en todos los endpoints y herramientas.

#### 15. Semántica de métricas

- “Cumplimiento” es `completados / total asignado`, no cumplimiento en fecha.
- “Calidad de evidencia” es número promedio de archivos, no una medida de calidad.
- “Retrasos” cuenta abiertos actualmente vencidos.

Los nombres pueden inducir interpretaciones gerenciales más fuertes que el cálculo real.

### Prioridad baja / deuda técnica

#### 16. README incompleto u obsoleto

- Afirma que hay datos demo si el API falla, pero no existe ese fallback.
- Documenta `?responsable_id=` aunque el endpoint no usa ese filtro.
- Documenta checklist como `/api/checklist/:itemId`, pero el código usa `?item=:id`.
- No incluye auth, passkeys, evidencias, Blob, push, chat, métricas, cron ni archivo.
- Indica un procedimiento de seed que no aplica el esquema actual.

#### 17. `.env.example` incompleto

Sólo incluye Turso. Faltan auth, SMTP y todas las integraciones opcionales.

#### 18. Bundle grande y sin code splitting de rutas

Todas las páginas se importan de forma estática y se registra el bundle amplio de Framework7. La compilación genera un JS minificado de aproximadamente 1.14 MB y Vite advierte por chunks mayores a 500 kB.

#### 19. Sin suite de calidad automatizada

No existen pruebas unitarias, integración/E2E, lint, formato, typecheck ni workflow de CI. Las reglas de fechas, permisos y transiciones son candidatas especialmente importantes para tests.

#### 20. Manejo de métodos en `/api/usuarios`

Cualquier método distinto de `PATCH` termina devolviendo el listado, en lugar de limitarse explícitamente a `GET` y responder `405` al resto.

#### 21. Avatares en la tabla y en el directorio

Cada avatar puede ocupar hasta unas 400,000 letras y `/api/usuarios` devuelve todos los avatares junto al directorio. El payload crecerá linealmente y se solicita desde varias pantallas.

#### 22. Enlaces y configuración hardcodeados

- Los correos apuntan siempre a `https://inovaos.mikne.com.mx`.
- Las push abren `/` y no el detalle.
- El modelo de IA está fijado en código.
- La zona horaria usa desplazamiento fijo UTC-6 en backend, no un identificador IANA.

#### 23. “En tiempo” incluye pendientes sin fecha

La categoría “Sin fecha” los hace visibles en la lista, pero el tablero los pinta verdes. Conviene crear un color/contador independiente o excluirlos del semáforo positivo.

## 19. Fortalezas observadas

- Separación clara entre helpers de auth, permisos, correo, push e IA.
- Cookie HttpOnly y códigos OTP almacenados como HMAC.
- SQL parametrizado en las rutas revisadas.
- El creador real siempre se toma de la sesión.
- El backend vuelve a validar permisos y evidencia; no confía sólo en la UI.
- Respuestas `404` para recursos ajenos reducen filtración de existencia.
- Cargas de archivo limitadas por tipo y tamaño tanto en cliente como al generar token.
- Limpieza automática de suscripciones push expiradas.
- Idempotencia explícita de recordatorios.
- Archivo excluido de tablero, métricas y cron.
- Historial de cambios y autor de evidencia.
- Buen tratamiento móvil de safe areas, teclado visual, PWA instalada y feedback optimista.
- La compilación de producción está funcional.

## 20. Orden sugerido de trabajo

1. Reparar el sistema de migraciones y actualizar la guía de instalación.
2. Corregir todas las fechas con una utilidad única y tests en `America/Monterrey`.
3. Dejar de cachear respuestas autenticadas o separar/purgar caché por usuario.
4. Definir política de acceso: registro, directorio, Dirección, IA y checklist etiquetado.
5. Proteger evidencias y resolver limpieza de blobs.
6. Revalidar usuario/rol de sesiones y endurecer passkeys/cron.
7. Centralizar reglas de pendientes para que API e IA compartan la misma implementación.
8. Añadir transacciones/outbox y validación por esquema.
9. Crear tests para permisos, transiciones, fechas, categorías, migraciones y herramientas de IA.
10. Actualizar README y `.env.example`; después optimizar bundle y deuda de UI.

## 21. Mapa rápido de archivos clave

| Tema | Archivo principal |
|---|---|
| Arranque y sesión visual | `src/App.vue` |
| Cliente HTTP | `src/js/api.js` |
| Reglas frontend de pendientes | `src/js/pendientes.js` |
| Estado compartido | `src/js/store.js` |
| Voz | `src/js/voz.js` |
| Push cliente | `src/js/push.js` |
| Passkeys cliente | `src/js/passkey.js` |
| Evidencias cliente | `src/js/evidencias.js` |
| Estilos globales | `src/css/app.css` |
| Base de datos | `api/_db.js` |
| Sesión y OTP | `api/_auth.js` |
| Autorización | `api/_permisos.js` |
| Pendientes | `api/pendientes/index.js`, `api/pendientes/[id].js` |
| IA | `api/chat.js`, `api/_ia.js` |
| Correo | `api/_mail.js` |
| Push servidor | `api/_push.js`, `api/push.js` |
| Cron | `api/cron/recordatorios.js` |
| Esquema | `migrations/*.sql` |
| Migración manual | `scripts/migrate.mjs` |
| PWA/build | `vite.config.js`, `public/push-sw.js` |

---

Este documento describe el código y la configuración presentes en el repositorio; no valida datos reales de producción, variables secretas, entregabilidad SMTP, llaves VAPID, contenido de Turso, almacenamiento Blob, configuración del proyecto Vercel ni comportamiento del proveedor de IA en producción.
