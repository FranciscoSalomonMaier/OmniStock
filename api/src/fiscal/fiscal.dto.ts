import { Type, Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  MaxLength,
  MinLength,
  Matches,
  IsIn,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsDateString,
  ValidateNested,
  IsEmail,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import {
  UF_CODES,
  ICMS,
  CSOSN,
  IPI,
  PIS_COFINS,
  normalizeCnpj,
} from './fiscal.validation';
export class AddressDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  street!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  number!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  district!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  city!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  country!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  complement?: string;
  @ApiProperty({ required: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[-\s]/g, '') : value,
  )
  @Matches(/^\d{8}$/)
  postalCode!: string;
  @ApiProperty({ required: true })
  @Matches(/^\d{7}$/)
  municipalityCode!: string;
  @ApiProperty({ required: true }) @IsIn(Object.keys(UF_CODES)) state!: string;
  @ApiProperty({ required: true }) @Matches(/^\d{4}$/) countryCode!: string;
}
export class EstablishmentDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  name!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  legalName!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  tradeName?: string;
  @ApiProperty({ required: true })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? normalizeCnpj(value) : value,
  )
  @Matches(/^[A-Z0-9]{12}\d{2}$/)
  cnpj!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.toUpperCase().replace(/[./\-\s]/g, '')
      : value,
  )
  @Matches(/^(ISENTO|[A-Z0-9]{1,30})$/)
  stateRegistration?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  municipalRegistration?: string;
  @ApiProperty({ required: true })
  @IsIn([
    'SIMPLES_NACIONAL',
    'SIMPLES_NACIONAL_EXCESS_SUBLIMIT',
    'NORMAL_REGIME',
    'MEI',
  ])
  taxRegime!: string;
  @ApiProperty({ required: true })
  @IsIn(['1', '2', '9'])
  stateRegistrationIndicator!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  phone?: string;
  @ApiProperty({ required: true })
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isHeadquarters?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() active?: boolean;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
}
export class UpdateEstablishmentDto extends PartialType(EstablishmentDto) {}
export class DocumentSettingDto {
  @ApiProperty({ required: true }) @IsUUID() fiscalEstablishmentId!: string;
  @ApiProperty({ required: true }) @IsIn(['55']) documentModel!: string;
  @ApiProperty({ required: true })
  @IsIn(['HOMOLOGATION', 'PRODUCTION'])
  environment!: string;
  @ApiProperty({ required: true }) @IsInt() @Min(0) @Max(889) series!: number;
  @ApiProperty({ required: true })
  @IsInt()
  @Min(1)
  @Max(999999999)
  nextNumber!: number;
  @ApiProperty({ required: true }) @IsIn(['1']) emissionType!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmProduction?: boolean;
}
export class UpdateDocumentSettingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['HOMOLOGATION', 'PRODUCTION'])
  environment?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(889)
  series?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmProduction?: boolean;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
export class ChangeNumberDto {
  @ApiProperty({ required: true })
  @IsInt()
  @Min(1)
  @Max(999999999)
  nextNumber!: number;
  @ApiProperty({ required: true })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  expectedVersion!: number;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  allowDecrease?: boolean;
}
export class ActivationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  confirmProduction?: boolean;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
export class ProductFiscalProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{8}$/)
  ncm?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{7}$/)
  cest?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[123567]\d{3}$/)
  defaultCfop?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['0', '1', '2', '3', '4', '5', '6', '7', '8'])
  origin?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  taxableUnit?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(6)
  commercialUnit?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?!0+(?:\.0+)?$)\d{1,12}(?:\.\d{1,6})?$/)
  taxableConversionFactor?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(ICMS) cstIcms?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(CSOSN) csosn?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(IPI) cstIpi?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(PIS_COFINS)
  cstPis?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(PIS_COFINS)
  cstCofins?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{3}$/)
  ipiLegalFrameworkCode?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  benefitCode?: string;
  @ApiProperty({ required: true }) @IsDateString() validFrom!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{3}$/)
  cstIbsCbs?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{6}$/)
  taxClassificationIbsCbs?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{6}$/)
  selectiveTaxCode?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  approximateTaxRate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  ibsRate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  cbsRate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  selectiveTaxRate?: string;
}
export class TaxRuleDto {
  @ApiProperty({ required: true }) @IsUUID() fiscalEstablishmentId!: string;
  @ApiProperty({ required: true }) @IsUUID() productId!: string;
  @ApiProperty({ required: true })
  @Matches(/^[A-Z][A-Z0-9_]{1,39}$/)
  taxType!: string;
  @ApiProperty({ required: true })
  @IsIn(['ENTRY', 'EXIT'])
  operationType!: string;
  @ApiProperty({ required: true })
  @IsIn(['ANY', 'CONTRIBUTOR', 'EXEMPT', 'NON_CONTRIBUTOR'])
  customerType!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(Object.keys(UF_CODES))
  originState?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(Object.keys(UF_CODES))
  destinationState?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^[123567]\d{3}$/)
  cfop?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{2,3}$/)
  taxStatusCode?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  taxClassificationCode?: string;
  @ApiProperty({ required: true })
  @IsIn(['UNDEFINED', 'AD_VALOREM', 'SPECIFIC', 'EXEMPT', 'OTHER'])
  calculationMethod!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^\d{1,12}(?:\.\d{1,6})?$/)
  specificQuantityRate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  benefitCode?: string;
  @ApiProperty({ required: true }) @IsDateString() validFrom!: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  validUntil?: string;
  @ApiProperty({ required: true })
  @IsInt()
  @Min(0)
  @Max(1000000)
  priority!: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  rate?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  calculationBaseReduction?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  deferredPercentage?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @Matches(/^(?:100(?:\.0{1,4})?|(?:0|[1-9]\d?)(?:\.\d{1,4})?)$/)
  fcpRate?: string;
}
export class UpdateTaxRuleDto extends PartialType(TaxRuleDto) {}
export class ReviewDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  accountantReference!: string;
  @ApiProperty({ required: true })
  @IsIn(['APPROVED', 'REJECTED'])
  decision!: string;
}
export class ReasonDto {
  @ApiProperty({ required: true })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
export class FiscalListDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() productId?: string;
  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  fiscalEstablishmentId?: string;
}
