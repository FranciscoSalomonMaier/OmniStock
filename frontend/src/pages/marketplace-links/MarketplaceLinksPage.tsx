import { MarketplaceAccountFilters } from "../../components/marketplace-links/MarketplaceAccountFilters";
import { friendly } from "../../components/marketplace-links/labels";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import {
  MarketplaceLinksLayout,
  LinkBadge,
  ProductInfo,
  LinkEmpty,
  LinkPagination,
  LinkDrawer,
} from "../../components/marketplace-links/MarketplaceLinksLayout";
import { useCompany } from "../../hooks/useCompany";
import { marketplaceLinkService } from "../../services/marketplace-link.service";
import type { ProductMarketplaceLink } from "../../types/marketplace-link";
import "./marketplace-links.css";
export function MarketplaceLinksPage() {
  const { activeCompany } = useCompany();
  return <LinksForCompany key={activeCompany?.id} />;
}
function LinksForCompany() {
  const { activeCompany, activeMembership } = useCompany();
  const [items, setItems] = useState<ProductMarketplaceLink[]>([]),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("ACTIVE"),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [unlinking, setUnlinking] = useState<ProductMarketplaceLink | null>(null),
    [detail, setDetail] = useState<ProductMarketplaceLink | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [channel, setChannel] = useState(""),
    [account, setAccount] = useState("");
  const canManage = ["ADMIN", "MANAGER"].includes(activeMembership?.role || ""),
    canValidate = ["ADMIN", "MANAGER", "STOCKIST"].includes(
      activeMembership?.role || "",
    );
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const q = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "linkedAt",
        sortDirection: "desc",
      });
      if (search) q.set("search", search);
      if (status) q.set("status", status);
      if (channel) q.set("channelCode", channel);
      if (account) q.set("connectionId", account);
      try {
        const r = await marketplaceLinkService.list(q, signal);
        if (signal?.aborted) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPages(r.meta.totalPages);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Falha ao carregar vínculos.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [search, status, page, channel, account],
  );
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => void load(c.signal), 300);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [activeCompany?.id, load]);
  async function validate(item: ProductMarketplaceLink) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await marketplaceLinkService.validate(item.id);
      await load();
      setMessage("Validação concluída. Confira o resultado no vínculo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao validar vínculo.");
    } finally {
      setBusy(false);
    }
  }
  async function unlink() {
    if (!unlinking || busy) return;
    setBusy(true);
    try {
      await marketplaceLinkService.unlink(unlinking.id, reason);
      setUnlinking(null);
      setReason("");
      await load();
      setMessage("Anúncio desvinculado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao desvincular.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MarketplaceLinksLayout
      title="Vinculação de anúncios"
      description="Gerencie os produtos vinculados aos marketplaces."
      count={loading ? undefined : total}
      action={
        <Link className="ml-button ml-primary" to="/marketplace-links/unlinked">
          + Vincular anúncio
        </Link>
      }
    >
      <div className="ml-toolbar">
        <label className="ml-search">
          <span className="ml-sr-only">Pesquisar vínculos</span>
          <input
            placeholder="Buscar produto, SKU, anúncio ou ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setLoading(true);
            }}
          />
        </label>
        <label>
          <span className="ml-sr-only">Status do vínculo</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setLoading(true);
            }}
          >
            <option value="">Todo o histórico</option>
            <option value="ACTIVE">Ativos</option>
            <option value="INACTIVE">Desvinculados</option>
            <option value="INVALID">Inválidos</option>
            <option value="PENDING_VALIDATION">Aguardando validação</option>
          </select>
        </label>
        <MarketplaceAccountFilters
          channel={channel}
          account={account}
          onChange={(c, a) => {
            setChannel(c);
            setAccount(a);
            setPage(1);
            setLoading(true);
          }}
        />
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && items.length > 0 && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {loading || error || !items.length ? (
        <LinkEmpty
          loading={loading}
          error={error}
          filtered={Boolean(
            search || status !== "ACTIVE" || channel || account,
          )}
          title="Nenhum vínculo encontrado."
          description="Os anúncios vinculados aos produtos aparecerão aqui."
        />
      ) : (
        <section className="ml-surface">
          <div className="ml-section-title">
            <h2>Produtos vinculados</h2>
            <span>{total} resultados</span>
          </div>
          <div className="ml-table-scroll">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>Produto interno</th>
                  <th>Marketplace / conta</th>
                  <th>Anúncio externo</th>
                  <th>Validação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <ProductInfo
                        name={item.product.name}
                        sku={item.product.sku}
                      />
                    </td>
                    <td>
                      <strong>{item.channel.name}</strong>
                      <small>{item.connection.name}</small>
                    </td>
                    <td>
                      <strong className="ml-clamp" title={item.listing.title}>
                        {item.listing.title}
                      </strong>
                      <small>
                        {item.listing.externalItemId}
                        {item.listing.externalVariationId &&
                          ` / ${item.listing.externalVariationId}`}
                      </small>
                    </td>
                    <td>
                      <LinkBadge status={item.lastValidation.status} />
                      {item.lastValidation.message && (
                        <small
                          className="ml-clamp"
                          title={item.lastValidation.message}
                        >
                          {item.lastValidation.message}
                        </small>
                      )}
                    </td>
                    <td>
                      <div className="ml-row-actions">
                        {canValidate &&
                          item.status === "ACTIVE" &&
                          item.lastValidation.status !== "VALID" && (
                            <button
                              className="ml-button ml-soft"
                              disabled={busy}
                              onClick={() => void validate(item)}
                            >
                              Validar
                            </button>
                          )}
                        <details className="ml-menu">
                          <summary
                            aria-label={`Ações para ${item.product.sku}`}
                          >
                            •••
                          </summary>
                          <div>
                            <button onClick={() => setDetail(item)}>
                              Visualizar detalhes
                            </button>
                            {canValidate && item.status === "ACTIVE" && (
                              <button
                                disabled={busy}
                                onClick={() => void validate(item)}
                              >
                                Validar vínculo
                              </button>
                            )}
                            {canManage && item.status === "ACTIVE" && (
                              <button
                                className="ml-danger-text"
                                disabled={busy}
                                onClick={() => setUnlinking(item)}
                              >
                                Desvincular
                              </button>
                            )}
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
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
          title="Detalhes do vínculo"
          busy={busy}
          onClose={() => setDetail(null)}
        >
          <ProductInfo name={detail.product.name} sku={detail.product.sku} />
          <dl className="ml-detail">
            {[
              ["Anúncio", detail.listing.title],
              ["ID externo", detail.listing.externalItemId],
              [
                "Variação",
                detail.listing.externalVariationId || "Sem variação",
              ],
              ["SKU externo", detail.listing.externalSku || "Não informado"],
              ["Marketplace", detail.channel.name],
              ["Conta", detail.connection.name],
              ["Origem", friendly[detail.linkSource] || detail.linkSource],
              ["Situação", friendly[detail.status] || detail.status],
              ["Vinculado por", detail.linkedBy.name],
              [
                "Data do vínculo",
                new Date(detail.linkedAt).toLocaleString("pt-BR"),
              ],
              ["Validação", detail.lastValidation.message || "Não validado"],
              ["Motivo de desvinculação", detail.unlinkReason || "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </LinkDrawer>
      )}
      <ConfirmModal
        open={Boolean(unlinking)}
        title="Desvincular anúncio?"
        confirmLabel="Desvincular"
        busy={busy}
        onCancel={() => {
          setUnlinking(null);
          setReason("");
        }}
        onConfirm={() => void unlink()}
      >
        <p>
          O anúncio deixará de receber sincronizações do produto{" "}
          <strong>{unlinking?.product.sku}</strong>. O histórico será
          preservado.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <textarea
          className="unlink-reason"
          maxLength={500}
          placeholder="Motivo (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </ConfirmModal>
    </MarketplaceLinksLayout>
  );
}
