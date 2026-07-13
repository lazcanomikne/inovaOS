-- Quién subió cada evidencia (para la trazabilidad). No destructivo.
-- SQLite no permite IF NOT EXISTS en ADD COLUMN; si ya existe, este archivo
-- simplemente fallaría en esa línea (idempotencia manual: correr una vez).
ALTER TABLE evidencias ADD COLUMN subido_por INTEGER REFERENCES usuarios(id);
