import { useEffect, useState } from "react";
import { TablePagination } from "../../components/data/TablePagination";
import { MovementTypeBadge } from "../../components/inventory/MovementTypeBadge";
import { movementLabels } from "../../components/inventory/movement-types";
import { useCompany } from "../../hooks/useCompany";
import { inventoryService } from "../../services/inventory.service";
import { productService } from "../../services/product.service";
import type { Movement } from "../../types/inventory";
import type { Product } from "../../types/product";
import './inventory.css';
const format = (value: string, unit?: string) =>
  `${Number(value).toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ""}`;
export function MovementsPage() {
  const { activeCompany } = useCompany();
  const [data, setData] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    type: "",
    productId: new URLSearchParams(window.location.search).get('productId')??"",
    dateFrom: "",
    dateTo: "",
    sortDirection: "desc",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<Movement | null>(null);
  const [reload, setReload] = useState(0);
  const [loadedCompanyId,setLoadedCompanyId]=useState<string|null>(null);
  useEffect(() => {
    let active = true;
    void productService
      .list(new URLSearchParams({ limit: "100" }))
      .then((x) => {
        if (active) setProducts(x.data);
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
        sortDirection: filters.sortDirection,
      });
      for (const [k, v] of Object.entries(filters))
        if (v && k !== "sortDirection") q.set(k, v);
      setLoading(true);
      inventoryService
        .movements(q)
        .then((x) => {
          if (active) {
          setData(x.data);setLoadedCompanyId(activeCompany?.id??null);
            setMeta(x.meta);
            setError("");
          }
        })
        .catch(() => {
          if (active) setError("Não foi possível carregar as movimentações.");
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
  const noFilters =
    !Object.values(filters).some(Boolean) ||
    (filters.sortDirection === "desc" &&
      Object.entries(filters)
        .filter(([k]) => k !== "sortDirection")
        .every(([, v]) => !v));
  const visibleData=loadedCompanyId===activeCompany?.id?data:[];const visibleLoading=loading||loadedCompanyId!==activeCompany?.id;
  return (
    <main className="page inventory-page">
      <div className="inventory-page-header">
        <div>
          <h1>Movimentações</h1>
          <p>
            Consulte o histórico imutável de entradas, saídas, ajustes e
            reservas.
          </p>
        </div>
      </div>
      <section className="filter-panel" aria-label="Filtros de movimentações">
        <label>
          Pesquisar
          <input
            placeholder="SKU ou produto"
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
          />
        </label>
        <label>
          Tipo
          <select
            value={filters.type}
            onChange={(e) => update("type", e.target.value)}
          >
            <option value="">Todos</option>
            {Object.entries(movementLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Produto
          <select
            value={filters.productId}
            onChange={(e) => update("productId", e.target.value)}
          >
            <option value="">Todos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} · {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Data inicial
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
          />
        </label>
        <label>
          Ordem
          <select
            value={filters.sortDirection}
            onChange={(e) => update("sortDirection", e.target.value)}
          >
            <option value="desc">Mais recentes</option>
            <option value="asc">Mais antigas</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={() => {
            setFilters({
              search: "",
              type: "",
              productId: "",
              dateFrom: "",
              dateTo: "",
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
        <div className="loading-table" aria-live="polite">
          Carregando movimentações...
        </div>
      ) : !visibleData.length ? (
        <div className="empty-state">
          <p>
            {noFilters
              ? "Ainda não existem movimentações de estoque nesta empresa."
              : "Não foram encontradas movimentações para os filtros selecionados."}
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Data e hora</th>
                <th scope="col">Produto</th>
                <th scope="col">Tipo</th>
                <th scope="col" className="numeric">
                  Quantidade
                </th>
                <th scope="col" className="numeric">
                  Saldo anterior
                </th>
                <th scope="col" className="numeric">
                  Saldo posterior
                </th>
                <th scope="col" className="numeric optional-column">
                  Reservado anterior
                </th>
                <th scope="col" className="numeric optional-column">
                  Reservado posterior
                </th>
                <th scope="col">Usuário</th>
                <th scope="col">Motivo</th>
                <th scope="col">Referência</th>
                <th scope="col">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visibleData.map((x) => (
                <tr key={x.id}>
                  <td>{new Date(x.occurredAt).toLocaleString("pt-BR")}</td>
                  <td>
                    <strong>{x.product?.name}</strong>
                    <small>{x.product?.sku}</small>
                  </td>
                  <td>
                    <MovementTypeBadge type={x.type} />
                  </td>
                  <td className="numeric">
                    {format(x.quantity, x.product?.unitOfMeasure)}
                  </td>
                  <td className="numeric">{format(x.currentQuantityBefore)}</td>
                  <td className="numeric">{format(x.currentQuantityAfter)}</td>
                  <td className="numeric optional-column">
                    {format(x.reservedQuantityBefore)}
                  </td>
                  <td className="numeric optional-column">
                    {format(x.reservedQuantityAfter)}
                  </td>
                  <td>{x.performedBy?.name ?? "Sistema"}</td>
                  <td>{x.reason}</td>
                  <td>
                    {x.referenceType
                      ? `${x.referenceType}: ${x.referenceId ?? "—"}`
                      : "—"}
                  </td>
                  <td>
                    <button
                      className="table-action"
                      onClick={() => setDetail(x)}
                    >
                      Visualizar
                    </button>
                  </td>
                </tr>
              ))}
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
      {detail && (
        <div className="modal-backdrop">
          <section
            className="confirm-modal movement-detail"
            role="dialog"
            aria-modal="true"
            aria-labelledby="movement-detail-title"
          >
            <h2 id="movement-detail-title">Detalhes da movimentação</h2>
            <dl className="details">
              <div>
                <dt>ID</dt>
                <dd>{detail.id}</dd>
              </div>
              <div>
                <dt>Produto</dt>
                <dd>
                  {detail.product?.sku} · {detail.product?.name}
                </dd>
              </div>
              <div>
                <dt>Tipo</dt>
                <dd>{movementLabels[detail.type] ?? detail.type}</dd>
              </div>
              <div>
                <dt>Quantidade</dt>
                <dd>
                  {format(detail.quantity, detail.product?.unitOfMeasure)}
                </dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd>
                  {detail.currentQuantityBefore} → {detail.currentQuantityAfter}
                </dd>
              </div>
              <div>
                <dt>Reservado</dt>
                <dd>
                  {detail.reservedQuantityBefore} →{" "}
                  {detail.reservedQuantityAfter}
                </dd>
              </div>
              <div>
                <dt>Usuário</dt>
                <dd>{detail.performedBy?.name ?? "Sistema"}</dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{detail.reason}</dd>
              </div>
            </dl>
            <div className="form-actions">
              <button onClick={() => setDetail(null)}>Fechar</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
