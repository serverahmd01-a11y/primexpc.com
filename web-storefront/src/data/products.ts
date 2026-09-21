import type { Product } from '@/types';
import { productApi, categoryApi } from '@/lib/api';

export async function fetchProducts(): Promise<Product[]> {
  try {
    return await productApi.getAll();
  } catch {
    return [];
  }
}

export async function fetchProductById(id: string): Promise<Product | null> {
  try {
    return await productApi.getById(id);
  } catch {
    return null;
  }
}

export async function fetchCategories(condition: string): Promise<string[]> {
  try {
    const data = await categoryApi.getAll(condition);
    const arr = Array.isArray(data) ? data : [];
    return arr.filter((c: { parent: unknown }) => !c.parent).map((c: { name: string }) => c.name);
  } catch {
    return [];
  }
}

export async function fetchFeaturedProducts(): Promise<Product[]> {
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/products/public/featured`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
