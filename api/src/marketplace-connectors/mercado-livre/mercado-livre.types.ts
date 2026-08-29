export interface MercadoLivreTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}
export interface MercadoLivreUserResponse {
  id: number;
  nickname: string;
  site_id: string;
  country_id: string;
  status?: { site_status?: string };
}
export interface MercadoLivreItemSearchResponse {
  seller_id: string | number;
  results: string[];
  paging: { total: number; offset: number; limit: number };
  scroll_id?: string;
}
export interface MercadoLivreVariation {
  id: number;
  available_quantity?: number;
  price?: number;
  attribute_combinations?: Array<{ id: string; value_name: string }>;
  attributes?: Array<{ id: string; value_name: string }>;
}
export interface MercadoLivreItem {
  id: string;
  title: string;
  status: string;
  price: number;
  currency_id: string;
  available_quantity: number;
  sold_quantity: number;
  category_id: string;
  permalink?: string;
  thumbnail?: string;
  seller_id: number;
  seller_custom_field?: string;
  listing_type_id?: string;
  catalog_product_id?: string;
  warranty?: string;
  last_updated?: string;
  variations?: MercadoLivreVariation[];
  attributes?: Array<{ id: string; value_name?: string }>;
}
export interface MercadoLivreOrderSearchResponse {
  results: MercadoLivreOrder[];
  paging: { total: number; offset: number; limit: number };
}
export interface MercadoLivreOrder {
  id: number;
  status: string;
  date_created: string;
  date_last_updated: string;
  total_amount: number;
  currency_id: string;
  seller: { id: number };
  buyer?: { id: number; nickname?: string };
  shipping?: { id: number };
  payments?: Array<{ status: string }>;
  order_items: Array<{
    item: {
      id: string;
      title: string;
      variation_id?: number;
      seller_sku?: string;
    };
    quantity: number;
    unit_price: number;
    currency_id: string;
  }>;
}
export interface MercadoLivreShipment {
  id: number;
  status: string;
  substatus?: string;
  logistic_type?: string;
  tracking_number?: string;
  tracking_method?: string;
  sender_id?: number;
  receiver_id?: number;
  date_last_updated?: string;
  shipping_option?: { estimated_delivery_time?: { date?: string } };
}
