-- Datos de ejemplo

INSERT INTO usuarios (nombre, email, rol) VALUES
  ('Carolina G.', 'carolina@inovatech.mx', 'direccion'),
  ('Carlos Narváez', 'carlos@inovatech.mx', 'colaborador'),
  ('Ana López', 'ana@inovatech.mx', 'colaborador');

INSERT INTO pendientes (titulo, descripcion, prioridad, area, origen, creado_por, responsable_id, fecha_compromiso, estatus) VALUES
  ('Cotizar Mahle Audio', 'Cotización para viernes con proveedor.', 'Alta', 'Ventas', 'voz', 1, 2, date('now','+1 day'), 'en_progreso'),
  ('Enviar propuesta cliente Norte', 'Propuesta comercial trimestral.', 'Media', 'Ventas', 'correo', 1, 3, date('now'), 'aceptado'),
  ('Revisar contrato proveedor', 'Validar cláusulas de servicio.', 'Alta', 'Compras', 'manual', 1, 2, date('now','-1 day'), 'delegado'),
  ('Cierre mensual de ventas', 'Consolidar reporte de junio.', 'Baja', 'Finanzas', 'manual', 1, 1, date('now','-2 day'), 'aprobado');

INSERT INTO historial (pendiente_id, evento, detalle, actor_id) VALUES
  (1, 'Creado', 'por Carolina G.', 1),
  (1, 'Delegado', 'a Carlos Narváez', 1),
  (1, 'Aceptado', 'Carlos aceptó', 2),
  (1, 'Solicitó información', 'al proveedor', 2);
