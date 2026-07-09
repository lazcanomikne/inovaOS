# INOVATECH OS

PWA de **delegación y seguimiento de pendientes** para dirección general.

- **Front:** Framework7 v8 + Vue 3 + Vite (tema iOS, estilo *liquid glass*)
- **Back:** Funciones serverless de **Vercel** en `/api/*` — mismas rutas que el front
- **DB:** **Turso** (libSQL / SQLite en la nube, free tier)
- **PWA:** `vite-plugin-pwa` con `autoUpdate` → se actualiza sin reinstalar

## Puesta en marcha (local)

```bash
npm install

# 1) Crear la base en Turso (una sola vez)
turso db create inovaos
turso db show inovaos --url          # → TURSO_DATABASE_URL
turso db tokens create inovaos       # → TURSO_AUTH_TOKEN

# 2) Copiar credenciales
cp .env.example .env                 # y pega URL + token

# 3) Aplicar esquema + datos de ejemplo
npm run db:seed

# 4a) Solo front (usa datos demo si el API no responde)
npm run dev                          # http://localhost:5173

# 4b) Front + API juntos (como en producción)
npm i -g vercel
vercel dev                           # http://localhost:3000
```

## Despliegue en Vercel

El repo está conectado a Vercel vía GitHub: **cada push a `main` despliega solo**.

1. En Vercel → **Settings → Environment Variables**, agrega:
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
2. Aplica el esquema en la base de producción (una vez): `npm run db:seed`
3. `git push` → Vercel construye (`vite build` → `dist`) y publica el front + las funciones `/api`.

## Estructura

```
api/                   # BACKEND (funciones Vercel, mismas rutas)
  _db.js                 cliente Turso + helpers
  pendientes/index.js    GET lista · POST crear/delegar
  pendientes/[id].js     GET detalle+historial · PATCH · DELETE
  tablero.js             GET semáforo + próximos
  usuarios.js
migrations/            # Esquema (0001) y seed (0002) SQLite/libSQL
scripts/migrate.mjs    # Aplica migraciones a Turso
src/
  pages/               # Home · Captura · Pendientes · Detalle · Tablero · Perfil
  css/app.css          # Capa liquid glass
  js/                  # routes · api client
```

## Endpoints API
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/pendientes` | Lista (filtro `?responsable_id=`) |
| POST | `/api/pendientes` | Crear / delegar |
| GET | `/api/pendientes/:id` | Detalle + historial |
| PATCH | `/api/pendientes/:id` | Actualizar / cambiar estatus |
| DELETE | `/api/pendientes/:id` | Eliminar |
| GET | `/api/tablero` | Semáforo + próximos |
| GET | `/api/usuarios` | Usuarios |
