import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCompany } from "../../hooks/useCompany";
import { integrationService } from "../../services/integration.service";
import type {
  ChannelConnection,
  MarketplaceConnectorDescriptor,
} from "../../types/integration";
const labels: Record<string, string> = {
  authorization: "Autorização",
  tokenRefresh: "Renovação de token",
  productImport: "Importação de produtos",
  orderImport: "Importação de pedidos",
  stockUpdate: "Atualização de estoque",
  priceUpdate: "Atualização de preço",
  invoiceSubmission: "Envio fiscal",
  webhooks: "Webhooks",
  incrementalSync: "Sincronização incremental",
  multipleAccounts: "Múltiplas contas",
  disconnectRevocation: "Revogação remota",
};
export function IntegrationDetailsPage() {
  const { id = "" } = useParams(),
    { activeMembership } = useCompany(),
    [data, setData] = useState<ChannelConnection | null>(null),
    [descriptor, setDescriptor] =
      useState<MarketplaceConnectorDescriptor | null>(null),
    [error, setError] = useState("");
  const canManage = ["ADMIN", "MANAGER"].includes(activeMembership?.role ?? ""),
    isAdmin = activeMembership?.role === "ADMIN";
  async function load() {
    try {
      const [connection, capabilities] = await Promise.all([
        integrationService.get(id),
        integrationService.capabilities(id),
      ]);
      setData(connection);
      setDescriptor(capabilities);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar conexão");
    }
  }
  useEffect(() => {
    void load();
  }, [id]);
  async function action(fn: () => Promise<unknown>) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operação não concluída");
    }
  }
  async function connectMercadoLivre() {
    try {
      const result = await integrationService.authorizeMercadoLivre(id);
      window.location.assign(result.authorizationUrl);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Não foi possível iniciar a autorização.",
      );
    }
  }
  return (
    <main className="page">
      <Link to="/integrations">← Integrações</Link>
      <h1>{data?.displayName ?? "Conexão"}</h1>
      {error && <p className="form-error">{error}</p>}
      {data && (
        <>
          <p>
            <strong>Canal:</strong> {data.channel.name}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            {data.requiresReauthorization
              ? "Reconexão necessária"
              : data.status}
          </p>
          <p>
            <strong>Última tentativa:</strong>{" "}
            {data.lastSyncAt ?? "Nunca executada"}
          </p>
          <p>
            <strong>Último sucesso:</strong>{" "}
            {data.lastSuccessfulSyncAt ?? "Nunca executado"}
          </p>
          {data.lastError && (
            <p className="form-error">
              {data.lastError.code}: {data.lastError.message}
            </p>
          )}
          {descriptor && (
            <>
              <h2>Capacidades</h2>
              <p>
                <strong>Conector:</strong>{" "}
                {descriptor.enabled ? "Configurado" : "Não configurado"}
              </p>
              <div className="cards">
                {Object.entries(descriptor.capabilities).map(([key, value]) => (
                  <section className="company-card" key={key}>
                    <strong>{labels[key] ?? key}</strong>
                    <span>
                      {!value.supportedByProvider
                        ? "Não suportado"
                        : value.implemented
                          ? "Implementado"
                          : "Em breve"}
                    </span>
                  </section>
                ))}
              </div>
            </>
          )}
          {canManage && (
            <div className="form-actions">
              {data.channel.code === "MERCADO_LIVRE" &&
                descriptor?.enabled &&
                data.status !== "CONNECTED" && (
                  <button onClick={() => void connectMercadoLivre()}>
                    Conectar Mercado Livre
                  </button>
                )}
              {data.channel.code === "MERCADO_LIVRE" &&
                data.status === "CONNECTED" && (
                  <>
                    <button
                      onClick={() =>
                        void action(() => integrationService.syncListings(id))
                      }
                    >
                      Importar anúncios
                    </button>
                    <button
                      onClick={() =>
                        void action(() => integrationService.syncOrders(id))
                      }
                    >
                      Importar pedidos
                    </button>
                    <Link to={`/integrations/mercado-livre/${id}/listings`}>
                      Ver anúncios
                    </Link>
                    <Link to={`/integrations/mercado-livre/${id}/orders`}>
                      Ver pedidos
                    </Link>
                  </>
                )}
              {descriptor?.enabled &&
              descriptor.capabilities.authorization.implemented ? (
                <button
                  onClick={() =>
                    void action(() => integrationService.validate(id))
                  }
                >
                  Validar
                </button>
              ) : (
                <button disabled title="Conector ainda não implementado">
                  Validar — em breve
                </button>
              )}
              {data.status === "DISABLED" ? (
                <button
                  onClick={() =>
                    void action(() => integrationService.enable(id))
                  }
                >
                  Habilitar
                </button>
              ) : (
                <button
                  onClick={() =>
                    void action(() => integrationService.disable(id))
                  }
                >
                  Desabilitar
                </button>
              )}
              {isAdmin && (
                <button
                  className="danger"
                  onClick={() =>
                    window.confirm("Desconectar e apagar as credenciais?") &&
                    void action(() => integrationService.disconnect(id))
                  }
                >
                  Desconectar
                </button>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}
