import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
export abstract class FiscalRecord {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'company_id', type: 'uuid' }) companyId: string;
  @Column({ type: 'integer', default: 1 }) version: number;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
export abstract class ReviewedFiscalRecord extends FiscalRecord {
  @Column({ name: 'accountant_review_status', default: 'NOT_REVIEWED' })
  accountantReviewStatus: string;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy:
    string | null;
  @Column({ name: 'review_note', type: 'text', nullable: true }) reviewNote:
    string | null;
  @Column({
    name: 'accountant_reference',
    type: 'varchar',
    length: 180,
    nullable: true,
  })
  accountantReference: string | null;
}

@Entity('fiscal_addresses')
export class FiscalAddress extends FiscalRecord {
  @Column({ name: 'street', type: 'varchar', length: 180 }) street: string;
  @Column({ name: 'number', type: 'varchar', length: 40 }) number: string;
  @Column({ name: 'complement', type: 'varchar', length: 120, nullable: true })
  complement: string | null;
  @Column({ name: 'district', type: 'varchar', length: 120 }) district: string;
  @Column({ name: 'postal_code', type: 'varchar', length: 8 })
  postalCode: string;
  @Column({ name: 'municipality_code', type: 'varchar', length: 7 })
  municipalityCode: string;
  @Column({ name: 'city', type: 'varchar', length: 120 }) city: string;
  @Column({ name: 'state', type: 'varchar', length: 2 }) state: string;
  @Column({ name: 'country_code', type: 'varchar', length: 4 })
  countryCode: string;
  @Column({ name: 'country', type: 'varchar', length: 80 }) country: string;
}

