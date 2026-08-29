import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { integrationService } from "../../services/integration.service";
import type { MarketplaceListing } from "../../types/integration";
export function MercadoLivreListingsPage() {
  const { connectionId = "" } = useParams(),
    [items, setItems] = useState<MarketplaceListing[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    integrationService
      .listings(connectionId)
      .then(setItems)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Falha ao carregar"),
      );
  }, [connectionId]);
  return (
    <main className="page">
      <Link to={`/integrations/${connectionId}`}>← Conexão</Link>
      <h1>Anúncios do Mercado Livre</h1>
      <p className="muted">
        Anúncios importados; ainda não vinculados definitivamente aos produtos
        internos.
      </p>
      {error && <p className="form-error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Título</th>
              <th>SKU</th>
              <th>Variação</th>
              <th>Status</th>
              <th>Preço</th>
              <th>Disponível</th>
              <th>Sincronizado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td>{x.externalItemId}</td>
                <td>{x.title}</td>
                <td>{x.externalSku ?? "—"}</td>
                <td>{x.externalVariationId ?? "—"}</td>
                <td>{x.status}</td>
                <td>
                  {x.currency} {x.price}
                </td>
                <td>{x.availableQuantity ?? "—"}</td>
                <td>{new Date(x.lastSyncedAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
