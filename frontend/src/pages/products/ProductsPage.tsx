import { ConfirmModal } from "../../components/feedback/ConfirmModal";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { productService } from "../../services/product.service";
import { ApiError } from "../../services/api";
import type { Category, Product, ProductGroup } from "../../types/product";
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
  const [removalError, setRemovalError] = useState<{
    message: string;
    reasons: string[];
  } | null>(null);
  async function requestRemoval(product: Product) {
    setChecking(product.id);
    try {
      const check = await productService.removalCheck(product.id);
      if (!check.allowed) {
        const reasons = [
          ...(check.reasons ?? []),
          ...check.kits.map((kit) => `Kit vinculado: ${kit.sku} — ${kit.name}`),
        ];
        setRemovalError({
          message: reasons.length
            ? "Este produto não pode ser removido pelos seguintes motivos:"
            : (check.message ?? "Não foi possível remover o produto."),
          reasons,
        });
        return;
      }
      setRemoveTarget(product);
    } catch (e) {
      setRemovalError({
        message:
          e instanceof Error
            ? e.message
            : "Não foi possível verificar os vínculos do produto.",
        reasons: [],
      });
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
      setRevision((r) => r + 1);
    } catch (e) {
      setRemoveTarget(null);
      const reasons = e instanceof ApiError ? (e.reasons ?? []) : [];
      setRemovalError({
        message: reasons.length
          ? "Este produto não pode ser removido pelos seguintes motivos:"
          : e instanceof Error
            ? e.message
            : "Não foi possível remover o produto.",
        reasons,
      });
    } finally {
      setRemoving(false);
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
        <span className="role">{product.status}</span>
        {canWrite && (
          <>
            <Link to={`/products/${product.id}/edit`}>Editar</Link>
            <button
              className="product-remove-button"
              type="button"
              disabled={checking !== null || removing}
              onClick={() => void requestRemoval(product)}
              aria-label={`Remover ${product.name}`}
            >
              {checking === product.id ? "Verificando..." : "Remover"}
            </button>
          </>
        )}
      </div>
    </article>
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
      {view === "grouped" && <p className="muted products-group-hint">A busca e os filtros encontram grupos; a unidade e seus kits aparecem juntos.</p>}
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
          open={removalError !== null}
          title="Não foi possível remover"
          message={removalError?.message ?? ""}
          reasons={removalError?.reasons}
          onClose={() => setRemovalError(null)}
        />
      </div>
    </main>
  );
}
