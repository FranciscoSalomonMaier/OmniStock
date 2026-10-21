import {
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import {
  DataSource,
  QueryFailedError,
  EntityManager,
  EntityTarget,
  ObjectLiteral,
} from 'typeorm';
import {
  FiscalAddress,
  FiscalEstablishment,
  FiscalDocumentSetting,
  ProductFiscalProfile,
  ProductTaxRule,
  ReviewedFiscalRecord,
} from './entities/fiscal.entity';
import {
  EstablishmentDto,
  UpdateEstablishmentDto,
  DocumentSettingDto,
  UpdateDocumentSettingDto,
  ChangeNumberDto,
  ProductFiscalProfileDto,
  TaxRuleDto,
  UpdateTaxRuleDto,
  ReviewDto,
  FiscalListDto,
} from './fiscal.dto';
import {
  CRT,
  ensure,
  validCnpj,
  validateAddress,
  validatePeriod,
  validateClassification,
  cfopDirection,
  ICMS,
  CSOSN,
  IPI,
  PIS_COFINS,
} from './fiscal.validation';
import { FiscalNumberReservationService } from './fiscal.contracts';
import type { ReservedFiscalNumber } from './fiscal.contracts';
@Injectable()
export class FiscalService {
  constructor(public readonly db: DataSource) {}
  async transaction<T>(
    companyId: string,
    work: (m: EntityManager) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.db.transaction(async (m) => {
        const c = await m.query<Array<{ id: string }>>(
          'SELECT id FROM companies WHERE id=$1 FOR UPDATE',
          [companyId],
        );
        if (!c.length) throw new NotFoundException('Empresa não encontrada.');
        return work(m);
      });
    } catch (e) {
      const code =
        e instanceof QueryFailedError
          ? (e.driverError as { code?: string }).code
          : undefined;
      if (['23505', '23P01'].includes(code || ''))
        throw new ConflictException(
          'Configuração fiscal duplicada ou com vigência conflitante.',
        );
      if (['23503', '23514', '22003'].includes(code || ''))
        throw new ConflictException(
          'Relacionamento ou valor fiscal inconsistente.',
        );
      throw e;
    }
  }
  async find<T extends ObjectLiteral>(
    m: EntityManager,
    target: EntityTarget<T>,
    companyId: string,
    id: string,
  ) {
    const e = await m
      .getRepository(target)
      .findOneBy({ id, companyId } as never);
    if (!e)
      throw new NotFoundException(
        'Registro fiscal não encontrado nesta empresa.',
      );
    return e;
  }
  async audit(
    m: EntityManager,
    companyId: string,
    type: string,
    id: string,
    action: string,
    before: unknown,
    after: unknown,
    userId: string,
    reason?: string,
  ) {
    await m.query(
      'INSERT INTO fiscal_audit_logs(company_id,entity_type,entity_id,action,previous_data,new_data,performed_by,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [
        companyId,
        type,
        id,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        userId,
        reason || null,
      ],
    );
  }
  resetReview(e: ReviewedFiscalRecord) {
    e.accountantReviewStatus = 'NOT_REVIEWED';
    e.reviewedAt = null;
    e.reviewedBy = null;
    e.reviewNote = null;
    e.accountantReference = null;
  }
  async list(
    kind: 'establishments' | 'document-settings' | 'tax-rules',
    companyId: string,
    q: FiscalListDto,
  ) {
    const target =
      kind === 'establishments'
        ? FiscalEstablishment
        : kind === 'document-settings'
          ? FiscalDocumentSetting
          : ProductTaxRule;
    const where: Record<string, unknown> = { companyId };
    if (kind === 'tax-rules' && q.productId) where.productId = q.productId;
    if (kind !== 'establishments' && q.fiscalEstablishmentId)
      where.fiscalEstablishmentId = q.fiscalEstablishmentId;
    const [data, total] = await this.db.getRepository(target).findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: q.limit || 20,
      skip: ((q.page || 1) - 1) * (q.limit || 20),
    });
    return { data, meta: { total, page: q.page || 1, limit: q.limit || 20 } };
  }
  async getEstablishment(companyId: string, id: string) {
    const e = await this.find(
      this.db.manager,
      FiscalEstablishment,
      companyId,
      id,
    );
    return {
      ...e,
      address: await this.find(
        this.db.manager,
        FiscalAddress,
        companyId,
        e.addressId,
      ),
    };
  }
  async saveEstablishment(
    companyId: string,
    userId: string,
    d: EstablishmentDto | UpdateEstablishmentDto,
    id?: string,
  ) {
    return this.transaction(companyId, async (m) => {
      const e = id
        ? await this.find(m, FiscalEstablishment, companyId, id)
        : m.create(FiscalEstablishment, {
            companyId,
            isDefault: false,
            isHeadquarters: false,
            active: true,
            version: 0,
          });
      const before = id
        ? {
            ...e,
            address: await this.find(m, FiscalAddress, companyId, e.addressId),
          }
        : null;
      const { address, reason, ...fields } = d;
      Object.assign(e, fields);
      ensure(validCnpj(e.cnpj), 'CNPJ inválido.');
      e.taxRegimeCode = CRT[e.taxRegime];
      ensure(
        e.stateRegistrationIndicator !== '1' ||
          (e.stateRegistration && e.stateRegistration !== 'ISENTO'),
        'Informe a inscrição estadual do contribuinte.',
      );
      ensure(
        e.stateRegistrationIndicator !== '2' ||
          !e.stateRegistration ||
          e.stateRegistration === 'ISENTO',
        'Para isento, informe ISENTO ou deixe a inscrição vazia.',
      );
      if (address) {
        validateAddress(address);
        const a = await m.save(
          FiscalAddress,
          m.create(FiscalAddress, { ...address, companyId }),
        );
        e.addressId = a.id;
      }
      ensure(e.addressId, 'Endereço fiscal obrigatório.');
      if (!e.active) e.isDefault = false;
      e.version++;
      e.configuredAt = new Date();
      e.configuredBy = userId;
      this.resetReview(e);
      const saved = await m.save(e);
      await this.audit(
        m,
        companyId,
        'ESTABLISHMENT',
        e.id,
        id ? 'UPDATE' : 'CREATE',
        before,
        { ...saved, address },
        userId,
        reason,
      );
      return saved;
    });
  }
  async setDefault(companyId: string, userId: string, id: string) {
    return this.transaction(companyId, async (m) => {
      const e = await this.find(m, FiscalEstablishment, companyId, id);
      ensure(
        e.active,
        'Ative o estabelecimento antes de defini-lo como padrão.',
      );
      const previous = await m.find(FiscalEstablishment, {
        where: { companyId, isDefault: true },
      });
      await m.update(
        FiscalEstablishment,
        { companyId, isDefault: true },
        { isDefault: false },
      );
      e.isDefault = true;
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'ESTABLISHMENT',
        id,
        'SET_DEFAULT',
        previous,
        e,
        userId,
      );
      return e;
    });
  }
  async saveSetting(
    companyId: string,
    userId: string,
    d: DocumentSettingDto | UpdateDocumentSettingDto,
    id?: string,
  ) {
    return this.transaction(companyId, async (m) => {
      const e = id
        ? await this.find(m, FiscalDocumentSetting, companyId, id)
        : m.create(FiscalDocumentSetting, {
            companyId,
            active: false,
            numberVersion: 1,
            version: 0,
          });
      const before = id ? { ...e } : null;
      const { confirmProduction, ...rest } = d;
      const reason = 'reason' in rest ? rest.reason : undefined;
      delete (rest as { reason?: string }).reason;
      Object.assign(e, rest);
      await this.find(
        m,
        FiscalEstablishment,
        companyId,
        e.fiscalEstablishmentId,
      );
      if (e.environment === 'PRODUCTION')
        ensure(
          confirmProduction === true,
          'Confirme explicitamente o ambiente de produção.',
        );
      if (id) {
        ensure(
          !e.active,
          'Desative a sequência antes de alterar ambiente ou série.',
        );
        ensure(
          before?.environment === e.environment && before.series === e.series,
          'Crie uma sequência independente para outro ambiente ou série.',
        );
      }
      e.version++;
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'DOCUMENT_SETTING',
        e.id,
        id ? 'UPDATE' : 'CREATE',
        before,
        e,
        userId,
        reason,
      );
      return e;
    });
  }
  async settingActive(
    companyId: string,
    userId: string,
    id: string,
    active: boolean,
    confirmProduction: boolean | undefined,
    reason: string,
  ) {
    return this.transaction(companyId, async (m) => {
      const e = await this.find(m, FiscalDocumentSetting, companyId, id);
      const before = { ...e };
      const est = await this.find(
        m,
        FiscalEstablishment,
        companyId,
        e.fiscalEstablishmentId,
      );
      if (active) {
        ensure(est.active, 'Estabelecimento inativo.');
        if (e.environment === 'PRODUCTION')
          ensure(
            confirmProduction === true,
            'Confirme o uso do ambiente de produção.',
          );
      }
      e.active = active;
      e.version++;
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'DOCUMENT_SETTING',
        id,
        active ? 'ACTIVATE' : 'DEACTIVATE',
        before,
        e,
        userId,
        reason,
      );
      return e;
    });
  }
  async changeNumber(
    companyId: string,
    userId: string,
    id: string,
    d: ChangeNumberDto,
  ) {
    ensure(
      d.reason.trim().length >= 5,
      'Justifique a alteração com pelo menos 5 caracteres.',
    );
    return this.transaction(companyId, async (m) => {
      const e = await this.find(m, FiscalDocumentSetting, companyId, id);
      if (e.numberVersion !== d.expectedVersion)
        throw new ConflictException(
          'A sequência foi alterada. Recarregue os dados.',
        );
      ensure(
        d.nextNumber >= e.nextNumber || d.allowDecrease === true,
        'Confirme explicitamente a redução da numeração.',
      );
      const before = { ...e };
      e.nextNumber = d.nextNumber;
      e.numberVersion++;
      e.version++;
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'DOCUMENT_SETTING',
        id,
        'CHANGE_NEXT_NUMBER',
        before,
        e,
        userId,
        d.reason,
      );
      return e;
    });
  }
  async product(companyId: string, productId: string, m = this.db.manager) {
    const p = await m.query<Array<{ id: string }>>(
      'SELECT id FROM products WHERE company_id=$1 AND id=$2',
      [companyId, productId],
    );
    if (!p.length)
      throw new NotFoundException('Produto não encontrado nesta empresa.');
  }
  async profiles(companyId: string, productId: string) {
    await this.product(companyId, productId);
    return this.db.manager.find(ProductFiscalProfile, {
      where: { companyId, productId },
      order: { validFrom: 'DESC', version: 'DESC' },
    });
  }
  async saveProfile(
    companyId: string,
    userId: string,
    productId: string,
    d: ProductFiscalProfileDto,
  ) {
    validatePeriod(d.validFrom, d.validUntil);
    validateClassification(d);
    return this.transaction(companyId, async (m) => {
      await this.product(companyId, productId, m);
      const defaultEst = await m.findOneBy(FiscalEstablishment, {
        companyId,
        isDefault: true,
        active: true,
      });
      if (defaultEst) validateClassification(d, defaultEst.taxRegime);
      const old = await m.find(ProductFiscalProfile, {
        where: { companyId, productId },
        order: { version: 'DESC' },
      });
      const { reason, ...fields } = d;
      const start = new Date(d.validFrom);
      for (const p of old.filter(
        (p) => p.active && (!p.validUntil || p.validUntil > start),
      )) {
        ensure(
          p.validFrom <= start,
          'Existe um perfil futuro; não é possível substituir sua vigência implicitamente.',
        );
        const before = { ...p };
        if (p.validFrom < start) p.validUntil = start;
        else p.active = false;
        await m.save(p);
        await this.audit(
          m,
          companyId,
          'PRODUCT_PROFILE',
          p.id,
          'SUPERSEDE',
          before,
          p,
          userId,
          reason,
        );
      }
      const e = m.create(ProductFiscalProfile, {
        ...fields,
        validFrom: start,
        validUntil: d.validUntil ? new Date(d.validUntil) : null,
        companyId,
        productId,
        version: (old[0]?.version || 0) + 1,
        active: true,
      });
      this.resetReview(e);
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'PRODUCT_PROFILE',
        e.id,
        'CREATE_VERSION',
        null,
        e,
        userId,
        reason,
      );
      return e;
    });
  }
  async ruleConflict(m: EntityManager, e: ProductTaxRule) {
    const rows = await m.query<Array<{ id: string }>>(
      "SELECT id FROM product_tax_rules WHERE company_id=$1 AND fiscal_establishment_id=$2 AND product_id=$3 AND tax_type=$4 AND operation_type=$5 AND priority=$6 AND active AND id<>$7 AND (customer_type=$8 OR customer_type='ANY' OR $8='ANY') AND (origin_state IS NULL OR $9::varchar IS NULL OR origin_state=$9) AND (destination_state IS NULL OR $10::varchar IS NULL OR destination_state=$10) AND valid_from<COALESCE($12::timestamptz,'infinity') AND COALESCE(valid_until,'infinity')>$11::timestamptz",
      [
        e.companyId,
        e.fiscalEstablishmentId,
        e.productId,
        e.taxType,
        e.operationType,
        e.priority,
        e.id || '00000000-0000-0000-0000-000000000000',
        e.customerType,
        e.originState || null,
        e.destinationState || null,
        e.validFrom,
        e.validUntil || null,
      ],
    );
    if (rows.length)
      throw new ConflictException(
        'Regra ambígua: mesma prioridade e escopo com vigência sobreposta.',
      );
  }
  async saveRule(
    companyId: string,
    userId: string,
    d: TaxRuleDto | UpdateTaxRuleDto,
    id?: string,
  ) {
    return this.transaction(companyId, async (m) => {
      const old = id ? await this.find(m, ProductTaxRule, companyId, id) : null;
      const e = m.create(ProductTaxRule, { ...(old || {}), id: undefined });
      const { reason, ...fields } = d;
      Object.assign(e, fields, {
        companyId,
        active: true,
        createdBy: old?.createdBy || userId,
        updatedBy: userId,
        version: (old?.version || 0) + 1,
      });
      e.validFrom = new Date(e.validFrom);
      e.validUntil = e.validUntil ? new Date(e.validUntil) : null;
      validatePeriod(e.validFrom, e.validUntil);
      const est = await this.find(
        m,
        FiscalEstablishment,
        companyId,
        e.fiscalEstablishmentId,
      );
      await this.product(companyId, e.productId, m);
      if (e.cfop)
        ensure(
          cfopDirection(e.cfop) === e.operationType,
          'CFOP incompatível com entrada/saída.',
        );
      if (e.taxStatusCode) {
        if (e.taxType === 'ICMS')
          ensure(
            (['SIMPLES_NACIONAL', 'MEI'].includes(est.taxRegime)
              ? CSOSN
              : ICMS
            ).includes(e.taxStatusCode),
            'CST/CSOSN incompatível com o regime.',
          );
        if (['PIS', 'COFINS'].includes(e.taxType))
          ensure(
            PIS_COFINS.includes(e.taxStatusCode),
            'CST inválido para PIS/COFINS.',
          );
        if (e.taxType === 'IPI')
          ensure(IPI.includes(e.taxStatusCode), 'CST IPI inválido.');
      }
      if (old) {
        ensure(
          e.validFrom >= old.validFrom,
          'Nova versão não pode iniciar antes da versão anterior.',
        );
        const previous = { ...old };
        if (e.validFrom > old.validFrom) {
          old.validUntil = e.validFrom;
        } else old.active = false;
        await m.save(old);
        await this.audit(
          m,
          companyId,
          'TAX_RULE',
          old.id,
          'SUPERSEDE',
          previous,
          old,
          userId,
          reason,
        );
      }
      this.resetReview(e);
      await this.ruleConflict(m, e);
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'TAX_RULE',
        e.id,
        'CREATE_VERSION',
        old,
        e,
        userId,
        reason,
      );
      return e;
    });
  }
  async ruleActive(
    companyId: string,
    userId: string,
    id: string,
    active: boolean,
    reason: string,
  ) {
    return this.transaction(companyId, async (m) => {
      const e = await this.find(m, ProductTaxRule, companyId, id);
      const before = { ...e };
      if (active) await this.ruleConflict(m, e);
      e.active = active;
      e.updatedBy = userId;
      this.resetReview(e);
      await m.save(e);
      await this.audit(
        m,
        companyId,
        'TAX_RULE',
        id,
        active ? 'ACTIVATE' : 'DEACTIVATE',
        before,
        e,
        userId,
        reason,
      );
      return e;
    });
  }
  async review(
    companyId: string,
    userId: string,
    kind: 'ESTABLISHMENT' | 'PRODUCT_PROFILE' | 'TAX_RULE',
    id: string,
    d?: ReviewDto,
  ) {
    return this.transaction(companyId, async (m) => {
      const target =
        kind === 'ESTABLISHMENT'
          ? FiscalEstablishment
          : kind === 'PRODUCT_PROFILE'
            ? ProductFiscalProfile
            : ProductTaxRule;
      const e = await this.find(m, target, companyId, id);
      const before = { ...e };
      if (d) {
        ensure(
          e.accountantReviewStatus === 'PENDING_REVIEW',
          'Envie a configuração para revisão antes de aprovar ou rejeitar.',
        );
        e.accountantReviewStatus = d.decision;
        e.reviewedAt = new Date();
        e.reviewedBy = userId;
        e.reviewNote = d.note;
        e.accountantReference = d.accountantReference;
      } else {
        e.accountantReviewStatus = 'PENDING_REVIEW';
        e.reviewedAt = null;
        e.reviewedBy = null;
      }
      await m.save(e);
      await this.audit(
        m,
        companyId,
        kind,
        id,
        d ? d.decision : 'SUBMIT_REVIEW',
        before,
        e,
        userId,
        d?.note,
      );
      return e;
    });
  }
  async currentProfile(companyId: string, productId: string) {
    const p = await this.db
      .getRepository(ProductFiscalProfile)
      .createQueryBuilder('p')
      .where(
        'p.company_id=:companyId AND p.product_id=:productId AND p.active AND p.valid_from<=now() AND (p.valid_until IS NULL OR p.valid_until>now())',
        { companyId, productId },
      )
      .orderBy('p.version', 'DESC')
      .getOne();
    if (!p) throw new NotFoundException('Produto sem perfil fiscal vigente.');
    return p;
  }
}
@Injectable()
export class DisabledFiscalNumberReservationService extends FiscalNumberReservationService {
  reserveNextNumber(): Promise<ReservedFiscalNumber> {
    return Promise.reject(
      new NotImplementedException(
        'Reserva e consumo de numeração indisponíveis nesta etapa. Nenhuma NF-e foi emitida.',
      ),
    );
  }
}
