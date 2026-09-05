import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCompany } from '../../hooks/useCompany'
import { productService } from '../../services/product.service'
import { marketplaceLinkService } from '../../services/marketplace-link.service'
import type { Product, ProductImage } from '../../types/product'
import type { ProductMarketplaceLink } from '../../types/marketplace-link'
import '../marketplace-links/marketplace-links.css'

export function ProductDetailsPage() {
  const { id } = useParams()
  const { activeMembership } = useCompany()
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<(ProductImage & { blobUrl?: string })[]>([])
  const [marketplaceLinks, setMarketplaceLinks] = useState<ProductMarketplaceLink[]>([])

  useEffect(() => {
    if (!id) return
    const urls: string[] = []
    void Promise.all([productService.get(id), productService.images(id), marketplaceLinkService.productLinks(id)]).then(async ([item, list, links]) => {
      const loaded = await Promise.all(list.map(async (image) => {
        const blobUrl = URL.createObjectURL(await productService.image(id, image.id))
        urls.push(blobUrl)
        return { ...image, blobUrl }
      }))
      setProduct(item)
      setImages(loaded)
      setMarketplaceLinks(links)
    })
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [id])

  if (!product) return <main className="page">Carregando...</main>
  const canEdit = ['ADMIN', 'MANAGER', 'STOCKIST'].includes(activeMembership?.role ?? '')
  return <main className="page">
    <div className="page-title"><div><span className="eyebrow">{product.sku}</span><h1>{product.name}</h1></div>{canEdit && <Link to={`/products/${product.id}/edit`}>Editar</Link>}</div>
    <div className="gallery">{images.map((image) => <img key={image.id} src={image.blobUrl} alt={image.originalName} />)}</div>
    <dl className="details">
      <div><dt>Status</dt><dd>{product.status}</dd></div><div><dt>Categoria</dt><dd>{product.category?.name ?? 'Sem categoria'}</dd></div>
      <div><dt>Preço de venda</dt><dd>R$ {product.salePrice}</dd></div>{product.costPrice !== undefined && <div><dt>Preço de custo</dt><dd>{product.costPrice ?? '—'}</dd></div>}
      <div><dt>Unidade</dt><dd>{product.unitOfMeasure}</dd></div><div><dt>Código de barras</dt><dd>{product.barcode ?? '—'}</dd></div>
      <div><dt>NCM / CEST / CFOP</dt><dd>{product.ncm ?? '—'} / {product.cest ?? '—'} / {product.defaultCfop ?? '—'}</dd></div>
      <div><dt>Peso e dimensões</dt><dd>{product.weight ?? '—'} kg · {product.height ?? '—'} × {product.width ?? '—'} × {product.length ?? '—'} cm</dd></div>
      <div><dt>Estoque mínimo</dt><dd>{product.minimumStock}</dd></div><div><dt>Criado</dt><dd>{new Date(product.createdAt).toLocaleString('pt-BR')}</dd></div>
    </dl><p>{product.description}</p>
    <section className="link-panel"><div className="page-title"><h2>Anúncios vinculados</h2><Link to={`/products/${product.id}/marketplace-links`}>Gerenciar</Link></div>{!marketplaceLinks.length?<p>Nenhum anúncio vinculado.</p>:<div className="table-wrap"><table className="link-table"><thead><tr><th>Canal</th><th>Conta</th><th>ID externo</th><th>SKU externo</th><th>Preço</th><th>Status</th></tr></thead><tbody>{marketplaceLinks.slice(0,5).map(link=><tr key={link.id}><td>{link.channel.name}</td><td>{link.connection.name}</td><td>{link.listing.externalItemId}{link.listing.externalVariationId?` / ${link.listing.externalVariationId}`:''}</td><td>{link.listing.externalSku??'—'}</td><td>{link.listing.currency} {link.listing.price}</td><td><span className={`status-pill ${link.status}`}>{link.status}</span></td></tr>)}</tbody></table></div>}</section>
  </main>
}
