// Tipos TypeScript para la base de datos

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  size: string;
  current_stock: number;
  created_at: string;
}

export interface StockMovement {
  id: string;
  variant_id: string;
  type: 'in' | 'out';
  quantity: number;
  stock_after: number;
  notes: string | null;
  user_id: string;
  created_at: string;
}

export interface ProductWithVariants extends Product {
  variants: ProductVariant[];
}
