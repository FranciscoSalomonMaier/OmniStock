import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const messages: Record<string, string> = {
  MERCADO_LIVRE_AUTHORIZATION_DENIED: "A autorização foi cancelada ou negada.",
  MERCADO_LIVRE_INVALID_STATE:
    "A tentativa de conexão expirou ou já foi utilizada. Inicie uma nova conexão pelas integrações.",
  MERCADO_LIVRE_CONNECTION_LOOKUP_FAILED:
    "Não foi possível localizar a conexão do Mercado Livre.",
  MERCADO_LIVRE_TOKEN_EXCHANGE_FAILED:
    "Não foi possível obter o token de acesso do Mercado Livre.",
  MERCADO_LIVRE_ACCOUNT_LOOKUP_FAILED:
    "O token foi obtido, mas não foi possível consultar a conta no Mercado Livre.",
  MERCADO_LIVRE_CREDENTIAL_SAVE_FAILED:
    "Não foi possível proteger e salvar as credenciais da conexão.",
  MERCADO_LIVRE_CONNECTION_SAVE_FAILED:
    "Não foi possível finalizar o registro da conexão.",
};
export function MercadoLivreCallbackPage() {
  const [params, setParams] = useSearchParams();
  // Keep the outcome when sensitive query parameters are removed from history.
  const [result] = useState(() => ({
    success: params.get("status") === "success",
    code: params.get("code") ?? "",
    connectionId: params.get("connectionId"),
    diagnosticId: params.get("diagnosticId"),
  }));
  useEffect(() => {
    const timer = setTimeout(() => setParams({}, { replace: true }), 5000);
    return () => clearTimeout(timer);
  }, [setParams]);
  const diagnosticId = /^[0-9a-f-]{36}$/i.test(result.diagnosticId ?? "")
    ? result.diagnosticId
    : null;
  const connectionId = /^[0-9a-f-]{36}$/i.test(result.connectionId ?? "")
    ? result.connectionId
    : null;
  return (
    <main className="page">
      <h1>Conexão com Mercado Livre</h1>
      <p
        role="status"
        className={result.success ? "success-message" : "form-error"}
      >
        {result.success
          ? "Conta do Mercado Livre conectada com sucesso."
          : (messages[result.code] ??
            "Não foi possível concluir a conexão com o Mercado Livre.")}
      </p>
      {!result.success && diagnosticId && (
        <p>
          Identificador de diagnóstico: <code>{diagnosticId}</code>
        </p>
      )}
      {connectionId ? (
        <Link to={`/integrations/${connectionId}`}>Ver conexão</Link>
      ) : (
        <Link to="/integrations">Voltar às integrações</Link>
      )}
    </main>
  );
}
