-- Etiquetar (taguear) a un usuario en un ítem del checklist.
-- Cuando un ítem tiene asignado_a, ese pendiente le aparece al usuario etiquetado
-- y puede marcar su ítem como completado.
ALTER TABLE checklist ADD COLUMN asignado_a INTEGER REFERENCES usuarios(id);
CREATE INDEX IF NOT EXISTS idx_checklist_asignado ON checklist(asignado_a);
