import { MarketplaceAccountFilters } from "../../components/marketplace-links/MarketplaceAccountFilters";
import { friendly } from "../../components/marketplace-links/labels";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import {
  MarketplaceLinksLayout,
  ProductInfo,
  LinkBadge,
  LinkDrawer,
  LinkPagination,
  LinkEmpty,
} from "../../components/marketplace-links/MarketplaceLinksLayout";
import { useCompany } from "../../hooks/useCompany";
import { marketplaceLinkService } from "../../services/marketplace-link.service";
import type { Product } from "../../types/product";
import type { UnlinkedListingItem } from "../../types/marketplace-link";
import "./marketplace-links.css";
export function UnlinkedMarketplaceListingsPage({
  suggestionsOnly = false,
}: {
  suggestionsOnly?: boolean;
}) {
  const { activeCompany } = useCompany();
  return (
    <ListingsForCompany
      key={`${activeCompany?.id}:${suggestionsOnly}`}
      suggestionsOnly={suggestionsOnly}
    />
  );
}
function ListingsForCompany({ suggestionsOnly }: { suggestionsOnly: boolean }) {
  const { connectionId } = useParams();
  const { activeMembership } = useCompany();
  const [items, setItems] = useState<UnlinkedListingItem[]>([]),
    [selected, setSelected] = useState<UnlinkedListingItem | null>(null),
    [products, setProducts] = useState<Product[]>([]),
    [selectedProduct, setSelectedProduct] = useState<Product | null>(null),
    [search, setSearch] = useState(""),
    [productSearch, setProductSearch] = useState(""),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [drawerError, setDrawerError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(true),
    [productsLoading, setProductsLoading] = useState(false),
    [productPage, setProductPage] = useState(1),
    [productPages, setProductPages] = useState(1),
    [productTotal, setProductTotal] = useState(0),
    [confirming, setConfirming] = useState(false),
    [bulkConfirm, setBulkConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [checked, setChecked] = useState<Record<string, boolean>>({}),
    [results, setResults] = useState<
      Array<{ id: string; success: boolean; message: string }>
    >([]),
    [status, setStatus] = useState(""),
    [channel, setChannel] = useState(""),
    [account, setAccount] = useState(connectionId || "");
  const canLink = ["ADMIN", "MANAGER", "STOCKIST"].includes(
      activeMembership?.role || "",
    ),
    canBulk = ["ADMIN", "MANAGER"].includes(activeMembership?.role || ""),
    canCreate = ["ADMIN", "MANAGER"].includes(activeMembership?.role || "");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      const q = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) q.set("search", search);
      if (account) q.set("connectionId", account);
      if (channel) q.set("channelCode", channel);
      if (suggestionsOnly) q.set("withSuggestion", "true");
      if (status) q.set("status", status);
      try {
        const r = await marketplaceLinkService.unlinkedListings(q, signal);
        if (signal?.aborted) return;
        setItems(r.data);
        setPages(r.meta.totalPages);
        setTotal(r.meta.total);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error ? e.message : "Falha ao carregar anúncios.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, search, account, channel, suggestionsOnly, status],
  );
  useEffect(() => {
    const c = new AbortController();
    const t = setTimeout(() => void load(c.signal), 300);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    const c = new AbortController();
    const t = setTimeout(async () => {
      setProductsLoading(true);
      try {
        const q = new URLSearchParams({
          page: String(productPage),
          limit: "20",
          status: "ACTIVE",
          sortBy: "sku",
          sortDirection: "asc",
        });
        if (productSearch) q.set("search", productSearch);
        const r = await marketplaceLinkService.products(q, c.signal);
        if (c.signal.aborted) return;
        setProducts(r.data);
        setProductPages(r.meta.totalPages);
        setProductTotal(r.meta.total);
        setSelectedProduct(
          (current) =>
            current ||
            r.data.find((p) => p.id === selected.suggestion?.productId) ||
            null,
        );
        setDrawerError("");
      } catch (e) {
        if (!c.signal.aborted)
          setDrawerError(
            e instanceof Error ? e.message : "Falha ao pesquisar produtos.",
          );
      } finally {
        if (!c.signal.aborted) setProductsLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      c.abort();
    };
  }, [selected, productSearch, productPage]);
  const eligible = items.filter((x) => x.suggestion);
  const bulkItems = useMemo(
    () => items.filter((x) => checked[x.listing.id] && x.suggestion),
    [items, checked],
  );
  function open(item: UnlinkedListingItem) {
    setSelected(item);
    setSelectedProduct(null);
    setProductSearch("");
    setProductPage(1);
    setProducts([]);
    setProductsLoading(true);
    setDrawerError("");
    setConfirming(false);
  }
  function close() {
    if (busy) return;
    setConfirming(false);
    setSelected(null);
  }
  async function link() {
    if (!selected || !selectedProduct || busy) return;
    setBusy(true);
    setDrawerError("");
    try {
      if (selected.suggestion?.productId === selectedProduct.id)
        await marketplaceLinkService.acceptSuggestion(
          selected.listing.id,
          selectedProduct.id,
        );
      else
        await marketplaceLinkService.create(
          selectedProduct.id,
          selected.listing.id,
        );
      setSelected(null);
      setConfirming(false);
      setChecked({});
      await load();
      setMessage("Anúncio vinculado com sucesso.");
    } catch (e) {
      const text = e instanceof Error ? e.message : "Falha ao vincular.";
      setConfirming(false);
      await load();
      setDrawerError(text);
    } finally {
      setBusy(false);
    }
  }
  async function bulk() {
    if (!bulkItems.length || busy) return;
    setBusy(true);
    const snapshot = [...bulkItems];
    try {
      const r = await marketplaceLinkService.bulk(
        snapshot.map((x) => ({
          productId: x.suggestion!.productId,
          marketplaceListingId: x.listing.id,
        })),
      );
      setResults(
        r.results.map((result, i) => ({
          id:
            snapshot[Number(result.index ?? i)]?.listing.externalItemId ||
            "Anúncio",
          success: result.success === true,
          message:
            result.success === true
              ? "Vinculado com sucesso"
              : String(result.message || "Falha ao vincular"),
        })),
      );
      setBulkConfirm(false);
      setChecked({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no vínculo em lote.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MarketplaceLinksLayout
      title={
        suggestionsOnly ? "Sugestões de vínculo" : "Anúncios não vinculados"
      }
      description={
        suggestionsOnly
          ? "Revise as correspondências identificadas entre anúncios e produtos."
          : "Encontre e vincule anúncios aos produtos do seu estoque."
      }
      count={loading ? undefined : suggestionsOnly ? items.length : total}
      action={
        <Link className="ml-button ml-outline" to="/marketplace-links">
          Ver vínculos
        </Link>
      }
    >
      <div className="ml-toolbar">
        <label className="ml-search">
          <span className="ml-sr-only">Pesquisar anúncios</span>
          <input
            placeholder="Buscar anúncio, SKU ou identificador…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
              setChecked({});
              setLoading(true);
            }}
          />
        </label>
        <label>
          <span className="ml-sr-only">Status do anúncio</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
              setChecked({});
              setLoading(true);
            }}
          >
            <option value="">Todos os status</option>
            <option value="active">Ativos</option>
            <option value="paused">Pausados</option>
            <option value="closed">Encerrados</option>
          </select>
        </label>
        <MarketplaceAccountFilters
          channel={channel}
          account={account}
          lockedAccount={Boolean(connectionId)}
          onChange={(c, a) => {
            setChannel(c);
            setAccount(a);
            setPage(1);
            setChecked({});
            setLoading(true);
          }}
        />
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {results.length > 0 && (
        <section
          className="ml-bulk-results"
          aria-label="Resultados da vinculação em lote"
        >
          <h2>Resultado por anúncio</h2>
          {results.map((r, i) => (
            <p key={`${r.id}:${i}`}>
              <LinkBadge status={r.success ? "VALID" : "INVALID"} />{" "}
              <strong>{r.id}</strong> · {r.message}
            </p>
          ))}
        </section>
      )}
      {canBulk && eligible.length > 0 && !loading && !error && (
        <div className="ml-selection">
          <label>
            <input
              type="checkbox"
              checked={eligible.every((x) => checked[x.listing.id])}
              disabled={busy}
              onChange={(e) =>
                setChecked(
                  e.target.checked
                    ? Object.fromEntries(
                        eligible.map((x) => [x.listing.id, true]),
                      )
                    : {},
                )
              }
            />
            Selecionar todas as sugestões desta página
          </label>
          <button
            className="ml-button ml-primary"
            disabled={!bulkItems.length || busy}
            onClick={() => setBulkConfirm(true)}
          >
            Vincular selecionados ({bulkItems.length})
          </button>
        </div>
      )}
      {loading || error || !items.length ? (
        <>
          <LinkEmpty
            loading={loading}
            error={error}
            filtered={Boolean(search || status || channel || account)}
            title={
              suggestionsOnly
                ? "Nenhuma sugestão disponível no momento."
                : "Nenhum anúncio sem vínculo encontrado."
            }
            description={
              suggestionsOnly
                ? "Não encontramos correspondências para revisar. Você ainda pode vincular anúncios manualmente."
                : "Todos os anúncios importados podem já estar vinculados ou não há anúncios disponíveis para esta empresa."
            }
          />
          {suggestionsOnly && !loading && !error && (
            <Link
              className="ml-button ml-outline"
              to="/marketplace-links/unlinked"
            >
              Ver anúncios não vinculados
            </Link>
          )}
        </>
      ) : (
        <section
          className={`ml-surface ${suggestionsOnly ? "ml-suggestions" : ""}`}
        >
          <div className="ml-section-title">
            <h2>
              {suggestionsOnly
                ? "Correspondências para revisar"
                : "Anúncios sem vínculo"}
            </h2>
            <span>{items.length} nesta página</span>
          </div>
          {items.map((item) => (
            <article
              key={item.listing.id}
              className={
                suggestionsOnly ? "ml-suggestion-card" : "ml-listing-row"
              }
            >
              {suggestionsOnly && (
                <div className="ml-suggestion-top">
                  <span className="ml-badge ml-badge-valid">
                    {friendly[item.suggestion?.matchedBy || "NONE"] ||
                      "Correspondência identificada"}
                  </span>
                  <small>{item.listing.externalItemId}</small>
                </div>
              )}
              <div
                className={
                  suggestionsOnly ? "ml-match-grid" : "ml-listing-main"
                }
              >
                <div>
                  {suggestionsOnly && (
                    <span className="ml-field-caption">Anúncio externo</span>
                  )}
                  <ProductInfo
                    name={item.listing.title}
                    sku={item.listing.externalSku}
                    image={item.listing.thumbnailUrl}
                  />
                  <div className="ml-listing-meta">
                    <span>
                      {item.listing.externalItemId}
                      {item.listing.externalVariationId &&
                        ` / ${item.listing.externalVariationId}`}
                    </span>
                    <span>
                      {item.listing.channel?.name} ·{" "}
                      {item.listing.connection?.name}
                    </span>
                    <span>
                      {item.listing.currency} {item.listing.price} · Estoque:{" "}
                      {item.listing.availableQuantity ?? "—"}
                    </span>
                    <LinkBadge status={item.listing.status} />
                  </div>
                </div>
                {suggestionsOnly && item.suggestion && (
                  <div>
                    <span className="ml-field-caption">
                      Produto interno sugerido
                    </span>
                    <ProductInfo
                      name={item.suggestion.name}
                      sku={item.suggestion.sku}
                    />
                  </div>
                )}
              </div>
              <div className="ml-listing-actions">
                {canBulk && item.suggestion && (
                  <label className="ml-checkbox">
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${item.listing.externalItemId}`}
                      disabled={busy}
                      checked={Boolean(checked[item.listing.id])}
                      onChange={(e) =>
                        setChecked((current) => ({
                          ...current,
                          [item.listing.id]: e.target.checked,
                        }))
                      }
                    />
                    Selecionar
                  </label>
                )}
                {canLink && (
                  <>
                    {suggestionsOnly && (
                      <button
                        className="ml-button ml-outline"
                        disabled={busy}
                        onClick={() => open(item)}
                      >
                        Alterar produto
                      </button>
                    )}
                    <button
                      className="ml-button ml-primary"
                      disabled={busy}
                      onClick={() => open(item)}
                    >
                      {suggestionsOnly ? "Revisar vínculo" : "Vincular →"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
      <LinkPagination
        page={page}
        pages={pages}
        total={suggestionsOnly ? items.length : total}
        pageCountOnly={suggestionsOnly}
        busy={loading || busy}
        onPage={(p) => {
          setPage(p);
          setChecked({});
          setLoading(true);
        }}
      />
      {selected && (
        <LinkDrawer
          title="Vincular produto"
          busy={busy}
          onClose={() => {
            if (confirming) setConfirming(false);
            else close();
          }}
        >
          <div className="ml-drawer-listing">
            <ProductInfo
              name={selected.listing.title}
              sku={selected.listing.externalSku}
              image={selected.listing.thumbnailUrl}
            />
            <p>
              {selected.listing.channel?.name} ·{" "}
              {selected.listing.connection?.name}
            </p>
            <small>
              {selected.listing.externalItemId}
              {selected.listing.externalVariationId &&
                ` / ${selected.listing.externalVariationId}`}
            </small>
          </div>
          {drawerError && (
            <p className="form-error" role="alert">
              {drawerError}
            </p>
          )}
          {confirming ? (
            <div className="ml-drawer-confirm">
              <h3>Confirmar vinculação?</h3>
              <p>
                O anúncio <strong>{selected.listing.externalItemId}</strong>{" "}
                será vinculado ao produto{" "}
                <strong>{selectedProduct?.sku}</strong>.
              </p>
              <p>Nenhum estoque ou preço será alterado nesta operação.</p>
              <button
                className="ml-button ml-primary"
                disabled={busy}
                onClick={() => void link()}
              >
                {busy ? "Vinculando…" : "Confirmar vínculo"}
              </button>
              <button
                className="ml-button ml-outline"
                disabled={busy}
                onClick={() => setConfirming(false)}
              >
                Voltar à seleção
              </button>
            </div>
          ) : (
            <>
              <h3>Selecione um produto interno</h3>
              <label className="ml-search">
                <span className="ml-sr-only">Pesquisar produtos internos</span>
                <input
                  autoComplete="off"
                  placeholder="Buscar por nome, SKU ou código de barras…"
                  disabled={busy}
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setProductPage(1);
                    setProductsLoading(true);
                  }}
                />
              </label>
              {selectedProduct && (
                <p className="notice">
                  Selecionado: {selectedProduct.sku} · {selectedProduct.name}
                </p>
              )}
              <div
                className="ml-product-results"
                role="group"
                aria-label="Produtos disponíveis"
              >
                {productsLoading ? (
                  <p role="status">Pesquisando produtos…</p>
                ) : drawerError ? null : !products.length ? (
                  <p>Nenhum produto encontrado. Altere a pesquisa.</p>
                ) : (
                  products.map((product) => (
                    <button
                      key={product.id}
                      disabled={busy}
                      aria-pressed={selectedProduct?.id === product.id}
                      className={`ml-product-choice ${selectedProduct?.id === product.id ? "selected" : ""}`}
                      onClick={() => setSelectedProduct(product)}
                    >
                      <ProductInfo
                        name={product.name}
                        sku={product.sku}
                        image={
                          product.images?.find((x) => x.isPrimary)?.url ||
                          product.images?.[0]?.url
                        }
                      />
                      <span aria-hidden="true">
                        {selectedProduct?.id === product.id ? "●" : "○"}
                      </span>
                      <small>
                        {product.category?.name || "Sem categoria"} · R${" "}
                        {product.salePrice} ·{" "}
                        {friendly[product.status] || product.status}
                      </small>
                    </button>
                  ))
                )}
              </div>
              <LinkPagination
                page={productPage}
                pages={productPages}
                total={productTotal}
                busy={productsLoading || busy}
                onPage={(p) => {
                  setProductPage(p);
                  setProductsLoading(true);
                }}
              />
              <div className="ml-drawer-footer">
                {canLink && (
                  <button
                    className="ml-button ml-primary"
                    disabled={!selectedProduct || busy || productsLoading}
                    onClick={() => setConfirming(true)}
                  >
                    Revisar e confirmar vínculo
                  </button>
                )}
                {canCreate && (
                  <Link
                    className="ml-button ml-outline"
                    to="/products/new"
                    state={{ marketplaceListingId: selected.listing.id }}
                  >
                    + Criar novo produto
                  </Link>
                )}
              </div>
            </>
          )}
        </LinkDrawer>
      )}
      <ConfirmModal
        open={bulkConfirm}
        title="Confirmar vínculos selecionados?"
        confirmLabel={`Vincular ${bulkItems.length} anúncios`}
        busy={busy}
        onCancel={() => setBulkConfirm(false)}
        onConfirm={() => void bulk()}
      >
        <p>
          Cada vínculo será validado individualmente. Nenhum estoque ou preço
          será alterado.
        </p>
        <ul>
          {bulkItems.map((x) => (
            <li key={x.listing.id}>
              {x.listing.externalItemId} → {x.suggestion?.sku} ·{" "}
              {x.suggestion?.name}
            </li>
          ))}
        </ul>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </ConfirmModal>
    </MarketplaceLinksLayout>
  );
}
