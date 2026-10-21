import { Injectable, NotFoundException } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import {
  FiscalDocumentSetting,
  ProductFiscalProfile,
  ProductTaxRule,
  FiscalEstablishment,
} from './entities/fiscal.entity';
import type { FiscalReadinessResult } from './fiscal.contracts';
import {
  validCnpj,
  validateAddress,
  validateClassification,
} from './fiscal.validation';
function result(): FiscalReadinessResult {
  return { ready: false, errors: [], warnings: [] };
}
function issue(
  r: FiscalReadinessResult,
  category: string,
  code: string,
  message: string,
  warning = false,
) {
  r[warning ? 'warnings' : 'errors'].push({ category, code, message });
}
@Injectable()
export class FiscalReadinessService {
  constructor(private fiscal: FiscalService) {}
  async validateCompany(companyId: string, id: string) {
    const r = result();
    const e = await this.fiscal.getEstablishment(companyId, id);
    if (!e.active)
      issue(r, 'COMPANY_DATA', 'INACTIVE', 'Estabelecimento inativo.');
    if (!validCnpj(e.cnpj)) issue(r, 'COMPANY_DATA', 'CNPJ', 'CNPJ inválido.');
    if (e.stateRegistrationIndicator === '1' && !e.stateRegistration)
      issue(r, 'COMPANY_DATA', 'IE', 'Inscrição estadual ausente.');
    try {
      validateAddress(e.address);
    } catch {
      issue(
        r,
        'ADDRESS',
        'ADDRESS_INVALID',
        'Verifique CEP, UF e código IBGE.',
      );
    }
    if (
      !e.address.street ||
      !e.address.number ||
      !e.address.city ||
      !e.address.district
    )
      issue(r, 'ADDRESS', 'ADDRESS_INCOMPLETE', 'Endereço fiscal incompleto.');
    const settings = await this.fiscal.db.manager.find(FiscalDocumentSetting, {
      where: { companyId, fiscalEstablishmentId: id, active: true },
    });
    if (!settings.length)
      issue(
        r,
        'DOCUMENT_SETTINGS',
        'NO_SEQUENCE',
        'Configure e ative uma sequência de NF-e.',
      );
    if (e.accountantReviewStatus !== 'APPROVED')
      issue(
        r,
        'ACCOUNTANT_REVIEW',
        'NOT_APPROVED',
        'Estabelecimento sem aprovação contábil.',
      );
    issue(
      r,
      'ADDRESS',
      'MUNICIPALITY_TABLE',
      'O código IBGE foi verificado por formato e UF; confirme sua existência e vigência na tabela oficial.',
      true,
    );
    issue(
      r,
      'COMPANY_DATA',
      'IE_STATE_RULE',
      'A aplicabilidade da isenção e a inscrição estadual devem ser confirmadas conforme a UF.',
      true,
    );
    r.ready = !r.errors.length;
    return r;
  }
  async validateProduct(
    companyId: string,
    id: string,
    establishmentId?: string,
  ) {
    await this.fiscal.product(companyId, id);
    const r = result();
    let p: ProductFiscalProfile;
    try {
      p = await this.fiscal.currentProfile(companyId, id);
    } catch {
      issue(
        r,
        'PRODUCT_CLASSIFICATION',
        'NO_PROFILE',
        'Produto ou kit sem perfil fiscal vigente.',
      );
      return r;
    }
    for (const [key, label] of [
      ['ncm', 'NCM'],
      ['origin', 'Origem'],
      ['taxableUnit', 'Unidade tributável'],
      ['commercialUnit', 'Unidade comercial'],
      ['taxableConversionFactor', 'Fator de conversão'],
    ] as const)
      if (!p[key])
        issue(
          r,
          'PRODUCT_CLASSIFICATION',
          'MISSING_' + key,
          label + ' ausente.',
        );
    if (!p.ncm || !/^\d{8}$/.test(p.ncm))
      issue(
        r,
        'PRODUCT_CLASSIFICATION',
        'NCM_FORMAT',
        'NCM deve possuir 8 dígitos.',
      );
    if (!p.cstIcms && !p.csosn)
      issue(
        r,
        'PRODUCT_CLASSIFICATION',
        'ICMS_STATUS',
        'Informe CST ICMS ou CSOSN aplicável.',
      );
    const est = establishmentId
      ? await this.fiscal.find(
          this.fiscal.db.manager,
          FiscalEstablishment,
          companyId,
          establishmentId,
        )
      : await this.fiscal.db.manager.findOneBy(FiscalEstablishment, {
          companyId,
          isDefault: true,
          active: true,
        });
    if (est) {
      try {
        validateClassification(p, est.taxRegime);
      } catch {
        issue(
          r,
          'PRODUCT_CLASSIFICATION',
          'REGIME_MISMATCH',
          'CST/CSOSN incompatível com o CRT do estabelecimento.',
        );
      }
    } else
      issue(
        r,
        'COMPANY_DATA',
        'NO_ESTABLISHMENT',
        'Defina o estabelecimento para validar o regime.',
      );
    if (!p.cest)
      issue(
        r,
        'PRODUCT_CLASSIFICATION',
        'CEST_REVIEW',
        'CEST ausente; confirme se é aplicável.',
        true,
      );
    if (!p.defaultCfop)
      issue(
        r,
        'TAX_RULE',
        'CFOP_MISSING',
        'CFOP padrão ausente; configure a regra da operação.',
        true,
      );
    issue(
      r,
      'TAX_RULE',
      'CFOP_OPERATION',
      'O CFOP padrão é apenas uma sugestão; confirme o código para cada operação.',
      true,
    );
    if (p.accountantReviewStatus !== 'APPROVED')
      issue(
        r,
        'ACCOUNTANT_REVIEW',
        'NOT_APPROVED',
        'Perfil sem aprovação contábil.',
      );
    const rules = await this.fiscal.db
      .getRepository(ProductTaxRule)
      .createQueryBuilder('r')
      .where(
        'r.company_id=:companyId AND r.product_id=:id AND r.active AND r.valid_from<=now() AND (r.valid_until IS NULL OR r.valid_until>now())',
        { companyId, id },
      )
      .getMany();
    if (!rules.length)
      issue(
        r,
        'TAX_RULE',
        'NO_RULES',
        'Nenhuma regra tributária vigente definida para o produto.',
        true,
      );
    for (const rule of rules)
      if (rule.accountantReviewStatus !== 'APPROVED')
        issue(
          r,
          'ACCOUNTANT_REVIEW',
          'RULE_NOT_APPROVED',
          'Regra tributária sem aprovação contábil.',
          true,
        );
    issue(
      r,
      'TAX_RULE',
      'OFFICIAL_TABLE_REVIEW',
      'Códigos NCM/CEST/CFOP e IBS/CBS/IS exigem conferência de existência, vigência e aplicabilidade nas tabelas oficiais.',
      true,
    );
    r.ready = !r.errors.length;
    return r;
  }
  async validateOrder(companyId: string, id: string) {
    const orders = await this.fiscal.db.query<Array<{ id: string }>>(
      'SELECT id FROM orders WHERE company_id=$1 AND id=$2',
      [companyId, id],
    );
    if (!orders.length)
      throw new NotFoundException('Pedido não encontrado nesta empresa.');
    const r = result();
    const est = await this.fiscal.db.manager.findOneBy(FiscalEstablishment, {
      companyId,
      isDefault: true,
      active: true,
    });
    if (est) {
      const c = await this.validateCompany(companyId, est.id);
      r.errors.push(...c.errors);
      r.warnings.push(...c.warnings);
    } else
      issue(r, 'COMPANY_DATA', 'NO_DEFAULT', 'Estabelecimento padrão ausente.');
    const customers = await this.fiscal.db.query<
      Array<{ name: string; document: string | null }>
    >(
      'SELECT name,document FROM order_customers WHERE company_id=$1 AND order_id=$2',
      [companyId, id],
    );
    if (!customers[0]?.document || !customers[0]?.name)
      issue(
        r,
        'CUSTOMER_DATA',
        'CUSTOMER_INCOMPLETE',
        'Destinatário sem documento ou nome fiscal.',
      );
    const addresses = await this.fiscal.db.query<
      Array<{
        street: string;
        number: string;
        city: string;
        state: string;
        postal_code: string;
      }>
    >(
      "SELECT street,number,city,state,postal_code FROM order_addresses WHERE company_id=$1 AND order_id=$2 AND type='BILLING'",
      [companyId, id],
    );
    if (!addresses.length || Object.values(addresses[0]).some((v) => !v))
      issue(
        r,
        'CUSTOMER_DATA',
        'BILLING_ADDRESS',
        'Endereço de faturamento incompleto.',
      );
    issue(
      r,
      'CUSTOMER_DATA',
      'CUSTOMER_FISCAL_REVIEW',
      'Documento do destinatário e município IBGE do endereço importado precisam de conferência no futuro fluxo fiscal.',
      true,
    );
    const items = await this.fiscal.db.query<
      Array<{ product_id: string | null }>
    >(
      'SELECT product_id FROM order_items WHERE company_id=$1 AND order_id=$2',
      [companyId, id],
    );
    if (!items.length) issue(r, 'ORDER_DATA', 'NO_ITEMS', 'Pedido sem itens.');
    for (const item of items) {
      if (!item.product_id) {
        issue(
          r,
          'ORDER_DATA',
          'UNLINKED_ITEM',
          'Item sem produto interno vinculado.',
        );
        continue;
      }
      const p = await this.validateProduct(companyId, item.product_id, est?.id);
      r.errors.push(...p.errors);
      r.warnings.push(...p.warnings);
    }
    issue(
      r,
      'ORDER_DATA',
      'NO_EMISSION',
      'Prontidão técnica preliminar; emissão e cálculo definitivo ainda indisponíveis.',
      true,
    );
    r.ready = !r.errors.length;
    return r;
  }
  async overview(companyId: string) {
    const est = await this.fiscal.db.manager.findOneBy(FiscalEstablishment, {
      companyId,
      isDefault: true,
      active: true,
    });
    const products = await this.fiscal.db.query<Array<{ id: string }>>(
      'SELECT id FROM products WHERE company_id=$1',
      [companyId],
    );
    let complete = 0;
    for (const p of products)
      if ((await this.validateProduct(companyId, p.id)).ready) complete++;
    const pending = await this.fiscal.db.query<Array<{ count: string }>>(
      `SELECT (SELECT count(*) FROM fiscal_establishments WHERE company_id=$1 AND accountant_review_status='PENDING_REVIEW')+(SELECT count(*) FROM product_fiscal_profiles WHERE company_id=$1 AND active AND accountant_review_status='PENDING_REVIEW')+(SELECT count(*) FROM product_tax_rules WHERE company_id=$1 AND active AND accountant_review_status='PENDING_REVIEW') AS count`,
      [companyId],
    );
    return {
      establishment: est,
      settings: est
        ? await this.fiscal.db.manager.find(FiscalDocumentSetting, {
            where: { companyId, fiscalEstablishmentId: est.id, active: true },
          })
        : [],
      completeProducts: complete,
      pendingProducts: products.length - complete,
      pendingReviews: Number(pending[0].count),
    };
  }
}
