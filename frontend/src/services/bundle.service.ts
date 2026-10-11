import { apiRequest } from './api';
export interface BundleComposition { isBundle: boolean; bundleId: string | null; availableKits: number; components: Array<{ id: string; productId: string; productName: string; quantity: string }> }
export const bundleService = {
 get: (productId: string) => apiRequest<BundleComposition>(`/products/${productId}/bundle-components`),
 create: (productId: string) => apiRequest('/product-bundles', {method:'POST',body:JSON.stringify({bundleProductId:productId})}),
 add: (productId: string, componentProductId: string, quantity: number) => apiRequest(`/products/${productId}/bundle-components`,{method:'POST',body:JSON.stringify({componentProductId,quantity})}),
 update: (productId:string,id:string,quantity:number) => apiRequest(`/products/${productId}/bundle-components/${id}`,{method:'PATCH',body:JSON.stringify({quantity})}),
 remove: (productId:string,id:string) => apiRequest(`/products/${productId}/bundle-components/${id}`,{method:'DELETE'}),
};
