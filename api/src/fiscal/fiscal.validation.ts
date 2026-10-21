import { BadRequestException } from '@nestjs/common';
export const UF_CODES: Record<string, string> = {
  RO: '11',
  AC: '12',
  AM: '13',
  RR: '14',
  PA: '15',
  AP: '16',
  TO: '17',
  MA: '21',
  PI: '22',
  CE: '23',
  RN: '24',
  PB: '25',
  PE: '26',
  AL: '27',
  SE: '28',
  BA: '29',
  MG: '31',
  ES: '32',
  RJ: '33',
  SP: '35',
  PR: '41',
  SC: '42',
  RS: '43',
  MS: '50',
  MT: '51',
  GO: '52',
  DF: '53',
};
export const CRT: Record<string, string> = {
  SIMPLES_NACIONAL: '1',
  SIMPLES_NACIONAL_EXCESS_SUBLIMIT: '2',
  NORMAL_REGIME: '3',
  MEI: '4',
};
export const ICMS = [
  '00',
  '02',
  '10',
  '15',
  '20',
  '30',
  '40',
  '41',
  '50',
  '51',
  '53',
  '60',
  '61',
  '70',
  '90',
];
export const CSOSN = [
  '101',
  '102',
  '103',
  '201',
  '202',
  '203',
  '300',
  '400',
  '500',
  '900',
];
export const PIS_COFINS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '56',
  '60',
  '61',
  '62',
  '63',
  '64',
  '65',
  '66',
  '67',
  '70',
  '71',
  '72',
  '73',
  '74',
  '75',
  '98',
  '99',
];
export const IPI = [
  '00',
  '01',
  '02',
  '03',
  '04',
  '05',
  '49',
  '50',
  '51',
  '52',
  '53',
  '54',
  '55',
  '99',
];
export function normalizeCnpj(s: string) {
  return s.toUpperCase().replace(/[./\-\s]/g, '');
}
export function validCnpj(input: string) {
  const s = normalizeCnpj(input);
  if (!/^[A-Z0-9]{12}\d{2}$/.test(s) || /^(.)\1{13}$/.test(s)) return false;
  let b = s.slice(0, 12);
  for (let n = 0; n < 2; n++) {
    let sum = 0;
    for (let i = 0; i < b.length; i++)
      sum += (b.charCodeAt(i) - 48) * (((b.length - 1 - i) % 8) + 2);
    const dv = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (dv !== Number(s[12 + n])) return false;
    b += dv;
  }
  return true;
}
export function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new BadRequestException(message);
}
export function validateAddress(a: {
  state: string;
  municipalityCode: string;
  postalCode: string;
}) {
  ensure(UF_CODES[a.state], 'UF inválida.');
  ensure(
    /^\d{7}$/.test(a.municipalityCode) &&
      a.municipalityCode.startsWith(UF_CODES[a.state]),
    'Código IBGE incompatível com a UF.',
  );
  ensure(/^\d{8}$/.test(a.postalCode), 'CEP deve possuir 8 dígitos.');
}
export function validatePeriod(
  from: Date | string,
  until?: Date | string | null,
) {
  ensure(
    Number.isFinite(new Date(from).getTime()) &&
      (!until || new Date(until) > new Date(from)),
    'Vigência inválida: término deve ser posterior ao início.',
  );
}
export function validateClassification(
  p: { cstIcms?: string | null; csosn?: string | null },
  regime?: string,
) {
  ensure(!(p.cstIcms && p.csosn), 'Informe CST ICMS ou CSOSN, nunca ambos.');
  if (regime) {
    if (['SIMPLES_NACIONAL', 'MEI'].includes(regime))
      ensure(
        !p.cstIcms,
        'Este regime utiliza CSOSN; confirme a operação com o contador.',
      );
    else ensure(!p.csosn, 'CRT 2/3 utiliza CST ICMS, não CSOSN.');
  }
}
export function cfopDirection(code: string) {
  return '123'.includes(code[0]) ? 'ENTRY' : 'EXIT';
}
