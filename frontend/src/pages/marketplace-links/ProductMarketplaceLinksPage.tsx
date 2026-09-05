import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useCompany } from '../../hooks/useCompany';
import { marketplaceLinkService } from '../../services/marketplace-link.service';
import { productService } from '../../services/product.service';
import type { ProductMarketplaceLink } from '../../types/marketplace-link';
import type { Product } from '../../types/product';
import './marketplace-links.css';

export function ProductMarketplaceLinksPage() {
  const { id = '' } = useParams();
  const { activeCompany } = useCompany();
  const [product, setProduct] = useState<Product | null>(null);
  const [links, setLinks] = useState<ProductMarketplaceLink[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([productService.get(id), marketplaceLinkService.productLinks(id, controller.signal)]).then(([p, l]) => { setProduct(p); setLinks(l); setError(''); }).catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar vínculos.'));
    return () => controller.abort();
  }, [activeCompany?.id, id]);
  return <main className="page"><Link to={`/products/${id}`}>← Produto</Link><div className="page-title"><div><span className="eyebrow">{product?.sku}</span><h1>Anúncios vinculados</h1></div><Link className="primary-link" to="/marketplace-links/unlinked">Vincular anúncio</Link></div>{error && <p className="form-error">{error}</p>}{!links.length ? <p className="empty-state">Este produto ainda não possui anúncios vinculados.</p> : <div className="table-wrap"><table className="link-table"><thead><tr><th>Canal</th><th>Conta</th><th>ID / variação</th><th>SKU externo</th><th>Preço</th><th>Anúncio</th><th>Vínculo</th></tr></thead><tbody>{links.map((link) => <tr key={link.id}><td>{link.channel.name}</td><td>{link.connection.name}</td><td>{link.listing.externalItemId}<br/>{link.listing.externalVariationId ?? 'Sem variação'}</td><td>{link.listing.externalSku ?? '—'}</td><td>{link.listing.currency} {link.listing.price}</td><td>{link.listing.status}<br/><small>{new Date(link.listing.lastSyncedAt).toLocaleString('pt-BR')}</small></td><td><span className={`status-pill ${link.status}`}>{link.status}</span></td></tr>)}</tbody></table></div>}</main>;
}
