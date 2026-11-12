import { apiRequest } from "./api";
import type {
  Category,
  Product,
  ProductPage,
  ProductGroupPage,
  ProductStatus,
} from "../types/product";
export type ProductInput = Omit<
  Product,
  | "id"
  | "category"
  | "images"
  | "createdAt"
  | "updatedAt"
  | "costPrice"
  | "purchasePrice"
> & { costPrice?: string | null; purchasePrice?: string | null };
export type ProductRemovalCheck = {
  allowed: boolean;
  reason: string | null;
  reasons: string[];
  message: string | null;
  kits: { id: string; sku: string; name: string }[];
};
export const productService = {
  removalCheck: (id: string) =>
    apiRequest<ProductRemovalCheck>(`/products/${id}/removal-check`),
  remove: (id: string) =>
    apiRequest<void>(`/products/${id}`, { method: "DELETE" }),
  list: (query: URLSearchParams) =>
    apiRequest<ProductPage>(`/products?${query}`),
  listGrouped: (query: URLSearchParams) =>
    apiRequest<ProductGroupPage>(`/products/groups?${query}`),
  get: (id: string) => apiRequest<Product>(`/products/${id}`),
  create: (data: Partial<ProductInput>) =>
    apiRequest<Product>("/products", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<ProductInput>) =>
    apiRequest<Product>(`/products/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  status: (id: string, status: ProductStatus) =>
    apiRequest<Product>(`/products/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  images: (id: string) =>
    apiRequest<import("../types/product").ProductImage[]>(
      `/products/${id}/images`,
    ),
  image: (productId: string, imageId: string) =>
    apiRequest<Blob>(`/products/${productId}/images/${imageId}/file`),
  upload: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return apiRequest(`/products/${id}/images`, { method: "POST", body });
  },
  primary: (id: string, imageId: string) =>
    apiRequest(`/products/${id}/images/${imageId}/primary`, {
      method: "PATCH",
    }),
  removeImage: (id: string, imageId: string) =>
    apiRequest<void>(`/products/${id}/images/${imageId}`, { method: "DELETE" }),
  categories: () => apiRequest<Category[]>("/product-categories"),
  createCategory: (data: { name: string; description?: string }) =>
    apiRequest<Category>("/product-categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateCategory: (id: string, data: Partial<Category>) =>
    apiRequest<Category>(`/product-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  deactivateCategory: (id: string) =>
    apiRequest<void>(`/product-categories/${id}`, { method: "DELETE" }),
};
