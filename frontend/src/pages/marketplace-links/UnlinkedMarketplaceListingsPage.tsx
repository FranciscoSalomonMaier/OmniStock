import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmModal } from '../../components/feedback/ConfirmModal';
import { useCompany } from '../../hooks/useCompany';
import { ApiError } from '../../services/api';
import { marketplaceLinkService } from '../../services/marketplace-link.service';
import type { Product } from '../../types/product';
import type { UnlinkedListingItem } from '../../types/marketplace-link';
import './marketplace-links.css';

export function UnlinkedMarketplaceListingsPage({ suggestionsOnly = false }: { suggestionsOnly?: boolean }) {
  const { connectionId } = useParams();
  const { activeCompany, activeMembership } = useCompany();
  const [items, setItems] = useState<UnlinkedListingItem[]>([]);
  const [selected, setSelected] = useState<UnlinkedListingItem | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const canLink = ['ADMIN', 'MANAGER', 'STOCKIST'].includes(activeMembership?.role ?? '');
  const canBulk = ['ADMIN', 'MANAGER'].includes(activeMembership?.role ?? '');

  const load = useCallback((signal?: AbortSignal) => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    if (connectionId) q.set('connectionId', connectionId);
    if (suggestionsOnly) q.set('withSuggestion', 'true');
    setLoading(true);
    return marketplaceLinkService.unlinkedListings(q, signal).then((result) => {
      setItems(result.data); setPages(result.meta.totalPages); setSelected((current) => result.data.find((x) => x.listing.id === current?.listing.id) ?? result.data[0] ?? null); setError('');
    }).catch((e) => {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Falha ao carregar anúncios.');
    }).finally(() => setLoading(false));
  }, [connectionId, page, search, suggestionsOnly]);

  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 300); return () => { clearTimeout(timer); controller.abort(); }; }, [activeCompany?.id, load]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const q = new URLSearchParams({ page: '1', limit: '20', status: 'ACTIVE', sortBy: 'sku', sortDirection: 'asc' });
      if (productSearch) q.set('search', productSearch);
      marketplaceLinkService.products(q, controller.signal).then((result) => {
        setProducts(result.data);
        const suggested = result.data.find((p) => p.id === selected.suggestion?.productId);
        setSelectedProduct((current) => result.data.find((p) => p.id === current?.id) ?? suggested ?? null);
      }).catch(() => undefined);
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [activeCompany?.id, productSearch, selected]);

  const bulkLinks = useMemo(() => items.filter((x) => checked[x.listing.id] && x.suggestion).map((x) => ({ productId: x.suggestion!.productId, marketplaceListingId: x.listing.id })), [checked, items]);
  async function link() {
    if (!selected || !selectedProduct) return;
    setBusy(true);
    try {
      if (selected.suggestion?.productId === selectedProduct.id) await marketplaceLinkService.acceptSuggestion(selected.listing.id, selectedProduct.id);
      else await marketplaceLinkService.create(selectedProduct.id, selected.listing.id);
      setConfirming(false); setSelectedProduct(null); await load();
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'MARKETPLACE_LISTING_ALREADY_LINKED' ? 'Este anúncio foi vinculado por outro usuário. A lista foi atualizada.' : e instanceof Error ? e.message : 'Falha ao vincular.');
      await load();
    } finally { setBusy(false); }
  }
  async function bulk() {
    if (!bulkLinks.length) return;
    setBusy(true);
    try { await marketplaceLinkService.bulk(bulkLinks); setChecked({}); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha no vínculo em lote.'); }
    finally { setBusy(false); }
  }

  return <main className="page">
    <div className="page-title"><div><span className="eyebrow">Integrações</span><h1>{suggestionsOnly ? 'Sugestões de vínculo' : 'Anúncios sem vínculo'}</h1></div><Link to="/marketplace-links">Ver vínculos</Link></div>
    <nav className="link-tabs"><Link to="/marketplace-links">Vínculos</Link><Link to="/marketplace-links/unlinked">Não vinculados</Link><Link to="/marketplace-links/suggestions">Sugestões</Link></nav>
    {error && <p className="form-error">{error}</p>}
    <div className="link-toolbar"><input placeholder="ID, SKU ou título do anúncio" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/>{canBulk && bulkLinks.length > 0 && <button disabled={busy} onClick={() => void bulk()}>Vincular selecionados ({bulkLinks.length})</button>}</div>
    <div className="link-grid"><section className="link-panel"><h2>Anúncios externos</h2>{loading ? <p>Carregando...</p> : !items.length ? <p className="empty-state">Nenhum anúncio sem vínculo encontrado.</p> : items.map((item) => <article key={item.listing.id} className={`listing-card ${selected?.listing.id === item.listing.id ? 'selected' : ''}`} onClick={() => { setSelected(item); setSelectedProduct(null); }}><div>{canBulk && item.suggestion && <input type="checkbox" aria-label={`Selecionar ${item.listing.externalItemId}`} checked={Boolean(checked[item.listing.id])} onClick={(e) => e.stopPropagation()} onChange={(e) => setChecked((current) => ({ ...current, [item.listing.id]: e.target.checked }))}/>} {item.listing.thumbnailUrl ? <img src={item.listing.thumbnailUrl} alt=""/> : <span>Sem imagem</span>}</div><div><h3>{item.listing.title}</h3><p>{item.listing.externalItemId}{item.listing.externalVariationId ? ` · variação ${item.listing.externalVariationId}` : ''}</p><div className="link-meta"><span>SKU {item.listing.externalSku ?? '—'}</span><span>{item.listing.currency} {item.listing.price}</span><span>{item.listing.status}</span></div>{item.suggestion && <span className="confidence">SKU exato · 100%</span>}</div></article>)}</section>
      <section className="link-panel"><h2>Produto interno</h2>{!selected ? <p>Selecione um anúncio.</p> : <><div className="link-meta"><span>{selected.listing.channel?.name}</span><span>{selected.listing.connection?.name}</span><span>Estoque externo: {selected.listing.availableQuantity ?? '—'}</span></div>{selected.suggestion && <div className="suggestion-box"><strong>Sugestão por SKU exato</strong><p>{selected.suggestion.sku} · {selected.suggestion.name}</p><span className="confidence">Confiança 100%</span></div>}<input placeholder="Pesquisar SKU, nome, código ou categoria" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}/><div>{products.map((product) => <button type="button" key={product.id} className={`product-choice ${selectedProduct?.id === product.id ? 'selected' : ''}`} onClick={() => setSelectedProduct(product)}><strong>{product.sku}</strong> · {product.name}<br/><small>{product.category?.name ?? 'Sem categoria'} · R$ {product.salePrice} · {product.status}</small></button>)}</div>{canLink && selectedProduct && <div className="link-actions"><button onClick={() => setConfirming(true)}>{selected.suggestion?.productId === selectedProduct.id ? 'Aceitar sugestão' : 'Vincular produto selecionado'}</button><button className="secondary" onClick={() => setSelectedProduct(null)}>Escolher outro</button></div>}</>}</section></div>
    <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} / {pages || 1}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div>
    <ConfirmModal open={confirming} title="Confirmar vinculação?" confirmLabel="Vincular" busy={busy} onCancel={() => setConfirming(false)} onConfirm={() => void link()}><p>O anúncio <strong>{selected?.listing.externalItemId}</strong> será vinculado ao produto <strong>{selectedProduct?.sku}</strong>.</p><p>Nenhum estoque ou preço será alterado nesta operação.</p></ConfirmModal>
  </main>;
}
