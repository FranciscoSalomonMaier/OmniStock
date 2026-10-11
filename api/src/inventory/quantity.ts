import { BadRequestException } from '@nestjs/common';
export const units = (v: string) => {
  if (!/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(v))
    throw new BadRequestException('Quantidade inválida');
  const [a, b = ''] = v.split('.');
  return BigInt(a) * 1000n + BigInt((b + '000').slice(0, 3));
};
export const decimal = (v: bigint) =>
  `${v / 1000n}.${(v % 1000n).toString().padStart(3, '0')}`;
