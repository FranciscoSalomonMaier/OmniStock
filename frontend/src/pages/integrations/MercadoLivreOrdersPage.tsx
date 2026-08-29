import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { integrationService } from "../../services/integration.service";
import type { MarketplaceOrder } from "../../types/integration";
export function MercadoLivreOrdersPage() {
  const { connectionId = "" } = useParams(),
    [items, setItems] = useState<MarketplaceOrder[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    integrationService
      .orders(connectionId)
      .then(setItems)
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
      </div>
    </main>
  );
}
