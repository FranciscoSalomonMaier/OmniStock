export enum FiscalEnvironment {
  HOMOLOGATION = 'HOMOLOGATION',
  PRODUCTION = 'PRODUCTION',
}
export enum FiscalDocumentModel {
  NFE = '55',
}
export enum TaxRegime {
  SIMPLES_NACIONAL = 'SIMPLES_NACIONAL',
  SIMPLES_NACIONAL_EXCESS_SUBLIMIT = 'SIMPLES_NACIONAL_EXCESS_SUBLIMIT',
  NORMAL_REGIME = 'NORMAL_REGIME',
  MEI = 'MEI',
}
export enum AccountantReviewStatus {
  NOT_REVIEWED = 'NOT_REVIEWED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}
export interface FiscalValidationIssue {
  category: string;
  code: string;
  message: string;
  field?: string;
}
export interface FiscalReadinessResult {
  ready: boolean;
  errors: FiscalValidationIssue[];
  warnings: FiscalValidationIssue[];
}
export interface FiscalSnapshot {
  schemaVersion: 1;
  companyId: string;
  operationAt: string;
  establishment: Record<string, unknown>;
  products: Array<{
    productId: string;
    profileId: string;
    version: number;
    data: Record<string, unknown>;
  }>;
  rules: Array<{ id: string; version: number; data: Record<string, unknown> }>;
}
export interface ReservedFiscalNumber {
  reservationId: string;
  number: number;
  version: number;
}
export abstract class FiscalNumberReservationService {
  abstract reserveNextNumber(params: {
    companyId: string;
    fiscalEstablishmentId: string;
    documentModel: FiscalDocumentModel;
    environment: FiscalEnvironment;
    series: number;
  }): Promise<ReservedFiscalNumber>;
}
export const ACCOUNTANT_WARNING =
  'As configurações tributárias devem ser revisadas e aprovadas pelo contador responsável pela empresa. As validações do sistema não substituem orientação contábil ou fiscal.';
