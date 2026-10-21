export const warning =
  "As configurações tributárias devem ser revisadas e aprovadas pelo contador responsável pela empresa. As validações do sistema não substituem orientação contábil ou fiscal.";
export type FiscalRecord = Record<string, unknown> & {
  id: string;
  name?: string;
  accountantReviewStatus?: string;
  active?: boolean;
  version?: number;
};
export type Field = {
  key: string;
  label: string;
  section: string;
  required?: boolean;
  type?: string;
  options?: [string, string][];
  pattern?: string;
  hint?: string;
};
const f = (
  key: string,
  label: string,
  section: string,
  extra: Partial<Field> = {},
): Field => ({ key, label, section, ...extra });
const options = (values: string[]) =>
  values.map((v) => [v, v] as [string, string]);
export const states = options(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(
    " ",
  ),
);
export const reviewLabel: Record<string, string> = {
  NOT_REVIEWED: "Não revisado",
  PENDING_REVIEW: "Em revisão",
  APPROVED: "Aprovado pelo responsável",
  REJECTED: "Rejeitado",
  HOMOLOGATION: "Homologação",
  PRODUCTION: "Produção",
  SIMPLES_NACIONAL: "Simples Nacional",
  SIMPLES_NACIONAL_EXCESS_SUBLIMIT: "Simples — excesso de sublimite",
  NORMAL_REGIME: "Regime normal",
  MEI: "MEI",
};
export const establishmentFields: Field[] = [
  f("name", "Nome do estabelecimento", "Identificação", { required: true }),
  f("legalName", "Razão social", "Identificação", { required: true }),
  f("tradeName", "Nome fantasia", "Identificação"),
  f("cnpj", "CNPJ", "Identificação", {
    required: true,
    hint: "Aceita CNPJ numérico ou alfanumérico, com ou sem máscara.",
  }),
  f("email", "E-mail", "Identificação", { type: "email" }),
  f("phone", "Telefone", "Identificação"),
  f("isHeadquarters", "Matriz", "Identificação", { type: "checkbox" }),
  f(
    "stateRegistrationIndicator",
    "Indicador de inscrição estadual",
    "Inscrições",
    {
      required: true,
      options: [
        ["1", "Contribuinte"],
        ["2", "Isento"],
        ["9", "Não contribuinte"],
      ],
    },
  ),
  f("stateRegistration", "Inscrição estadual", "Inscrições", {
    hint: "Isenção deve ser confirmada conforme a legislação da UF.",
  }),
  f("municipalRegistration", "Inscrição municipal", "Inscrições"),
  f("taxRegime", "Regime tributário / CRT", "Regime tributário", {
    required: true,
    options: Object.entries({
      SIMPLES_NACIONAL: "Simples Nacional — CRT 1",
      SIMPLES_NACIONAL_EXCESS_SUBLIMIT: "Excesso de sublimite — CRT 2",
      NORMAL_REGIME: "Regime normal — CRT 3",
      MEI: "MEI — CRT 4",
    }),
  }),
  ...(
    [
      "street",
      "number",
      "complement",
      "district",
      "postalCode",
      "municipalityCode",
      "city",
      "state",
      "countryCode",
      "country",
    ] as const
  ).map((key, i) =>
    f(
      "address." + key,
      [
        "Logradouro",
        "Número",
        "Complemento",
        "Bairro",
        "CEP",
        "Código IBGE do município",
        "Município",
        "UF",
        "Código do país (NF-e)",
        "País",
      ][i],
      "Endereço fiscal",
      {
        required: key !== "complement",
        ...(key === "state" ? { options: states } : {}),
        ...(key === "countryCode"
          ? { hint: "Código numérico da tabela NF-e; Brasil: 1058." }
          : {}),
      },
    ),
  ),
  f("active", "Ativo", "Situação", { type: "checkbox" }),
  f("reason", "Justificativa da alteração", "Situação"),
];
export const settingFields: Field[] = [
  f("fiscalEstablishmentId", "Estabelecimento", "Sequência", {
    required: true,
  }),
  f("documentModel", "Modelo", "Sequência", {
    required: true,
    options: [["55", "NF-e — modelo 55"]],
  }),
  f("environment", "Ambiente", "Sequência", {
    required: true,
    options: [
      ["HOMOLOGATION", "Homologação"],
      ["PRODUCTION", "Produção"],
    ],
  }),
  f("series", "Série (0 a 889)", "Sequência", {
    required: true,
    pattern: "[0-9]{1,3}",
  }),
  f("nextNumber", "Próximo número (1 a 999999999)", "Sequência", {
    required: true,
    pattern: "[0-9]{1,9}",
  }),
  f("emissionType", "Tipo de emissão", "Sequência", {
    required: true,
    options: [["1", "Normal"]],
  }),
  f("confirmProduction", "Confirmo a configuração em produção", "Confirmação", {
    type: "checkbox",
  }),
];
export const profileFields: Field[] = [
  f("ncm", "NCM", "Classificação", { pattern: "[0-9]{8}" }),
  f("cest", "CEST", "Classificação", { pattern: "[0-9]{7}" }),
  f("defaultCfop", "CFOP padrão", "Classificação", {
    pattern: "[123567][0-9]{3}",
    hint: "Sugestão inicial; não atende automaticamente todas as operações.",
  }),
  f("origin", "Origem da mercadoria", "Classificação", {
    options: [
      ["0", "0 — Nacional"],
      ["1", "1 — Estrangeira, importação direta"],
      ["2", "2 — Estrangeira, mercado interno"],
      ["3", "3 — Nacional, importação superior a 40% até 70%"],
      ["4", "4 — Nacional, processo produtivo básico"],
      ["5", "5 — Nacional, importação até 40%"],
      ["6", "6 — Importação direta, sem similar nacional"],
      ["7", "7 — Mercado interno, sem similar nacional"],
      ["8", "8 — Nacional, importação superior a 70%"],
    ],
  }),
  f("commercialUnit", "Unidade comercial", "Unidades"),
  f("taxableUnit", "Unidade tributável", "Unidades"),
  f("taxableConversionFactor", "Fator de conversão", "Unidades", {
    pattern: "[0-9]+(\\.[0-9]{1,6})?",
    hint: "Use ponto decimal. Deve ser maior que zero.",
  }),
  ...[
    "cstIcms",
    "csosn",
    "cstIpi",
    "cstPis",
    "cstCofins",
    "ipiLegalFrameworkCode",
    "benefitCode",
  ].map((key, i) =>
    f(
      key,
      [
        "CST ICMS",
        "CSOSN",
        "CST IPI",
        "CST PIS",
        "CST COFINS",
        "Enquadramento legal IPI",
        "Código de benefício",
      ][i],
      "Tributos atuais",
    ),
  ),
  ...["approximateTaxRate", "ibsRate", "cbsRate", "selectiveTaxRate"].map(
    (key, i) =>
      f(
        key,
        [
          "Tributos aproximados (%)",
          "IBS (%)",
          "CBS (%)",
          "Imposto Seletivo (%)",
        ][i],
        "Alíquotas",
        {
          pattern: "[0-9]+(\\.[0-9]{1,4})?",
          hint: "Até 4 casas decimais; não representa cálculo definitivo.",
        },
      ),
  ),
  ...["cstIbsCbs", "taxClassificationIbsCbs", "selectiveTaxCode"].map(
    (key, i) =>
      f(
        key,
        ["CST IBS/CBS", "Classificação IBS/CBS", "Código do Imposto Seletivo"][
          i
        ],
        "Reforma Tributária",
      ),
  ),
  f("validFrom", "Início da vigência", "Vigência", {
    type: "datetime-local",
    required: true,
  }),
  f("validUntil", "Fim da vigência", "Vigência", { type: "datetime-local" }),
  f("reason", "Justificativa", "Vigência"),
];
export const ruleFields: Field[] = [
  f("fiscalEstablishmentId", "Estabelecimento", "Escopo", { required: true }),
  f("productId", "Produto / SKU comercial do kit", "Escopo", {
    required: true,
  }),
  f("taxType", "Tributo", "Escopo", {
    required: true,
    hint: "ICMS, IPI, PIS, COFINS, FCP, IBS, CBS, IS ou código futuro aprovado.",
  }),
  f("operationType", "Operação", "Escopo", {
    required: true,
    options: [
      ["ENTRY", "Entrada"],
      ["EXIT", "Saída"],
    ],
  }),
  f("customerType", "Destinatário", "Escopo", {
    required: true,
    options: [
      ["ANY", "Todos"],
      ["CONTRIBUTOR", "Contribuinte"],
      ["EXEMPT", "Isento"],
      ["NON_CONTRIBUTOR", "Não contribuinte"],
    ],
  }),
  f("originState", "UF de origem", "Escopo", { options: states }),
  f("destinationState", "UF de destino", "Escopo", { options: states }),
  f("priority", "Prioridade", "Escopo", { required: true, pattern: "[0-9]+" }),
  f("cfop", "CFOP", "Tributação", { pattern: "[123567][0-9]{3}" }),
  f("taxStatusCode", "CST / CSOSN", "Tributação"),
  f("taxClassificationCode", "Classificação tributária", "Tributação"),
  f("calculationMethod", "Método (sem cálculo nesta etapa)", "Tributação", {
    required: true,
    options: [
      ["UNDEFINED", "A definir"],
      ["AD_VALOREM", "Percentual"],
      ["SPECIFIC", "Por quantidade"],
      ["EXEMPT", "Isento"],
      ["OTHER", "Outro"],
    ],
  }),
  ...[
    "rate",
    "calculationBaseReduction",
    "specificQuantityRate",
    "deferredPercentage",
    "fcpRate",
    "benefitCode",
  ].map((key, i) =>
    f(
      key,
      [
        "Alíquota (%)",
        "Redução de base (%)",
        "Alíquota por quantidade",
        "Diferimento (%)",
        "FCP (%)",
        "Benefício fiscal",
      ][i],
      "Tributação",
    ),
  ),
  f("validFrom", "Início da vigência", "Vigência", {
    type: "datetime-local",
    required: true,
  }),
  f("validUntil", "Fim da vigência", "Vigência", { type: "datetime-local" }),
  f("reason", "Justificativa", "Vigência"),
];
export function toForm(data: Record<string, unknown>, fields: Field[]) {
  const values: Record<string, string | boolean> = {};
  for (const field of fields) {
    const [a, b] = field.key.split(".");
    let v = b ? (data[a] as Record<string, unknown> | undefined)?.[b] : data[a];
    if (field.type === "datetime-local" && v) {
      const d = new Date(String(v));
      v = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    }
    values[field.key] =
      field.type === "checkbox"
        ? Boolean(v)
        : formatFiscalValue(field.key, String(v ?? ""));
  }
  return values;
}
export function toPayload(
  values: Record<string, string | boolean>,
  fields: Field[],
) {
  const data: Record<string, unknown> = {};
  for (const field of fields) {
    let v: unknown = values[field.key];
    if (v === "" || v === undefined) continue;
    if (["series", "nextNumber", "priority"].includes(field.key)) v = Number(v);
    if (field.type === "datetime-local") v = new Date(String(v)).toISOString();
    const [a, b] = field.key.split(".");
    if (b) {
      data[a] ??= {};
      (data[a] as Record<string, unknown>)[b] = v;
    } else data[a] = v;
  }
  return data;
}

export function formatFiscalValue(key: string, value: string) {
  if (key === "cnpj") {
    const clean = value.toUpperCase().replace(/[./\-\s]/g, "");
    if (/^[A-Z0-9]{12}\d{2}$/.test(clean))
      return clean.replace(
        /^(.{2})(.{3})(.{3})(.{4})(.{2})$/,
        "$1.$2.$3/$4-$5",
      );
  }
  if (key === "address.postalCode") {
    const clean = value.replace(/[-\s]/g, "");
    if (/^\d{8}$/.test(clean))
      return clean.replace(/^(\d{5})(\d{3})$/, "$1-$2");
  }
  return value;
}
