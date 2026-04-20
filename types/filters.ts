// Tipos para filtros

export interface ProductFilters {
  search?: string;
  sortBy?: 'code' | 'name' | 'price' | 'stock';
  sortOrder?: 'asc' | 'desc';
}

export interface StockHistoryFilters {
  dateFrom?: Date;
  dateTo?: Date;
  type?: 'in' | 'out';
}
