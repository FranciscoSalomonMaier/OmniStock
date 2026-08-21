import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TablePagination } from "../../components/data/TablePagination";
import { useCompany } from "../../hooks/useCompany";
import {
  inventoryService,
  type InventorySummary,
} from "../../services/inventory.service";
import { productService } from "../../services/product.service";
import type { InventoryBalance } from "../../types/inventory";
import type { Category } from "../../types/product";
import './inventory.css';
const initialSummary: InventorySummary = {
  totalProducts: "0",
  belowMinimum: "0",
  withReservation: "0",
  withoutStock: "0",
};
function situation(x: InventoryBalance) {
  if (x.product.status !== "ACTIVE") return ["Produto inativo", "inactive"];
  if (Number(x.availableQuantity) === 0) return ["Sem estoque", "out"];
  if (x.isBelowMinimumStock) return ["Estoque baixo", "low"];
  if (Number(x.reservedQuantity) > 0) return ["Com reserva", "reserved"];
  return ["Normal", "normal"];
}
export function InventoryPage() {
  const { activeCompany, activeMembership } = useCompany();
  const canWrite = ["ADMIN", "MANAGER", "STOCKIST"].includes(
    activeMembership?.role ?? "",
  );
  const [data, setData] = useState<InventoryBalance[]>([]);
  const [summary, setSummary] = useState(initialSummary);
  const [categories, setCategories] = useState<Category[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    categoryId: "",
    status: "",
    stockSituation: "",
    sortBy: "updatedAt",
    sortDirection: "desc",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [loadedCompanyId,setLoadedCompanyId]=useState<string|null>(null);
  useEffect(() => {
    let active = true;
    void productService.categories().then((x) => {
      if (active) setCategories(x);
    });
    return () => {
      active = false;
    };
  }, [activeCompany?.id]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      const q = new URLSearchParams({
        page: String(meta.page),
        limit: String(meta.limit),
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
      });
      for (const [k, v] of Object.entries(filters))
        if (v && !["sortBy", "sortDirection"].includes(k)) q.set(k, v);
      setLoading(true);
      Promise.all([inventoryService.list(q), inventoryService.summary()])
        .then(([page, s]) => {
          if (active) {
            setData(page.data);setLoadedCompanyId(activeCompany?.id??null);
            setMeta(page.meta);
            setSummary(s);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Não foi possível carregar o estoque.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeCompany?.id, filters, meta.limit, meta.page, reload]);
  function update(key: string, value: string) {
    setFilters((x) => ({ ...x, [key]: value }));
    setMeta((x) => ({ ...x, page: 1 }));
  }
  const visibleData=loadedCompanyId===activeCompany?.id?data:[];const visibleSummary=loadedCompanyId===activeCompany?.id?summary:initialSummary;const visibleLoading=loading||loadedCompanyId!==activeCompany?.id;
  return (
    <main className="page inventory-page">
      <header className="inventory-page-header">
        <div>
          <h1>Estoque</h1>
          <p>
            Acompanhe saldos, reservas, disponibilidade e movimentações da
            empresa selecionada.
          </p>
        </div>
        <div className="header-actions">
          {canWrite && (
            <>
              <Link className="primary-link" to="/inventory/entries/new">
                Nova entrada
              </Link>
              <Link to="/inventory/exits/new">Nova saída</Link>
              <Link to="/inventory/adjustments/new">Ajustar estoque</Link>
            </>
          )}
          <Link to="/inventory/movements">Ver movimentações</Link>
        </div>
      </header>
      <section className="summary-grid" aria-label="Resumo do estoque">
        {[
          {
            icon: "▦",
            label: "Produtos em estoque",
            value: visibleSummary.totalProducts,
            help: "Produtos cadastrados",
          },
          {
            icon: "!",
            label: "Abaixo do mínimo",
            value: visibleSummary.belowMinimum,
            help: "Exigem atenção",
          },
          {
            icon: "○",
            label: "Sem estoque disponível",
            value: visibleSummary.withoutStock,
            help: "Disponível igual a zero",
          },
          {
            icon: "◇",
            label: "Com quantidade reservada",
            value: visibleSummary.withReservation,
            help: "Possuem reservas",
          },
        ].map((card) => (
          <article className="summary-card" key={card.label}>
            <span className="summary-icon">{card.icon}</span>
            <div>
              <span>{card.label}</span>
              <strong>{visibleLoading ? "—" : card.value}</strong>
              <small>{card.help}</small>
            </div>
          </article>
        ))}
      </section>
      <section className="filter-panel" aria-label="Filtros de estoque">
        <label>
          Pesquisar
          <input
            placeholder="SKU, nome ou código de barras"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <label>
          Categoria
          <select
            value={filters.categoryId}
            onChange={(e) => update("categoryId", e.target.value)}
          >
            <option value="">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={filters.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="">Todos</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
            <option value="DISCONTINUED">Descontinuado</option>
          </select>
        </label>
        <label>
          Situação
          <select
            value={filters.stockSituation}
            onChange={(e) => update("stockSituation", e.target.value)}
          >
            <option value="">Todas</option>
            <option value="NORMAL">Normal</option>
            <option value="LOW">Estoque baixo</option>
            <option value="OUT">Sem estoque</option>
            <option value="RESERVED">Com reserva</option>
          </select>
        </label>
        <label>
          Ordenar
          <select
            value={filters.sortBy}
            onChange={(e) => update("sortBy", e.target.value)}
          >
            <option value="updatedAt">Atualização</option>
            <option value="sku">SKU</option>
            <option value="name">Produto</option>
            <option value="availableQuantity">Disponível</option>
            <option value="minimumStock">Estoque mínimo</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            setFilters({
              search: "",
              categoryId: "",
              status: "",
              stockSituation: "",
              sortBy: "updatedAt",
              sortDirection: "desc",
            });
            setMeta((x) => ({ ...x, page: 1 }));
          }}
        >
          Limpar filtros
        </button>
      </section>
      {error ? (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => setReload((x) => x + 1)}>
            Tentar novamente
          </button>
        </div>
      ) : visibleLoading ? (
        <div className="loading-table">Carregando saldos...</div>
      ) : visibleSummary.totalProducts === "0" ? (
        <div className="empty-state">
          <p>Nenhum produto cadastrado nesta empresa.</p>
          {canWrite && <Link to="/products/new">Cadastrar produto</Link>}
        </div>
      ) : !visibleData.length ? (
        <div className="empty-state">
          Nenhum produto corresponde aos filtros selecionados.
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col">Produto</th>
                <th scope="col">Categoria</th>
                <th scope="col">Unidade</th>
                <th scope="col" className="numeric">
                  Saldo atual
                </th>
                <th scope="col" className="numeric">
                  Reservado
                </th>
                <th scope="col" className="numeric">
                  Disponível
                </th>
                <th scope="col" className="numeric">
                  Estoque mínimo
                </th>
                <th scope="col">Situação</th>
                <th scope="col">Atualização</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((x) => {
                const [label, tone] = situation(x);
                return (
                  <tr key={x.product.id}>
                    <td>
                      <strong className="sku">{x.product.sku}</strong>
                    </td>
                    <td>{x.product.name}</td>
                    <td>{x.product.category?.name ?? "Sem categoria"}</td>
                    <td>{x.product.unitOfMeasure}</td>
                    <td className="numeric">{x.currentQuantity}</td>
                    <td className="numeric">{x.reservedQuantity}</td>
                    <td className="numeric">
                      <strong>{x.availableQuantity}</strong>
                    </td>
                    <td className="numeric">{x.product.minimumStock}</td>
                    <td>
                      <span className={`status-badge status-${tone}`}>
                        {label}
                      </span>
                    </td>
                    <td>{new Date(x.updatedAt).toLocaleString("pt-BR")}</td>
                    <td>
                      <details className="row-actions">
                        <summary>Ações</summary>
                        <Link to={`/inventory/products/${x.product.id}`}>
                          Visualizar saldo
                        </Link>
                        {canWrite && (
                          <>
                            <Link
                              to={`/inventory/entries/new?productId=${x.product.id}`}
                            >
                              Registrar entrada
                            </Link>
                            <Link
                              to={`/inventory/exits/new?productId=${x.product.id}`}
                            >
                              Registrar saída
                            </Link>
                            <Link
                              to={`/inventory/adjustments/new?productId=${x.product.id}`}
                            >
                              Ajustar
                            </Link>
                            <Link
                              to={`/inventory/reservations/new?productId=${x.product.id}`}
                            >
                              Criar reserva
                            </Link>
                          </>
                        )}
                        <Link
                          to={`/inventory/movements?productId=${x.product.id}`}
                        >
                          Ver histórico
                        </Link>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <TablePagination
        page={meta.page}
        totalPages={meta.totalPages}
        limit={meta.limit}
        onPage={(page) => setMeta((x) => ({ ...x, page }))}
        onLimit={(limit) => setMeta((x) => ({ ...x, page: 1, limit }))}
      />
    </main>
  );
}
