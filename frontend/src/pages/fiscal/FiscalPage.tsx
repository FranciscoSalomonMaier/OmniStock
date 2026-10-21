import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { apiRequest, ApiError } from "../../services/api";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import { FiscalForm } from "./FiscalForm";
import {
  establishmentFields,
  settingFields,
  ruleFields,
  warning,
  reviewLabel,
  type FiscalRecord,
  type Field,
} from "./fiscal-model";
import "./fiscal.css";
const tabs = [
  ["", "Visão geral"],
  ["establishments", "Estabelecimentos"],
  ["document-settings", "Configuração da NF-e"],
  ["tax-rules", "Regras tributárias"],
  ["readiness", "Prontidão"],
  ["audit", "Auditoria"],
];
export function FiscalPage() {
  const { activeCompany } = useCompany();
  const { pathname } = useLocation();
  return (
    <FiscalContent
      key={`${activeCompany?.id}:${pathname}`}
      section={pathname.split("/")[2] || ""}
    />
  );
}
function FiscalContent({ section }: { section: string }) {
  const [data, setData] = useState<FiscalRecord[]>([]),
    [overview, setOverview] = useState<Record<string, unknown>>({}),
    [permissions, setPermissions] = useState<string[]>([]),
    [establishments, setEstablishments] = useState<FiscalRecord[]>([]),
    [products, setProducts] = useState<FiscalRecord[]>([]),
    [error, setError] = useState(""),
    [fieldErrors, setFieldErrors] = useState<
      Record<string, string[]> | undefined
    >(),
    [loading, setLoading] = useState(true),
    [editing, setEditing] = useState<Record<string, unknown> | null>(null),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState(""),
    [readiness, setReadiness] = useState<{
      ready: boolean;
      errors: { message: string }[];
      warnings: { message: string }[];
    } | null>(null),
    [target, setTarget] = useState("company"),
    [targetId, setTargetId] = useState("");
  const permGroup =
    section === "document-settings"
      ? "document_settings"
      : section === "tax-rules"
        ? "tax_rules"
        : "establishments";
  const can = (p: string) => permissions.includes("fiscal." + p);
  function report(e: unknown) {
    setError((e as Error).message);
    setFieldErrors(e instanceof ApiError ? e.fieldErrors : undefined);
  }
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const per = await apiRequest<string[]>("/fiscal/permissions");
        if (!alive) return;
        setPermissions(per);
        if (!section) {
          const o = await apiRequest<Record<string, unknown>>("/fiscal");
          if (alive) setOverview(o);
        } else if (section !== "readiness") {
          const r = await apiRequest<{
            data: FiscalRecord[];
            meta?: { total: number };
          }>(`/fiscal/${section}?page=${page}&limit=20`);
          if (alive) {
            setData(r.data);
            setTotal(r.meta?.total ?? r.data.length);
          }
        }
        if (per.includes("fiscal.establishments.read")) {
          const e = await apiRequest<{ data: FiscalRecord[] }>(
            "/fiscal/establishments?limit=100",
          );
          if (alive) setEstablishments(e.data);
        }
        if (section === "tax-rules" || section === "readiness") {
          const p = await apiRequest<{ data: FiscalRecord[] }>(
            "/products?limit=100",
          );
          if (alive) setProducts(p.data);
        }
      } catch (e) {
        if (alive) report(e);
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [section, page, revision]);
  async function mutate(path: string, body?: unknown, method = "POST") {
    try {
      await apiRequest(path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
      });
      setEditing(null);
      setRevision((r) => r + 1);
      setMessage("Configuração atualizada com sucesso.");
    } catch (e) {
      report(e);
    }
  }
  async function review(row: FiscalRecord) {
    const note = prompt("Observação da revisão:");
    if (!note) return;
    const accountantReference = prompt("Nome ou referência do contador:");
    if (!accountantReference) return;
    const decision = confirm(
      "Aprovar esta configuração? Cancelar registra rejeição.",
    )
      ? "APPROVED"
      : "REJECTED";
    await mutate(`/fiscal/${section}/${row.id}/approve`, {
      note,
      accountantReference,
      decision,
    });
  }
  async function edit(row: FiscalRecord) {
    try {
      const d =
        section === "establishments"
          ? await apiRequest<FiscalRecord>(`/fiscal/establishments/${row.id}`)
          : row;
      setEditing(d);
    } catch (e) {
      report(e);
    }
  }
  let fields: Field[] =
    section === "establishments"
      ? establishmentFields
      : section === "document-settings"
        ? settingFields
        : ruleFields;
  fields = fields.map((f) =>
    f.key === "fiscalEstablishmentId"
      ? {
          ...f,
          options: establishments.map(
            (e) => [e.id, String(e.name)] as [string, string],
          ),
        }
      : f.key === "productId"
        ? {
            ...f,
            options: products.map(
              (p) => [p.id, `${p.sku} — ${p.name}`] as [string, string],
            ),
          }
        : f,
  );
  const est = overview.establishment as FiscalRecord | undefined;
  return (
    <main className="fiscal-page">
      <header>
        <div>
          <span className="fiscal-eyebrow">Configuração fiscal</span>
          <h1>{tabs.find(([key]) => key === section)?.[1] || "Fiscal"}</h1>
          <p>Cadastros, revisão contábil e preparação para futura emissão.</p>
        </div>
      </header>
      <nav aria-label="Fiscal">
        {tabs.map(([key, label]) => (
          <Link
            className={section === key ? "selected" : ""}
            key={key}
            to={`/fiscal${key ? "/" + key : ""}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <p className="fiscal-warning">{warning}</p>
      {message && (
        <p role="status" className="fiscal-success">
          {message}
        </p>
      )}
      {loading ? (
        <p>Carregando configurações…</p>
      ) : (
        <>
          {!section && (
            <>
              <div className="fiscal-cards">
                {[
                  ["Estabelecimento padrão", est?.name || "Não definido"],
                  ["CNPJ", est?.cnpj || "Não informado"],
                  [
                    "Regime",
                    reviewLabel[String(est?.taxRegime)] || "Não configurado",
                  ],
                  [
                    "Produtos tecnicamente completos",
                    overview.completeProducts ?? 0,
                  ],
                  ["Produtos com pendências", overview.pendingProducts ?? 0],
                  ["Aguardando revisão", overview.pendingReviews ?? 0],
                ].map(([label, value]) => (
                  <article key={String(label)}>
                    <small>{String(label)}</small>
                    <strong>{String(value)}</strong>
                  </article>
                ))}
              </div>
              <h2>Sequências ativas</h2>
              {(overview.settings as FiscalRecord[] | undefined)?.length ? (
                (overview.settings as FiscalRecord[]).map((s) => (
                  <article className="fiscal-card" key={s.id}>
                    <span
                      className={`fiscal-badge ${s.environment === "HOMOLOGATION" ? "homologation" : ""}`}
                    >
                      {reviewLabel[String(s.environment)]}
                    </span>{" "}
                    Série {String(s.series)} · Próximo número{" "}
                    {String(s.nextNumber)}
                  </article>
                ))
              ) : (
                <p className="fiscal-empty">
                  Nenhuma sequência ativa. Configure o estabelecimento e a NF-e.
                </p>
              )}
              <p>
                Prontidão técnica não é garantia de conformidade fiscal. Este
                módulo não emite notas.
              </p>
            </>
          )}
          {["establishments", "document-settings", "tax-rules"].includes(
            section,
          ) && (
            <>
              {can(permGroup + ".manage") && (
                <button
                  className="primary"
                  onClick={() =>
                    setEditing({
                      documentModel: "55",
                      environment: "HOMOLOGATION",
                      emissionType: "1",
                      active: true,
                      priority: 0,
                      validFrom: new Date().toISOString(),
                    })
                  }
                >
                  ＋ Nova configuração
                </button>
              )}
              {editing && (
                <section className="fiscal-card">
                  <h2>
                    {editing.id ? "Editar configuração" : "Nova configuração"}
                  </h2>
                  {section === "document-settings" && editing.id ? (
                    <p>
                      A identidade da sequência é preservada. Use as ações da
                      listagem para ativar, desativar ou corrigir o próximo
                      número.
                    </p>
                  ) : (
                    <FiscalForm
                      key={String(editing.id || "new")}
                      fields={fields}
                      initial={editing}
                      onCancel={() => setEditing(null)}
                      onSave={async (d) => {
                        if (
                          editing.id &&
                          !confirm(
                            "Confirmar alteração fiscal? A revisão anterior será invalidada.",
                          )
                        )
                          return;
                        await mutate(
                          `/fiscal/${section}${editing.id ? "/" + editing.id : ""}`,
                          d,
                          editing.id ? "PATCH" : "POST",
                        );
                      }}
                    />
                  )}
                  <button onClick={() => setEditing(null)}>Fechar</button>
                </section>
              )}
              <div className="fiscal-table">
                <table>
                  <thead>
                    <tr>
                      <th>Configuração</th>
                      <th>Situação</th>
                      <th>Revisão / ambiente</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>
                            {String(row.name || row.taxType || "NF-e")}
                          </strong>
                          <small>
                            {section === "establishments"
                              ? String(row.cnpj)
                              : section === "tax-rules"
                                ? `${products.find((p) => p.id === row.productId)?.name || row.productId} · ${row.operationType} · v${row.version}`
                                : `Série ${row.series} · Próximo ${row.nextNumber}`}
                          </small>
                        </td>
                        <td>
                          <span className="fiscal-badge">
                            {row.active ? "Ativo" : "Inativo"}
                          </span>
                          {row.isDefault === true && (
                            <small>Padrão da empresa</small>
                          )}
                        </td>
                        <td>
                          <span
                            className={`fiscal-badge ${row.environment === "HOMOLOGATION" ? "homologation" : ""}`}
                          >
                            {
                              reviewLabel[
                                String(
                                  row.accountantReviewStatus || row.environment,
                                )
                              ]
                            }
                          </span>
                        </td>
                        <td>
                          <div className="fiscal-actions">
                            {can(permGroup + ".manage") && (
                              <>
                                {section !== "document-settings" && (
                                  <button onClick={() => void edit(row)}>
                                    Editar
                                  </button>
                                )}
                                {section === "establishments" &&
                                  row.active &&
                                  !row.isDefault && (
                                    <button
                                      onClick={() =>
                                        void mutate(
                                          `/fiscal/establishments/${row.id}/set-default`,
                                        )
                                      }
                                    >
                                      Definir padrão
                                    </button>
                                  )}
                                {section !== "establishments" && (
                                  <button
                                    onClick={() => {
                                      const reason = prompt(
                                        "Justificativa para " +
                                          (row.active
                                            ? "desativar"
                                            : "ativar") +
                                          ":",
                                      );
                                      if (!reason) return;
                                      const confirmProduction =
                                        row.environment === "PRODUCTION" &&
                                        !row.active
                                          ? confirm(
                                              "Confirmar ativação em PRODUÇÃO?",
                                            )
                                          : false;
                                      if (
                                        row.environment === "PRODUCTION" &&
                                        !row.active &&
                                        !confirmProduction
                                      )
                                        return;
                                      void mutate(
                                        `/fiscal/${section}/${row.id}/${row.active ? "deactivate" : "activate"}`,
                                        {
                                          reason,
                                          ...(section === "document-settings"
                                            ? { confirmProduction }
                                            : {}),
                                        },
                                      );
                                    }}
                                  >
                                    {row.active ? "Desativar" : "Ativar"}
                                  </button>
                                )}
                              </>
                            )}
                            {section === "document-settings" &&
                              can("document_settings.change_number") && (
                                <button
                                  onClick={() => {
                                    const value = prompt(
                                      "Novo próximo número:",
                                      String(row.nextNumber),
                                    );
                                    if (!value) return;
                                    const reason = prompt(
                                      "Justificativa obrigatória:",
                                    );
                                    if (!reason) return;
                                    const nextNumber = Number(value);
                                    const allowDecrease =
                                      nextNumber < Number(row.nextNumber)
                                        ? confirm(
                                            "Autorizar explicitamente a redução do próximo número?",
                                          )
                                        : false;
                                    if (
                                      nextNumber < Number(row.nextNumber) &&
                                      !allowDecrease
                                    )
                                      return;
                                    void mutate(
                                      `/fiscal/document-settings/${row.id}/change-next-number`,
                                      {
                                        nextNumber,
                                        reason,
                                        expectedVersion: row.numberVersion,
                                        allowDecrease,
                                      },
                                    );
                                  }}
                                >
                                  Corrigir número
                                </button>
                              )}
                            {section !== "document-settings" &&
                              can("review.submit") && (
                                <button
                                  onClick={() =>
                                    void mutate(
                                      `/fiscal/${section}/${row.id}/submit-review`,
                                    )
                                  }
                                >
                                  Enviar para revisão
                                </button>
                              )}
                            {row.accountantReviewStatus === "PENDING_REVIEW" &&
                              can("review.approve") && (
                                <button onClick={() => void review(row)}>
                                  Registrar revisão
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.length && (
                  <p className="fiscal-empty">
                    Nenhuma configuração encontrada.
                  </p>
                )}
              </div>
              <div className="fiscal-actions">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  disabled={page * 20 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
            </>
          )}
          {section === "readiness" && (
            <section className="fiscal-card">
              <h2>Consultar pendências técnicas</h2>
              <div className="fiscal-grid">
                <label>
                  Cadastro
                  <select
                    value={target}
                    onChange={(e) => {
                      setTarget(e.target.value);
                      setTargetId("");
                      setReadiness(null);
                    }}
                  >
                    <option value="company">Estabelecimento</option>
                    <option value="product">Produto / kit</option>
                    <option value="order">Pedido</option>
                  </select>
                </label>
                <label>
                  Registro
                  {target === "order" ? (
                    <input
                      placeholder="ID interno do pedido"
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    />
                  ) : (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {(target === "company" ? establishments : products).map(
                        (r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                </label>
              </div>
              <button
                disabled={!targetId}
                onClick={async () => {
                  try {
                    setReadiness(
                      await apiRequest(
                        `/fiscal/readiness/${target}/${targetId}`,
                      ),
                    );
                  } catch (e) {
                    report(e);
                  }
                }}
              >
                Verificar prontidão
              </button>
              {readiness && (
                <div role="status">
                  <h3>
                    {readiness.ready
                      ? "Sem impedimentos técnicos detectados"
                      : "Existem pendências técnicas"}
                  </h3>
                  <h4>Impedimentos</h4>
                  {readiness.errors.length ? (
                    <ul>
                      {readiness.errors.map((e, i) => (
                        <li key={i}>{e.message}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>Nenhum.</p>
                  )}
                  <h4>Avisos e revisão necessária</h4>
                  <ul>
                    {readiness.warnings.map((e, i) => (
                      <li key={i}>{e.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}
          {section === "audit" && (
            <>
              <div className="fiscal-table">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Entidade / ação</th>
                      <th>Responsável / justificativa</th>
                      <th>Alteração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {new Date(String(row.created_at)).toLocaleString(
                            "pt-BR",
                          )}
                        </td>
                        <td>
                          {String(row.entity_type)}
                          <small>{String(row.action)}</small>
                        </td>
                        <td>
                          {String(row.performed_by || "Migração")}
                          <small>{String(row.reason || "—")}</small>
                        </td>
                        <td>
                          <details>
                            <summary>Ver histórico</summary>
                            <pre>
                              {JSON.stringify(
                                {
                                  anterior: row.previous_data,
                                  novo: row.new_data,
                                },
                                null,
                                2,
                              )}
                            </pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.length && (
                  <p className="fiscal-empty">
                    Nenhuma alteração fiscal registrada.
                  </p>
                )}
              </div>
              <div className="fiscal-actions">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>Página {page}</span>
                <button
                  disabled={data.length < 20}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </button>
              </div>
            </>
          )}
        </>
      )}
      <ErrorDialog
        open={Boolean(error)}
        title="Não foi possível concluir a operação fiscal"
        message={error}
        fieldErrors={fieldErrors}
        onClose={() => setError("")}
      />
    </main>
  );
}
