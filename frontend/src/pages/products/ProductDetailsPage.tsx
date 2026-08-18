import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCompany } from '../../hooks/useCompany'
import { productService } from '../../services/product.service'
import type { Product, ProductImage } from '../../types/product'

export function ProductDetailsPage() {
  const { id } = useParams()
  const { activeMembership } = useCompany()
  const [product, setProduct] = useState<Product | null>(null)
  const [images, setImages] = useState<(ProductImage & { blobUrl?: string })[]>([])

  useEffect(() => {
    if (!id) return
    const urls: string[] = []
    void Promise.all([productService.get(id), productService.images(id)]).then(async ([item, list]) => {
      const loaded = await Promise.all(list.map(async (image) => {
        const blobUrl = URL.createObjectURL(await productService.image(id, image.id))
        urls.push(blobUrl)
        return { ...image, blobUrl }
      }))
      setProduct(item)
      setImages(loaded)
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
  </main>
}
