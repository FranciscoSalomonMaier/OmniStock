import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  validCnpj,
  validateAddress,
  validateClassification,
  validatePeriod,
} from './fiscal.validation';
import {
  ProductFiscalProfileDto,
  DocumentSettingDto,
  ChangeNumberDto,
  EstablishmentDto,
} from './fiscal.dto';
import { defaultFiscalPermission } from './fiscal-permissions';
import { DisabledFiscalNumberReservationService } from './fiscal.service';
describe('Fiscal validation and authorization', () => {
  it.each(['11222333000181', '11.222.333/0001-81', '00.000.000/E08G-12'])(
    'accepts valid CNPJ %s',
    (cnpj) => expect(validCnpj(cnpj)).toBe(true),
  );
  it.each(['00000000000000', '11222333000180', 'A'.repeat(14), '123'])(
    'rejects CNPJ %s',
    (cnpj) => expect(validCnpj(cnpj)).toBe(false),
  );
  it('checks IBGE UF and CEP', () => {
    expect(() =>
      validateAddress({
        state: 'SP',
        municipalityCode: '3550308',
        postalCode: '01001000',
      }),
    ).not.toThrow();
    expect(() =>
      validateAddress({
        state: 'RJ',
        municipalityCode: '3550308',
        postalCode: '01001000',
      }),
    ).toThrow();
  });
  it('separates ICMS tax status from origin and respects CRT 2', () => {
    expect(() =>
      validateClassification({ csosn: '102' }, 'SIMPLES_NACIONAL'),
    ).not.toThrow();
    expect(() =>
      validateClassification(
        { csosn: '102' },
        'SIMPLES_NACIONAL_EXCESS_SUBLIMIT',
      ),
    ).toThrow();
    expect(() =>
      validateClassification({ cstIcms: '00' }, 'NORMAL_REGIME'),
    ).not.toThrow();
    expect(() =>
      validateClassification({ cstIcms: '00', csosn: '102' }),
    ).toThrow();
  });
  it('rejects inverted or empty validity', () => {
    expect(() => validatePeriod('2026-01-01', '2026-01-01')).toThrow();
  });
  const options = { whitelist: true, forbidNonWhitelisted: true };
  it.each([
    ['ncm', '123'],
    ['cest', '12345678'],
    ['defaultCfop', '9102'],
    ['csosn', '999'],
    ['origin', '9'],
    ['ibsRate', 0.1],
    ['ibsRate', '0.12345'],
    ['ibsRate', '-1'],
    ['ibsRate', '101'],
    ['taxableConversionFactor', '0'],
  ])('rejects %s = %s', async (key, value) => {
    const d = plainToInstance(ProductFiscalProfileDto, {
      validFrom: '2026-01-01T00:00:00Z',
      [key]: value,
    });
    expect((await validate(d, options)).length).toBeGreaterThan(0);
  });
  it('keeps exact decimal strings', async () =>
    expect(
      await validate(
        plainToInstance(ProductFiscalProfileDto, {
          validFrom: '2026-01-01T00:00:00Z',
          ibsRate: '0.1234',
          taxableConversionFactor: '1.000001',
        }),
        options,
      ),
    ).toEqual([]));
  it('rejects mass assignment and fractional sequence', async () => {
    expect(
      (
        await validate(
          plainToInstance(DocumentSettingDto, {
            nextNumber: 1.2,
            companyId: 'spoof',
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        await validate(
          plainToInstance(ChangeNumberDto, {
            nextNumber: 1,
            expectedVersion: 1,
          }),
          options,
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('normalizes CNPJ and nested address while forbidding unknown fields', async () => {
    const d = plainToInstance(EstablishmentDto, {
      cnpj: '11.222.333/0001-81',
      address: { unexpected: true },
    });
    expect(d.cnpj).toBe('11222333000181');
    expect(
      (await validate(d, options)).some((e) => e.property === 'address'),
    ).toBe(true);
  });
  it('viewer cannot edit; billing lacks privileged numbering/review rights', () => {
    expect(defaultFiscalPermission('VIEWER', 'fiscal.products.manage')).toBe(
      false,
    );
    expect(defaultFiscalPermission('VIEWER', 'fiscal.products.read')).toBe(
      true,
    );
    expect(
      defaultFiscalPermission(
        'BILLING',
        'fiscal.document_settings.change_number',
      ),
    ).toBe(false);
    expect(defaultFiscalPermission('ADMIN', 'fiscal.review.approve')).toBe(
      true,
    );
  });
  it('cannot reserve/consume a fiscal number or emit', async () => {
    await expect(
      new DisabledFiscalNumberReservationService().reserveNextNumber(),
    ).rejects.toThrow('indisponíveis');
  });
});
