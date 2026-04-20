// Tipos para formularios

export interface ProductFormData {
  code: string;
  name: string;
  description?: string;
  price: number;
}

export interface StockMovementData {
  type: 'in' | 'out';
  quantity: number;
  notes?: string;
}
