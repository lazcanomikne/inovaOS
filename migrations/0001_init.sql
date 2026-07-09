-- INOVATECH OS · Esquema inicial (Cloudflare D1 / SQLite)

DROP TABLE IF EXISTS historial;
DROP TABLE IF EXISTS evidencias;
DROP TABLE IF EXISTS checklist;
DROP TABLE IF EXISTS pendientes;
DROP TABLE IF EXISTS usuarios;

CREATE TABLE usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  email TEXT UNIQUE,
  rol TEXT DEFAULT 'colaborador',      -- direccion | jefe | colaborador
  avatar TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE pendientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  cliente TEXT,
  tipo TEXT,
  prioridad TEXT DEFAULT 'Media',       -- Alta | Media | Baja
  area TEXT,
  origen TEXT DEFAULT 'manual',         -- manual | voz | correo | whatsapp
  creado_por INTEGER REFERENCES usuarios(id),
  responsable_id INTEGER REFERENCES usuarios(id),
  fecha_compromiso TEXT,                -- ISO date
  estatus TEXT DEFAULT 'delegado',      -- capturado|delegado|aceptado|en_progreso|en_espera|concluido|aprobado|reagendado
  comentario_cierre TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pend_responsable ON pendientes(responsable_id);
CREATE INDEX idx_pend_estatus ON pendientes(estatus);
CREATE INDEX idx_pend_fecha ON pendientes(fecha_compromiso);

CREATE TABLE checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pendiente_id INTEGER NOT NULL REFERENCES pendientes(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  completado INTEGER DEFAULT 0,
  orden INTEGER DEFAULT 0
);

CREATE TABLE evidencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pendiente_id INTEGER NOT NULL REFERENCES pendientes(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  url TEXT,                              -- clave en R2
  tipo TEXT,
  tamano INTEGER,
  comentario TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pendiente_id INTEGER NOT NULL REFERENCES pendientes(id) ON DELETE CASCADE,
  evento TEXT NOT NULL,
  detalle TEXT,
  actor_id INTEGER REFERENCES usuarios(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_hist_pend ON historial(pendiente_id);
