import "./webhooks.css";
import { useCallback, useEffect, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import { apiRequest } from "../../services/api";
import {
  LinkDrawer,
  LinkPagination,
} from "../../components/marketplace-links/MarketplaceLinksLayout";
import { MarketplaceAccountFilters } from "../../components/marketplace-links/MarketplaceAccountFilters";
import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import "../marketplace-links/marketplace-links.css";
interface WebhookEvent {
  id: string;
  marketplace: string;
  marketplaceAccountId: string;
  eventType: string;
  resource: string;
  externalEventId: string | null;
  status: string;
  attempts: number;
  receivedAt: string;
  processedAt: string | null;
  nextRetryAt: string | null;
  duplicateCount: number;
  lastErrorCode: string | null;
  lastError: string | null;
  correlationId: string;
  durationMs: number | null;
  processingResult: Record<string, unknown> | null;
  adminActions: Array<{ action: string; at: string; userId: string }>;
}
const labels: Record<string, string> = {
  RECEIVED: "Recebido",
  QUEUED: "Na fila",
  PROCESSING: "Processando",
  PROCESSED: "Processado",
  IGNORED: "Ignorado",
  RETRYING: "Nova tentativa",
  FAILED: "Falha",
  DEAD_LETTER: "Tentativas encerradas",
  ORDER_CREATED: "Pedido criado",
  ORDER_UPDATED: "Pedido atualizado",
  ORDER_CANCELLED: "Pedido cancelado",
  PAYMENT_APPROVED: "Pagamento",
  SHIPMENT_UPDATED: "Envio atualizado",
  PRODUCT_UPDATED: "Anúncio / estoque",
  STOCK_UPDATED: "Estoque atualizado",
  UNKNOWN: "Não suportado",
};
export function WebhooksPage() {
  const { activeCompany } = useCompany();
  return <WebhooksForCompany key={activeCompany?.id} />;
}
function WebhooksForCompany() {
  const { activeMembership } = useCompany();
  const [events, setEvents] = useState<WebhookEvent[]>([]),
    [status, setStatus] = useState(""),
    [type, setType] = useState(""),
    [search, setSearch] = useState(""),
    [channel, setChannel] = useState(""),
    [account, setAccount] = useState(""),
    [dateFrom, setDateFrom] = useState(""),
    [dateTo, setDateTo] = useState(""),
    [withError, setWithError] = useState(false),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [pages, setPages] = useState(1),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [detail, setDetail] = useState<WebhookEvent | null>(null),
    [action, setAction] = useState<{
      event: WebhookEvent;
      kind: "retry" | "ignore";
    } | null>(null),
    [busy, setBusy] = useState(false);
  const canAct = ["ADMIN", "MANAGER", "SUPPORT"].includes(
    activeMembership?.role || "",
  );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const q = new URLSearchParams({ page: String(page), limit: "20" });
      if (status) q.set("status", status);
      if (type) q.set("eventType", type);
      if (search) q.set("externalId", search);
      if (channel) q.set("marketplace", channel);
      if (account) q.set("accountId", account);
      if (dateFrom) q.set("dateFrom", new Date(dateFrom).toISOString());
      if (dateTo) q.set("dateTo", new Date(dateTo).toISOString());
      if (withError) q.set("withError", "true");
      try {
        const r = await apiRequest<{
          data: WebhookEvent[];
          meta: { total: number; totalPages: number };
        }>(`/marketplace-webhooks?${q}`, { signal });
        if (signal?.aborted) return;
        setEvents(r.data);
        setTotal(r.meta.total);
        setPages(r.meta.totalPages);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Falha ao carregar eventos.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, status, type, search, channel, account, dateFrom, dateTo, withError],
  );
  useEffect(() => {
    const c = new AbortController();
    const timer = setTimeout(() => void load(c.signal), 300);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [load]);
  async function execute() {
    if (!action || busy) return;
    setBusy(true);
    try {
      await apiRequest(
        `/marketplace-webhooks/${action.event.id}/${action.kind}`,
        { method: "POST" },
      );
      setAction(null);
      await load();
      setMessage(
        action.kind === "retry"
          ? "Reprocessamento registrado para publicação na fila."
          : "Evento ignorado.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao alterar evento.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page ml-page">
      <header className="ml-header">
        <div>
          <span className="eyebrow">Integrações</span>
          <h1>Notificações dos marketplaces</h1>
          <p>
            Acompanhe recebimentos, tentativas e resultados de processamento.
          </p>
        </div>
        <button
          className="ml-button ml-outline"
          disabled={loading}
          onClick={() => void load()}
        >
          Atualizar
        </button>
      </header>
      <div className="ml-toolbar">
        <label className="ml-search">
          <input
            aria-label="Identificador externo"
            placeholder="ID externo exato do evento ou recurso"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os status</option>
          {[
            "RECEIVED",
            "QUEUED",
            "PROCESSING",
            "PROCESSED",
            "IGNORED",
            "RETRYING",
            "FAILED",
            "DEAD_LETTER",
          ].map((s) => (
            <option key={s} value={s}>
              {labels[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Tipo de evento"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Todos os tipos</option>
          {[
            "ORDER_CREATED",
            "ORDER_UPDATED",
            "ORDER_CANCELLED",
            "PAYMENT_APPROVED",
            "SHIPMENT_UPDATED",
            "PRODUCT_UPDATED",
            "STOCK_UPDATED",
            "UNKNOWN",
          ].map((t) => (
            <option key={t} value={t}>
              {labels[t]}
            </option>
          ))}
        </select>
        <label>
          De
          <input
            type="datetime-local"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          Até
          <input
            type="datetime-local"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="webhook-error-filter">
          <input
            type="checkbox"
            checked={withError}
            onChange={(e) => {
              setWithError(e.target.checked);
              setPage(1);
            }}
          />
          Somente com erro
        </label>
        <MarketplaceAccountFilters
          channel={channel}
          account={account}
          onChange={(c, a) => {
            setChannel(c);
            setAccount(a);
            setPage(1);
          }}
        />
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p role="status">Carregando notificações…</p>
      ) : !events.length ? (
        <div className="ml-empty">
          <h2>
            {error ? "Consulta indisponível" : "Nenhuma notificação encontrada"}
          </h2>
          <p>
            Confira os filtros e a configuração das notificações na aplicação do
            marketplace.
          </p>
        </div>
      ) : (
        <div className="ml-surface">
          <div className="ml-table-scroll">
            <table className="data-table webhook-table">
              <thead>
                <tr>
                  {[
                    "Recebimento",
                    "Marketplace / conta",
                    "Tipo",
                    "Recurso",
                    "Status",
                    "Tentativas",
                    "Duração",
                    "Último erro",
                    "Ações",
                  ].map((x) => (
                    <th key={x}>{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.receivedAt).toLocaleString("pt-BR")}</td>
                    <td>
                      {e.marketplace}
                      <br />
                      <small>{e.marketplaceAccountId}</small>
                    </td>
                    <td>{labels[e.eventType] || e.eventType}</td>
                    <td>{e.resource}</td>
                    <td>
                      <span
                        className={`ml-badge ${e.status === "PROCESSED" ? "ml-badge-valid" : e.status === "DEAD_LETTER" ? "ml-badge-invalid" : "ml-badge-warning"}`}
                      >
                        {labels[e.status] || e.status}
                      </span>
                    </td>
                    <td>{e.attempts}</td>
                    <td>
                      {e.durationMs === null ? "—" : `${e.durationMs} ms`}
                    </td>
                    <td>{e.lastError || "—"}</td>
                    <td>
                      <button
                        className="ml-button ml-outline"
                        onClick={() => setDetail(e)}
                      >
                        Detalhes
                      </button>
                      {canAct &&
                        ["FAILED", "DEAD_LETTER", "IGNORED"].includes(
                          e.status,
                        ) && (
                          <button
                            className="ml-button ml-soft"
                            onClick={() =>
                              setAction({ event: e, kind: "retry" })
                            }
                          >
                            Tentar novamente
                          </button>
                        )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <LinkPagination
        page={page}
        pages={pages}
        total={total}
        busy={loading || busy}
        onPage={setPage}
      />
      {detail && (
        <LinkDrawer
          title="Detalhes da notificação"
          busy={busy}
          onClose={() => setDetail(null)}
        >
          <dl className="ml-detail">
            {[
              ["Evento", detail.id],
              ["Correlação", detail.correlationId],
              ["Recurso", detail.resource],
              ["Tipo", labels[detail.eventType]],
              ["Status", labels[detail.status]],
              ["Duplicatas", String(detail.duplicateCount)],
              ["Erro", detail.lastError || "—"],
              [
                "Próxima tentativa",
                detail.nextRetryAt
                  ? new Date(detail.nextRetryAt).toLocaleString("pt-BR")
                  : "—",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {canAct &&
            ["FAILED", "DEAD_LETTER", "IGNORED"].includes(detail.status) && (
              <button
                className="ml-button ml-outline"
                onClick={() => {
                  setAction({ event: detail, kind: "ignore" });
                  setDetail(null);
                }}
              >
                Ignorar evento
              </button>
            )}
        </LinkDrawer>
      )}
      <ConfirmModal
        open={Boolean(action)}
        title={
          action?.kind === "retry"
            ? "Reprocessar notificação?"
            : "Ignorar notificação?"
        }
        busy={busy}
        confirmLabel={action?.kind === "retry" ? "Tentar novamente" : "Ignorar"}
        onCancel={() => setAction(null)}
        onConfirm={() => void execute()}
      >
        <p>
          Recurso: {action?.event.resource}. A operação ficará registrada para
          auditoria.
        </p>
        {error && <p className="form-error">{error}</p>}
      </ConfirmModal>
    </main>
  );
}
