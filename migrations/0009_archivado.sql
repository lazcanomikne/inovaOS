-- Archivar pendientes: se ocultan de la lista y NO cuentan en el semáforo ni
-- las métricas; es solo para reducir ruido. Se pueden ver aparte y desarchivar.
ALTER TABLE pendientes ADD COLUMN archivado INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_pendientes_archivado ON pendientes(archivado);
