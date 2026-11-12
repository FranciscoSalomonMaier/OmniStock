import { ArgumentMetadata, ValidationPipe } from '@nestjs/common';
import { CreateProductDto } from './product.dto';
describe('CreateProductDto', () => {
  const pipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: CreateProductDto,
  };
  const valid = {
    sku: ' mk-001 ',
    name: 'Produto',
    unitOfMeasure: 'UN',
    minimumStock: '0',
  };
  it('normaliza SKU', async () =>
    expect(pipe.transform(valid, metadata)).resolves.toMatchObject({
      sku: 'MK-001',
    }));
  it('reserva KIT para o cadastro específico de kits', async () =>
    expect(
      pipe.transform({ ...valid, unitOfMeasure: 'KIT' }, metadata),
    ).rejects.toThrow());
  it('mantém compra e custo independentes, sem cálculo automático', async () =>
    expect(
      pipe.transform(
        { ...valid, purchasePrice: '2.00', costPrice: '2.50' },
        metadata,
      ),
    ).resolves.toMatchObject({ purchasePrice: '2.00', costPrice: '2.50' }));
  it('permite informar somente o preço de compra', async () => {
    const product = await pipe.transform(
      { ...valid, purchasePrice: '2.00' },
      metadata,
    );
    expect(product.purchasePrice).toBe('2.00');
    expect(product.costPrice).toBeUndefined();
  });
  it.each(['purchasePrice', 'costPrice'])('permite limpar %s', async (field) =>
    expect(
      pipe.transform({ ...valid, [field]: null }, metadata),
    ).resolves.toMatchObject({ [field]: null }),
  );
  it.each([
    ['purchasePrice', '-1'],
    ['purchasePrice', '2.001'],
    ['costPrice', '-1'],
    ['costPrice', '2.501'],
  ])('rejeita preço inválido em %s', async (field, value) =>
    expect(
      pipe.transform({ ...valid, [field]: value }, metadata),
    ).rejects.toThrow(),
  );
  it('rejeita companyId no body', async () =>
    expect(
      pipe.transform(
        { ...valid, companyId: 'f43bcae2-d08c-4e79-b88e-8713926619f6' },
        metadata,
      ),
    ).rejects.toThrow());
  it.each([
    ['minimumStock', '-1'],
    ['ncm', '123'],
    ['cest', '123'],
  ])('rejeita %s inválido', async (field, value) =>
    expect(
      pipe.transform({ ...valid, [field]: value }, metadata),
    ).rejects.toThrow(),
  );
  it('aceita cadastrar produto sem preço de venda', async () =>
    expect(pipe.transform(valid, metadata)).resolves.not.toHaveProperty(
      'salePrice',
    ));
  it('rejeita preço de venda no cadastro do produto', async () =>
    expect(
      pipe.transform({ ...valid, salePrice: '19.90' }, metadata),
    ).rejects.toThrow());
  it('rejeita CFOP no cadastro do produto', async () =>
    expect(
      pipe.transform({ ...valid, defaultCfop: '5102' }, metadata),
    ).rejects.toThrow());
  it('converte campo opcional vazio em null', async () =>
    expect(
      pipe.transform({ ...valid, barcode: '' }, metadata),
    ).resolves.toMatchObject({ barcode: null }));
});
