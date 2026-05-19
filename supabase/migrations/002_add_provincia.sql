-- Agregar columna provincia a la tabla clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia TEXT;

-- Actualizar índice de búsqueda para incluir provincia
CREATE INDEX IF NOT EXISTS idx_clientes_provincia ON clientes(tenant_id, provincia);
