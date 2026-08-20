import { BadRequestException } from '@nestjs/common';
import { decimal, units } from './inventory.service';
describe('Inventory decimal arithmetic', () => {
  it('normalizes quantities to three decimal places', () => {
    expect(decimal(units('10'))).toBe('10.000');
    expect(decimal(units('1.25'))).toBe('1.250');
  });
  it('calculates available without floating point', () => {
    expect(decimal(units('10.000') - units('2.125'))).toBe('7.875');
  });
  it.each(['-1', '1.0001', 'NaN', 'Infinity', '01'])(
    'rejects invalid quantity %s',
    (value) => expect(() => units(value)).toThrow(BadRequestException),
  );
});
