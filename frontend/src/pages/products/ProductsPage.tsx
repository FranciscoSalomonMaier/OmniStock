import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { productService } from "../../services/product.service";
import type { Category, Product } from "../../types/product";
export function ProductsPage() {
  const { activeCompany } = useCompany();
  return <ProductsList key={activeCompany?.id ?? "none"} />;
}
function ProductsList() {
  const { activeCompany, activeMembership } = useCompany();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [unit, setUnit] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [checking, setChecking] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<Product | null>(null);
  const [removalError, setRemovalError] = useState("");
  async function requestRemoval(product: Product) {
    setChecking(product.id);
    try {
      const check = await productService.removalCheck(product.id);
      if (!check.allowed) {
        setRemovalError(
          [check.message, ...check.kits.map((k) => `${k.sku} — ${k.name}`)]
            .filter(Boolean)
            .join("\n"),
        );
        return;
      }
      setRemoveTarget(product);
    } catch (e) {
      setRemovalError(
        e instanceof Error
          ? e.message
          : "Não foi possível verificar os vínculos do produto.",
      );
    } finally {
      setChecking(null);
    }
  }
  async function confirmRemoval() {
    if (!removeTarget || removing) return;
    setRemoving(true);
    try {
      await productService.remove(removeTarget.id);
      setRemoveTarget(null);
      if (products.length === 1 && page > 1) setPage(page - 1);
      else setRevision((r) => r + 1);
    } catch (e) {
      setRemoveTarget(null);
      setRemovalError(
        e instanceof Error ? e.message : "Não foi possível remover o produto.",
      );
    } finally {
      setRemoving(false);
    }
  }
  useEffect(() => {
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
      Promise.all([productService.list(q), productService.categories()])
        .then(([result, cats]) => {
          setProducts(result.data);
          setPages(result.meta.totalPages);
          setCategories(cats);
          setError("");
        })
        .catch((e) => setError(e instanceof Error ? e.message : "Falha"))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [activeCompany?.id, page, search, status, unit, revision]);
  const canWrite = ["ADMIN", "MANAGER", "STOCKIST"].includes(
    activeMembership?.role ?? "",
  );
  return (
    <main className="page">
      <div className="page-title">
        <h1>Produtos</h1>
        {canWrite && (
          <Link className="primary-link" to="/products/new">
            Novo produto
          </Link>
        )}
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
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          {["ACTIVE", "INACTIVE", "DISCONTINUED"].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Unidade"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
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
            setStatus("");
            setUnit("");
          }}
        >
          Limpar
        </button>
      </div>
      {loading ? (
        <p>Carregando...</p>
      ) : error ? (
        <p className="form-error">{error}</p>
      ) : !products.length ? (
        <p>Nenhum produto encontrado.</p>
      ) : (
        <div className="product-table">
          {products.map((p) => (
            <article key={p.id}>
              <div>
                <strong>{p.sku}</strong>
                <h3>
                  <Link className="product-name-link" to={`/products/${p.id}`}>
                    {p.name}
                  </Link>
                </h3>
                <span>
                  {p.category?.name ?? "Sem categoria"} · {p.unitOfMeasure}
                </span>
              </div>
              <div>
                <span className="role">{p.status}</span>
                {canWrite && (
                  <>
                    <Link to={`/products/${p.id}/edit`}>Editar</Link>
                    <button
                      className="product-remove-button"
                      type="button"
                      disabled={checking !== null || removing}
                      onClick={() => void requestRemoval(p)}
                      aria-label={`Remover ${p.name}`}
                    >
                      {checking === p.id ? "Verificando..." : "Remover"}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
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
      <div className="product-removal-dialog">
        <ConfirmModal
          open={removeTarget !== null}
          title="Remover produto"
          confirmLabel="Remover"
          busy={removing}
          onCancel={() => {
            if (!removing) setRemoveTarget(null);
          }}
          onConfirm={() => void confirmRemoval()}
        >
          <p>
            Deseja realmente remover{" "}
            <strong>
              {removeTarget?.sku} — {removeTarget?.name}
            </strong>
            ?
          </p>
          <p>Esta ação não pode ser desfeita.</p>
        </ConfirmModal>
      </div>
      <div className="product-removal-error">
        <ErrorDialog
          open={!!removalError}
          title="Não foi possível remover"
          message={removalError}
          onClose={() => setRemovalError("")}
        />
      </div>
    </main>
  );
}
