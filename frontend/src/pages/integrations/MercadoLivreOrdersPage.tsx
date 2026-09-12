import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { integrationService } from "../../services/integration.service";
import type {
  MarketplaceOrder,
  MarketplaceSyncRun,
} from "../../types/integration";
export function MercadoLivreOrdersPage() {
  const { connectionId = "" } = useParams(),
    [items, setItems] = useState<MarketplaceOrder[]>([]),
    [runs, setRuns] = useState<MarketplaceSyncRun[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    Promise.all([
      integrationService.orders(connectionId),
      integrationService.runs(connectionId),
    ])
      .then(([orders, syncRuns]) => {
        setItems(orders);
        setRuns(syncRuns.filter((run) => run.operation === "IMPORT_ORDERS"));
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Falha ao carregar"),
      );
  }, [connectionId]);
  return (
    <main className="page">
      <Link to={`/integrations/${connectionId}`}>← Conexão</Link>
      <h1>Pedidos externos</h1>
      <p className="muted">
        Pedidos importados do canal — ainda não processados pelo fluxo interno.
      </p>
      {error && <p className="form-error">{error}</p>}
      <h2>Últimas importações</h2>
      {runs.length ? (
        <div className="cards">
          {runs.slice(0, 5).map((run) => (
            <section className="company-card" key={run.id}>
              <span>
                <strong>{run.status}</strong>
                <small className="connection-account">
                  Processados: {run.processedCount} · Sucessos: {run.successCount}
                  {run.failureCount ? ` · Falhas: ${run.failureCount}` : ""}
                </small>
                {run.errorMessage && (
                  <small className="form-error">
                    {run.errorCode}: {run.errorMessage}
                  </small>
                )}
              </span>
              <time>{new Date(run.createdAt).toLocaleString("pt-BR")}</time>
            </section>
          ))}
        </div>
      ) : (
        <p className="muted">Nenhuma tentativa de importação registrada.</p>
      )}
      <h2>Pedidos encontrados</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Data</th>
              <th>Comprador</th>
              <th>Status</th>
              <th>Pagamento</th>
              <th>Envio</th>
              <th>Itens</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.externalOrderId}</td>
                <td>{new Date(x.purchasedAt).toLocaleString()}</td>
                <td>{x.buyerNickname ?? "—"}</td>
                <td>{x.status}</td>
                <td>{x.paymentStatus ?? "—"}</td>
                <td>{x.shippingStatus ?? "—"}</td>
                <td>{x.items.length}</td>
                <td>
                  {x.currency} {x.totalAmount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!items.length && (
          <p className="muted">
            Nenhum pedido foi importado. Consulte a execução acima para saber
            se a conta não possui vendas ou se o provedor recusou a consulta.
          </p>
        )}
      </div>
    </main>
  );
}
