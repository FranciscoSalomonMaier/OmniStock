import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const messages: Record<string, string> = {
  AUTHORIZATION_CANCELLED:
    "A autorização foi cancelada ou negada. Tente conectar novamente.",
  AUTHORIZATION_EXPIRED:
    "A tentativa de conexão expirou ou já foi utilizada. Inicie uma nova conexão pelas integrações.",
  // Older callback links may remain in history; never show their technical details.
  MERCADO_LIVRE_AUTHORIZATION_DENIED:
    "A autorização foi cancelada ou negada. Tente conectar novamente.",
  MERCADO_LIVRE_INVALID_STATE:
    "A tentativa de conexão expirou ou já foi utilizada. Inicie uma nova conexão pelas integrações.",
};
const unavailableMessage =
  "Não foi possível concluir a conexão. Tente novamente. Se o problema persistir, entre em contato com o suporte e informe o código de atendimento.";
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
          : (messages[result.code] ?? unavailableMessage)}
      </p>
      {!result.success && diagnosticId && (
        <p>
          Código de atendimento: <code>{diagnosticId}</code>
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
