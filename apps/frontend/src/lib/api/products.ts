import api from './client';
import { cleanParams, type Paged } from './clients';

export type StockMovementType = 'IN' | 'OUT' | 'USE' | 'LOSS' | 'ADJUST' | 'SALE' | 'RETURN';

export const MOVEMENT_LABEL: Record<string, string> = {
  IN: 'Entrada',
  OUT: 'Saída',
  USE: 'Uso interno',
  LOSS: 'Perda',
  ADJUST: 'Ajuste de saldo',
  SALE: 'Venda',
  RETURN: 'Devolução',
};

export interface ProductCategory {
  id: string;
  name: string;
  _count?: { products: number };
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  sku: string | null;
  barcode: string | null;
  brand: string | null;
  unit: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  expiresAt: string | null;
  commissionPct: number | null;
  forSale: boolean;
  forInternalUse: boolean;
  imageUrl: string | null;
  loyaltyPoints: number | null;
  isActive: boolean;
  lowStock?: boolean;
  stockValue?: number;
}

export interface ProductInput {
  name: string;
  description?: string;
  categoryId?: string | null;
  sku?: string;
  barcode?: string;
  brand?: string;
  unit?: string;
  costPrice?: number;
  salePrice: number;
  stock?: number;
  minStock?: number;
  expiresAt?: string | null;
  commissionPct?: number | null;
  forSale?: boolean;
  forInternalUse?: boolean;
  loyaltyPoints?: number | null;
  isActive?: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  product: { id: string; name: string; unit: string };
  type: StockMovementType;
  quantity: number;
  unitCost: number | null;
  balanceAfter: number;
  reason: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface MovementInput {
  type: 'IN' | 'OUT' | 'USE' | 'LOSS' | 'ADJUST';
  quantity: number;
  unitCost?: number;
  reason?: string;
  updateCost?: boolean;
}

export interface InventoryRow {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
  costPrice: number;
  salePrice: number;
  stockValue: number;
  saleValue: number;
  lowStock: boolean;
  expiresAt: string | null;
  expiringSoon: boolean;
  expired: boolean;
}

export interface Inventory {
  items: InventoryRow[];
  totals: { products: number; stockValue: number; saleValue: number; lowStock: number; expiringSoon: number };
}

export const productsApi = {
  list: (p: { search?: string; categoryId?: string; lowStock?: boolean; includeInactive?: boolean; page?: number; limit?: number }) =>
    api
      .get<Paged<Product>>('/products', { params: cleanParams({ ...p, lowStock: p.lowStock ? 'true' : undefined, includeInactive: p.includeInactive ? 'true' : undefined }) })
      .then((r) => r.data),
  create: (d: ProductInput) => api.post<Product>('/products', d).then((r) => r.data),
  update: (id: string, d: Partial<ProductInput>) => api.patch<Product>(`/products/${id}`, d).then((r) => r.data),
  remove: (id: string) => api.delete(`/products/${id}`).then((r) => r.data),
  move: (id: string, d: MovementInput) => api.post<Product>(`/products/${id}/movements`, d).then((r) => r.data),
  movements: (p: { productId?: string; from?: string; to?: string; type?: string; page?: number; limit?: number }) =>
    api.get<Paged<StockMovement>>('/products/movements', { params: cleanParams(p) }).then((r) => r.data),
  inventory: () => api.get<Inventory>('/products/inventory').then((r) => r.data),
  categories: () => api.get<ProductCategory[]>('/products/categories').then((r) => r.data),
  createCategory: (name: string) => api.post<ProductCategory>('/products/categories', { name }).then((r) => r.data),
  updateCategory: (id: string, name: string) => api.patch<ProductCategory>(`/products/categories/${id}`, { name }).then((r) => r.data),
  removeCategory: (id: string) => api.delete(`/products/categories/${id}`).then((r) => r.data),
};
