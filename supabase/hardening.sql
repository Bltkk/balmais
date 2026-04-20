-- =============================================================================
-- Hardening de Supabase — correr DESPUÉS de schema.sql
-- -----------------------------------------------------------------------------
-- Este script agrega restricciones adicionales de integridad y cierra
-- permisos sueltos. Es idempotente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Validaciones extra de datos (CHECK constraints)
-- -----------------------------------------------------------------------------

-- Código de producto: no vacío, alfanumérico + guiones, máximo 50 chars
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_code_format;
ALTER TABLE products ADD CONSTRAINT products_code_format
  CHECK (code ~ '^[A-Za-z0-9-]+$' AND length(code) BETWEEN 1 AND 50);

-- Nombre de producto: no vacío ni sólo espacios
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_name_not_blank;
ALTER TABLE products ADD CONSTRAINT products_name_not_blank
  CHECK (length(btrim(name)) > 0);

-- Precio con tope razonable (evita overflow o typos extremos)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_max;
ALTER TABLE products ADD CONSTRAINT products_price_max
  CHECK (price <= 99999999.99);

-- Talla: no vacía, máximo 20 chars (ya aplicado por tipo VARCHAR(20),
-- pero agregamos el chequeo de no-vacío)
ALTER TABLE product_variants DROP CONSTRAINT IF EXISTS variants_size_not_blank;
ALTER TABLE product_variants ADD CONSTRAINT variants_size_not_blank
  CHECK (length(btrim(size)) > 0);

-- Cantidad de movimiento: tope razonable
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS movements_quantity_max;
ALTER TABLE stock_movements ADD CONSTRAINT movements_quantity_max
  CHECK (quantity <= 1000000);

-- Notas: máximo 500 chars para evitar abuso de storage
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS movements_notes_len;
ALTER TABLE stock_movements ADD CONSTRAINT movements_notes_len
  CHECK (notes IS NULL OR length(notes) <= 500);

-- -----------------------------------------------------------------------------
-- 2. Revocar permisos que Supabase otorga por defecto al rol `anon`
-- -----------------------------------------------------------------------------
-- `anon` es el rol del usuario no autenticado. Con RLS activo no puede
-- leer nada, pero igual le cortamos el acceso a nivel GRANT para defensa
-- en profundidad: si alguna policy futura tiene un bug, esto lo contiene.

REVOKE ALL ON products         FROM anon;
REVOKE ALL ON product_variants FROM anon;
REVOKE ALL ON stock_movements  FROM anon;
REVOKE EXECUTE ON FUNCTION register_stock_movement FROM anon;

-- `authenticated` (usuario logueado) sí necesita permisos + RLS filtra
GRANT SELECT, INSERT, UPDATE, DELETE ON products         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON product_variants TO authenticated;
GRANT SELECT, INSERT                 ON stock_movements  TO authenticated;
GRANT EXECUTE ON FUNCTION register_stock_movement TO authenticated;

-- -----------------------------------------------------------------------------
-- 3. Forzar que register_stock_movement sea el único camino para
--    modificar stock_movements (ya lo es, pero dejamos explícito que
--    authenticated NO puede UPDATE ni DELETE movimientos — sólo INSERT
--    vía la RPC)
-- -----------------------------------------------------------------------------
REVOKE UPDATE, DELETE ON stock_movements FROM authenticated;

-- -----------------------------------------------------------------------------
-- 4. Índice auxiliar para performance de RLS en movimientos
--    Las policies de stock_movements hacen JOIN a product_variants → products.
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_user_id_rls ON products(user_id);
