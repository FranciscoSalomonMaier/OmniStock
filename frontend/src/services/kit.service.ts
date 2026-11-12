import { apiRequest } from "./api";
import type { Product } from "../types/product";
import type { ProductInput } from "./product.service";

export const kitService = {
  create: (data: Omit<Partial<ProductInput>, "components"> & { components: { productId: string; quantity: number }[] }) =>
    apiRequest<Product>("/kits", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ProductInput>) =>
    apiRequest<Product>(`/kits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};
