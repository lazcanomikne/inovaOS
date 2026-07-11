-- Usuarios reales de INOVATECH. Additivo e idempotente: INSERT OR IGNORE
-- no toca nada existente (email es UNIQUE). Volver a correrlo no duplica.

INSERT OR IGNORE INTO usuarios (nombre, email, rol) VALUES
  ('Eduardo Gómez',    'eduardo.gomez@inovatech.com.mx',     'colaborador'),
  ('Elvis Martínez',   'elvis.martinez@inovatech.com.mx',    'colaborador'),
  ('Noé Cruz',         'noe.cruz@inovatech.com.mx',          'colaborador'),
  ('Carolina Guajardo','carolina.guajardo@inovatech.com.mx', 'direccion'),
  ('Leonardo Lazcano', 'lazcano@ekontech.com',               'direccion'),
  ('Gabriel Oviedo',   'gabriel.oviedo@inovatech.com.mx',    'colaborador'),
  ('Alan Rodríguez',   'alan.rodriguez@inovatech.com.mx',    'colaborador');
