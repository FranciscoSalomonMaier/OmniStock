import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { productService } from "../../services/product.service";
import type { Category, Product, ProductGroup, ProductStatus } from "../../types/product";

const statusLabels: Record<ProductStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  DISCONTINUED: "Descontinuado",
};
export function ProductsPage() {
  const { activeCompany } = useCompany();
  return <ProductsList key={activeCompany?.id ?? "none"} />;
}
function ProductsList() {
  const { activeCompany, activeMembership } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [view, setView] = useState<"grouped" | "list">("grouped");
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [statusTarget, setStatusTarget] = useState<Product | null>(null);
  const [changingStatus, setChangingStatus] = useState(false);
  const [statusError, setStatusError] = useState("");
  async function confirmStatusChange() {
    if (!statusTarget || changingStatus) return;
    const nextStatus = statusTarget.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setChangingStatus(true);
    try {
      await productService.status(statusTarget.id, nextStatus);
      setStatusTarget(null);
      setRevision((r) => r + 1);
    } catch (e) {
      setStatusTarget(null);
      setStatusError(e instanceof Error ? e.message : "Não foi possível alterar o status do produto.");
    } finally {
      setChangingStatus(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const q = new URLSearchParams({
        page: String(page),
        limit: "20",
        sortBy: "createdAt",
        sortDirection: "desc",
      });
      if (search) q.set("search", search);
      if (status) q.set("status", status);
      if (unit) q.set("unitOfMeasure", unit);
      setLoading(true);
      Promise.all([
        view === "grouped"
          ? productService.listGrouped(q)
          : productService.list(q),
        productService.categories(),
      ])
        .then(([result, cats]) => {
          if (cancelled) return;
          if (view === "grouped") setGroups(result.data as ProductGroup[]);
          else setProducts(result.data as Product[]);
          setPages(result.meta.totalPages);
          setCategories(cats);
          setError("");
          if (page > 1 && page > result.meta.totalPages)
            setPage(Math.max(1, result.meta.totalPages));
        })
        .catch((e) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Falha");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeCompany?.id, page, search, status, unit, revision, view]);
  const canWrite = ["ADMIN", "MANAGER", "STOCKIST"].includes(
    activeMembership?.role ?? "",
  );
  const canChangeStatus = ["ADMIN", "MANAGER"].includes(activeMembership?.role ?? "");
  const productRow = (product: Product) => (
    <article key={product.id}>
      <div>
        <strong>{product.sku}</strong>
        <h3>
          <Link
            className="product-name-link"
            to={`/products/${product.id}`}
            title={product.name}
          >
            {product.name}
          </Link>
        </h3>
        <span>
          {product.category?.name ?? "Sem categoria"} · {product.unitOfMeasure}
        </span>
      </div>
      <div>
        <span className="role">{statusLabels[product.status]}</span>
        {canWrite && (
          <>
            <Link to={product.isBundle ? `/kits/${product.id}/edit` : `/products/${product.id}/edit`}>Editar</Link>
            {canChangeStatus && product.status !== "DISCONTINUED" && (
              <button
                className={`product-status-button${product.status === "ACTIVE" ? " deactivate" : ""}`}
                type="button"
                disabled={changingStatus}
                onClick={() => setStatusTarget(product)}
                aria-label={`${product.status === "ACTIVE" ? "Desativar" : "Ativar"} ${product.name}`}
              >
                {product.status === "ACTIVE" ? "Desativar" : "Ativar"}
              </button>
            )}
          </>
        )}
      </div>
    </article>
  );
  return (
    <main className="page">
      <div className="page-title">
        <h1>Produtos</h1>
        {canWrite && <div className="product-create-actions">
          <Link className="primary-link" to="/products/new">Novo produto</Link>
          <Link className="primary-link" to="/kits/new">Novo kit</Link>
        </div>}
      </div>
      <div className="products-view-switch" role="group" aria-label="Visualização dos produtos">
        <button
          type="button"
          className={view === "grouped" ? "active" : ""}
          aria-pressed={view === "grouped"}
          onClick={() => { setView("grouped"); setPage(1); }}
        >
          Agrupados
        </button>
        <button
          type="button"
          className={view === "list" ? "active" : ""}
          aria-pressed={view === "list"}
          onClick={() => { setView("list"); setPage(1); }}
        >
          Lista
        </button>
      </div>
      <div className="filters">
        <input
          aria-label="Pesquisar"
          placeholder="SKU, nome ou código"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos os status</option>
          {(["ACTIVE", "INACTIVE", "DISCONTINUED"] as ProductStatus[]).map((s) => (
            <option key={s} value={s}>{statusLabels[s]}</option>
          ))}
        </select>
        <select
          aria-label="Unidade"
          value={unit}
          onChange={(e) => { setUnit(e.target.value); setPage(1); }}
        >
          <option value="">Todas unidades</option>
          {[
            "UN",
            "KIT",
            "KG",
            "G",
            "L",
            "ML",
            "M",
            "CM",
            "M2",
            "M3",
            "CX",
            "PCT",
            "PAR",
          ].map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button
          className="secondary products-clear-button"
          type="button"
          onClick={() => {
            setSearch("");
            setStatus("ACTIVE");
            setUnit("");
            setPage(1);
          }}
        >
          Limpar
        </button>
      </div>
      {view === "grouped" && <p className="muted products-group-hint">A busca encontra grupos de produtos e kits. O filtro de status mostra apenas os produtos com o status selecionado.</p>}
      {loading ? (
        <p>Carregando...</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !(view === "grouped" ? groups.length : products.length) ? (
        <p>Nenhum produto encontrado.</p>
      ) : view === "grouped" ? (
        <div className="product-groups">
          {groups.map((group) => (
            <section className="product-group" key={group.id}>
              {(group.products.length > 1 || group.mixedKit) && (
                <div className="product-group-heading">
                  <strong>{group.mixedKit ? "Kit com vários componentes" : "Produto e kits"}</strong>
                  {group.products.length > 1 && <span>{group.products.length} produtos</span>}
                </div>
              )}
              <div className="product-table">
                {group.products.map(productRow)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="product-table">
          {products.map(productRow)}
        </div>
      )}
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Anterior
        </button>
        <span>
          {page} / {pages || 1}
        </span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
          Próxima
        </button>
      </div>
      <p className="muted">{categories.length} categorias disponíveis.</p>
      <ConfirmModal
        open={statusTarget !== null}
        title={statusTarget?.status === "ACTIVE" ? "Desativar produto" : "Ativar produto"}
        confirmLabel={statusTarget?.status === "ACTIVE" ? "Desativar" : "Ativar"}
        busy={changingStatus}
        onCancel={() => { if (!changingStatus) setStatusTarget(null); }}
        onConfirm={() => void confirmStatusChange()}
      >
        <p>
          {statusTarget?.status === "ACTIVE" ? "Deseja realmente desativar" : "Deseja realmente ativar"}{" "}
          <strong>{statusTarget?.sku} — {statusTarget?.name}</strong>?
        </p>
        {statusTarget?.status === "ACTIVE" && <p>O cadastro e o histórico serão preservados. Kits que usam este produto podem ficar indisponíveis. Anúncios nos marketplaces não serão pausados automaticamente.</p>}
      </ConfirmModal>
      <ErrorDialog
        open={Boolean(statusError)}
        title="Não foi possível alterar o status"
        message={statusError}
        onClose={() => setStatusError("")}
      />
    </main>
  );
}
