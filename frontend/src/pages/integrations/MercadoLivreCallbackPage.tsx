import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
export function MercadoLivreCallbackPage() {
  const [params, setParams] = useSearchParams(),
    success = params.get("status") === "success",
    denied = params.get("code") === "MERCADO_LIVRE_AUTHORIZATION_DENIED",
    connectionId = params.get("connectionId");
  useEffect(() => {
    const timer = setTimeout(() => setParams({}, { replace: true }), 5000);
    return () => clearTimeout(timer);
  }, [setParams]);
  return (
    <main className="page">
      <h1>Conexão com Mercado Livre</h1>
      <p className={success ? "success-message" : "form-error"}>
        {success
          ? "Conta do Mercado Livre conectada com sucesso."
          : denied
            ? "A autorização foi cancelada ou negada."
            : "Não foi possível concluir a conexão com o Mercado Livre."}
      </p>
      {connectionId ? (
        <Link to={`/integrations/${connectionId}`}>Ver conexão</Link>
      ) : (
        <Link to="/integrations">Voltar às integrações</Link>
      )}
    </main>
  );
}
