-- =============================================================================
-- WhatsApp Admin RPC
-- -----------------------------------------------------------------------------
-- Ejecuta en Supabase → SQL Editor → New query → Run.
-- No hace DROP de tablas; es seguro correr sobre datos existentes.
-- Requisito: schema.sql ya ejecutado.
-- =============================================================================

CREATE OR REPLACE FUNCTION register_stock_movement_admin(
  p_variant_id UUID,
  p_type       VARCHAR,
  p_quantity   INTEGER,
  p_notes      TEXT DEFAULT NULL,
  p_user_id    UUID DEFAULT NULL
)
RETURNS stock_movements
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_variant   product_variants%ROWTYPE;
  v_owner     UUID;
  v_new_stock INTEGER;
  v_movement  stock_movements;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id es requerido';
  END IF;
  IF p_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'type debe ser "in" o "out"';
  END IF;
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity debe ser mayor a 0';
  END IF;

  SELECT * INTO v_variant FROM product_variants WHERE id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variante no encontrada';
  END IF;

  SELECT user_id INTO v_owner FROM products WHERE id = v_variant.product_id;
  IF v_owner <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_type = 'in' THEN
    v_new_stock := v_variant.current_stock + p_quantity;
  ELSE
    v_new_stock := v_variant.current_stock - p_quantity;
    IF v_new_stock < 0 THEN
      RAISE EXCEPTION 'Stock insuficiente (disponible: %, solicitado: %)',
        v_variant.current_stock, p_quantity;
    END IF;
  END IF;

  UPDATE product_variants SET current_stock = v_new_stock WHERE id = p_variant_id;

  INSERT INTO stock_movements (variant_id, type, quantity, stock_after, notes, commission, user_id)
  VALUES (p_variant_id, p_type, p_quantity, v_new_stock, p_notes, 0, p_user_id)
  RETURNING * INTO v_movement;

  RETURN v_movement;
END;
$$;

-- Solo service_role puede invocar esta función
REVOKE EXECUTE ON FUNCTION register_stock_movement_admin(UUID, VARCHAR, INTEGER, TEXT, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION register_stock_movement_admin(UUID, VARCHAR, INTEGER, TEXT, UUID) TO service_role;
