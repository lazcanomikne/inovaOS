-- Registro de recordatorios ya enviados, para no repetir el mismo aviso.
-- Un pendiente recibe cada tipo (3dias, 1dia, hoy, vencido24...) una sola vez.
CREATE TABLE IF NOT EXISTS recordatorios_enviados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pendiente_id INTEGER NOT NULL REFERENCES pendientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  enviado_a TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (pendiente_id, tipo)
);
CREATE INDEX IF NOT EXISTS idx_recordatorios_pend ON recordatorios_enviados(pendiente_id);
