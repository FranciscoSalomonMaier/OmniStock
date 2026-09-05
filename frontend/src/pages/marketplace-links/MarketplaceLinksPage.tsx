import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmModal } from '../../components/feedback/ConfirmModal';
import { useCompany } from '../../hooks/useCompany';
import { ApiError } from '../../services/api';
import { marketplaceLinkService } from '../../services/marketplace-link.service';
import type { ProductMarketplaceLink } from '../../types/marketplace-link';
import './marketplace-links.css';

export function MarketplaceLinksPage() {
  const { activeCompany, activeMembership } = useCompany();
  const [items, setItems] = useState<ProductMarketplaceLink[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unlinking, setUnlinking] = useState<ProductMarketplaceLink | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = ['ADMIN', 'MANAGER'].includes(activeMembership?.role ?? '');
  const canValidate = ['ADMIN', 'MANAGER', 'STOCKIST'].includes(activeMembership?.role ?? '');

  const load = useCallback((signal?: AbortSignal) => {
    const q = new URLSearchParams({ page: String(page), limit: '20', sortBy: 'linkedAt', sortDirection: 'desc' });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    setLoading(true);
    return marketplaceLinkService.list(q, signal).then((result) => {
      setItems(result.data); setPages(result.meta.totalPages); setError('');
    }).catch((e) => {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : 'Falha ao carregar vínculos.');
    }).finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [activeCompany?.id, load]);

  async function confirmUnlink() {
    if (!unlinking) return;
    setBusy(true);
    try { await marketplaceLinkService.unlink(unlinking.id, reason); setUnlinking(null); setReason(''); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao desvincular.'); }
    finally { setBusy(false); }
  }

  async function validate(item: ProductMarketplaceLink) {
    try { await marketplaceLinkService.validate(item.id); await load(); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Falha ao validar vínculo.'); }
  }

  return <main className="page">
    <div className="page-title"><div><span className="eyebrow">Integrações</span><h1>Vinculação de anúncios</h1></div><Link className="primary-link" to="/marketplace-links/unlinked">Vincular anúncio</Link></div>
    <nav className="link-tabs"><Link to="/marketplace-links">Vínculos</Link><Link to="/marketplace-links/unlinked">Não vinculados</Link><Link to="/marketplace-links/suggestions">Sugestões</Link></nav>
    <div className="link-toolbar"><input placeholder="SKU, produto, anúncio ou ID externo" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}/><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Todo o histórico</option><option value="ACTIVE">Ativos</option><option value="INACTIVE">Desvinculados</option><option value="INVALID">Inválidos</option><option value="PENDING_VALIDATION">Aguardando validação</option></select></div>
    {error && <p className="form-error">{error}</p>}
    {loading ? <p>Carregando...</p> : !items.length ? <p className="empty-state">Nenhum vínculo encontrado.</p> : <div className="table-wrap"><table className="link-table"><thead><tr><th>Produto</th><th>Canal / conta</th><th>Anúncio / variação</th><th>Origem</th><th>Validação</th><th>Ações</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><strong>{item.product.sku}</strong><br/>{item.product.name}</td><td>{item.channel.name}<br/><span className="muted">{item.connection.name}</span></td><td>{item.listing.externalItemId}{item.listing.externalVariationId ? ` / ${item.listing.externalVariationId}` : ''}<br/><span className="muted">{item.listing.externalSku ?? 'Sem SKU'} · {item.listing.title}</span></td><td>{item.linkSource}<br/><span className={`status-pill ${item.status}`}>{item.status}</span></td><td>{item.lastValidation.status ? <><span className={`status-pill ${item.lastValidation.status}`}>{item.lastValidation.status}</span><br/><small>{item.lastValidation.message}</small></> : 'Não validado'}</td><td><div className="link-actions">{canValidate && item.status === 'ACTIVE' && <button onClick={() => void validate(item)}>Validar</button>}{canManage && item.status === 'ACTIVE' && <button className="secondary" onClick={() => setUnlinking(item)}>Desvincular</button>}</div></td></tr>)}</tbody></table></div>}
    <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</button><span>{page} / {pages || 1}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Próxima</button></div>
    <ConfirmModal open={Boolean(unlinking)} title="Desvincular anúncio?" confirmLabel="Desvincular" busy={busy} onCancel={() => { setUnlinking(null); setReason(''); }} onConfirm={() => void confirmUnlink()}><p>O anúncio deixará de receber sincronizações do produto <strong>{unlinking?.product.sku}</strong>. O histórico será preservado.</p><textarea className="unlink-reason" maxLength={500} placeholder="Motivo (opcional)" value={reason} onChange={(e) => setReason(e.target.value)}/></ConfirmModal>
  </main>;
}
