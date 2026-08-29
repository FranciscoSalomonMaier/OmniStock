export const MERCADO_LIVRE_QUEUE = 'mercado-livre';
export type MercadoLivreJobOperation =
  'IMPORT_LISTINGS' | 'IMPORT_ORDERS' | 'PROCESS_NOTIFICATION';
export interface MercadoLivreJobPayload {
  companyId: string;
  connectionId: string;
  operation: MercadoLivreJobOperation;
  correlationId: string;
  syncRunId: string | null;
  notificationId: string | null;
  cursor: string | null;
  attemptNumber: number;
}
