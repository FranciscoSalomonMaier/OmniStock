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
    salePrice: '19.90',
    minimumStock: '0',
  };
  it('normaliza SKU', async () =>
    expect(pipe.transform(valid, metadata)).resolves.toMatchObject({
      sku: 'MK-001',
    }));
  it('rejeita companyId no body', async () =>
    expect(
      pipe.transform(
        { ...valid, companyId: 'f43bcae2-d08c-4e79-b88e-8713926619f6' },
        metadata,
      ),
    ).rejects.toThrow());
  it.each([
    ['salePrice', '-1'],
    ['minimumStock', '-1'],
    ['ncm', '123'],
    ['cest', '123'],
    ['defaultCfop', '12'],
  ])('rejeita %s inválido', async (field, value) =>
    expect(
      pipe.transform({ ...valid, [field]: value }, metadata),
    ).rejects.toThrow(),
  );
  it('converte campo opcional vazio em null', async () =>
    expect(
      pipe.transform({ ...valid, barcode: '' }, metadata),
    ).resolves.toMatchObject({ barcode: null }));
});