@Entity('fiscal_establishments')
export class FiscalEstablishment extends ReviewedFiscalRecord {
  @Column({ name: 'name', type: 'varchar', length: 180 }) name: string;
  @Column({ name: 'legal_name', type: 'varchar', length: 180 })
  legalName: string;
  @Column({ name: 'trade_name', type: 'varchar', length: 180, nullable: true })
  tradeName: string | null;
  @Column({ name: 'cnpj', type: 'varchar', length: 14 }) cnpj: string;
  @Column({
    name: 'state_registration',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  stateRegistration: string | null;
  @Column({
    name: 'municipal_registration',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  municipalRegistration: string | null;
  @Column({ name: 'tax_regime', type: 'varchar', length: 60 })
  taxRegime: string;
  @Column({ name: 'tax_regime_code', type: 'varchar', length: 1 })
  taxRegimeCode: string;
  @Column({ name: 'state_registration_indicator', type: 'varchar', length: 1 })
  stateRegistrationIndicator: string;
  @Column({ name: 'email', type: 'varchar', length: 254, nullable: true })
  email: string | null;
  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone: string | null;
  @Column({ name: 'address_id', type: 'uuid' }) addressId: string;
  @Column({ name: 'is_headquarters', type: 'boolean' }) isHeadquarters: boolean;
  @Column({ name: 'is_default', type: 'boolean' }) isDefault: boolean;
  @Column({ name: 'configured_at', type: 'timestamptz' }) configuredAt: Date;
  @Column({ name: 'configured_by', type: 'uuid' }) configuredBy: string;
}

@Entity('fiscal_document_settings')
export class FiscalDocumentSetting extends FiscalRecord {
  @Column({ name: 'fiscal_establishment_id', type: 'uuid' })
  fiscalEstablishmentId: string;
  @Column({ name: 'document_model', type: 'varchar', length: 2 })
  documentModel: string;
  @Column({ name: 'environment', type: 'varchar', length: 20 })
  environment: string;
  @Column({ name: 'series', type: 'integer' }) series: number;
  @Column({ name: 'next_number', type: 'integer' }) nextNumber: number;
  @Column({ name: 'number_version', type: 'integer' }) numberVersion: number;
  @Column({ name: 'emission_type', type: 'varchar', length: 1 })
  emissionType: string;
}

@Entity('product_fiscal_profiles')
export class ProductFiscalProfile extends ReviewedFiscalRecord {
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'ncm', type: 'varchar', length: 8, nullable: true }) ncm:
    string | null;
  @Column({ name: 'cest', type: 'varchar', length: 7, nullable: true }) cest:
    string | null;
  @Column({ name: 'default_cfop', type: 'varchar', length: 4, nullable: true })
  defaultCfop: string | null;
  @Column({ name: 'origin', type: 'varchar', length: 1, nullable: true })
  origin: string | null;
  @Column({ name: 'taxable_unit', type: 'varchar', length: 6, nullable: true })
  taxableUnit: string | null;
  @Column({
    name: 'commercial_unit',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  commercialUnit: string | null;
  @Column({
    name: 'taxable_conversion_factor',
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  taxableConversionFactor: string | null;
  @Column({ name: 'cst_icms', type: 'varchar', length: 2, nullable: true })
  cstIcms: string | null;
  @Column({ name: 'csosn', type: 'varchar', length: 3, nullable: true }) csosn:
    string | null;
  @Column({ name: 'cst_ipi', type: 'varchar', length: 2, nullable: true })
  cstIpi: string | null;
  @Column({ name: 'cst_pis', type: 'varchar', length: 2, nullable: true })
  cstPis: string | null;
  @Column({ name: 'cst_cofins', type: 'varchar', length: 2, nullable: true })
  cstCofins: string | null;
  @Column({
    name: 'ipi_legal_framework_code',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  ipiLegalFrameworkCode: string | null;
  @Column({ name: 'benefit_code', type: 'varchar', length: 20, nullable: true })
  benefitCode: string | null;
  @Column({
    name: 'approximate_tax_rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  approximateTaxRate: string | null;
  @Column({ name: 'cst_ibs_cbs', type: 'varchar', length: 3, nullable: true })
  cstIbsCbs: string | null;
  @Column({
    name: 'tax_classification_ibs_cbs',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  taxClassificationIbsCbs: string | null;
  @Column({
    name: 'ibs_rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  ibsRate: string | null;
  @Column({
    name: 'cbs_rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  cbsRate: string | null;
  @Column({
    name: 'selective_tax_code',
    type: 'varchar',
    length: 6,
    nullable: true,
  })
  selectiveTaxCode: string | null;
  @Column({
    name: 'selective_tax_rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  selectiveTaxRate: string | null;
  @Column({ name: 'valid_from', type: 'timestamptz' }) validFrom: Date;
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;
}

@Entity('product_tax_rules')
export class ProductTaxRule extends ReviewedFiscalRecord {
  @Column({ name: 'fiscal_establishment_id', type: 'uuid' })
  fiscalEstablishmentId: string;
  @Column({ name: 'product_id', type: 'uuid' }) productId: string;
  @Column({ name: 'tax_type', type: 'varchar', length: 40 }) taxType: string;
  @Column({ name: 'operation_type', type: 'varchar', length: 20 })
  operationType: string;
  @Column({ name: 'customer_type', type: 'varchar', length: 30 })
  customerType: string;
  @Column({ name: 'origin_state', type: 'varchar', length: 2, nullable: true })
  originState: string | null;
  @Column({
    name: 'destination_state',
    type: 'varchar',
    length: 2,
    nullable: true,
  })
  destinationState: string | null;
  @Column({ name: 'cfop', type: 'varchar', length: 4, nullable: true }) cfop:
    string | null;
  @Column({
    name: 'tax_status_code',
    type: 'varchar',
    length: 3,
    nullable: true,
  })
  taxStatusCode: string | null;
  @Column({
    name: 'tax_classification_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  taxClassificationCode: string | null;
  @Column({ name: 'calculation_method', type: 'varchar', length: 30 })
  calculationMethod: string;
  @Column({
    name: 'calculation_base_reduction',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  calculationBaseReduction: string | null;
  @Column({
    name: 'rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  rate: string | null;
  @Column({
    name: 'specific_quantity_rate',
    type: 'numeric',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  specificQuantityRate: string | null;
  @Column({
    name: 'deferred_percentage',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  deferredPercentage: string | null;
  @Column({
    name: 'fcp_rate',
    type: 'numeric',
    precision: 7,
    scale: 4,
    nullable: true,
  })
  fcpRate: string | null;
  @Column({ name: 'benefit_code', type: 'varchar', length: 20, nullable: true })
  benefitCode: string | null;
  @Column({ name: 'valid_from', type: 'timestamptz' }) validFrom: Date;
  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;
  @Column({ name: 'priority', type: 'integer' }) priority: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @Column({ name: 'updated_by', type: 'uuid' }) updatedBy: string;
}
