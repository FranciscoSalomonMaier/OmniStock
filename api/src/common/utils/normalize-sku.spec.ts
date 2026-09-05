import { normalizeSku } from './normalize-sku';

describe('normalizeSku', () => {
  it('remove espaços externos e converte para maiúsculas', () => {
    expect(normalizeSku('  mk-001/az  ')).toBe('MK-001/AZ');
  });

  it('não considera vazio como SKU', () => {
    expect(normalizeSku('   ')).toBeNull();
    expect(normalizeSku(null)).toBeNull();
  });
});
