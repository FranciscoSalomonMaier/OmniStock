import { useEffect, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import { apiRequest } from "../../services/api";
import { FiscalForm } from "./FiscalForm";
import {
  profileFields,
  warning,
  reviewLabel,
  type FiscalRecord,
} from "./fiscal-model";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import "./fiscal.css";
export function FiscalProductEditor({ productId }: { productId: string }) {
  const { activeCompany } = useCompany();
  return (
    <ProductEditor
      key={`${activeCompany?.id}:${productId}`}
      productId={productId}
    />
  );
}
function ProductEditor({ productId }: { productId: string }) {
  const [profiles, setProfiles] = useState<FiscalRecord[]>([]),
    [permissions, setPermissions] = useState<string[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0);
  const [readiness, setReadiness] = useState<{
    errors: { message: string }[];
    warnings: { message: string }[];
  } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([
      apiRequest<FiscalRecord[]>(`/products/${productId}/fiscal-profile`),
      apiRequest<string[]>("/fiscal/permissions"),
      apiRequest<{
        errors: { message: string }[];
        warnings: { message: string }[];
      }>(`/fiscal/readiness/product/${productId}`),
    ])
      .then(([p, per, ready]) => {
        if (alive) {
          setProfiles(p);
          setReadiness(ready);
          setPermissions(per);
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [productId, revision]);
  async function action(path: string, body?: unknown) {
    try {
      await apiRequest(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      setRevision((r) => r + 1);
      setMessage("Revisão atualizada.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const current = profiles.find(
    (p) =>
      p.active &&
      new Date(String(p.validFrom)) <= new Date() &&
      (!p.validUntil || new Date(String(p.validUntil)) > new Date()),
  );
  return (
    <section className="fiscal-page fiscal-product">
      <h2>Fiscal do produto</h2>
      <p className="fiscal-warning">{warning}</p>
      <p>
        O SKU comercial do kit possui classificação própria. A composição física
        não define sua tributação.
      </p>
      {loading ? (
        <p>Carregando…</p>
      ) : (
        <>
          <p>
            <span className="fiscal-badge">
              {current
                ? reviewLabel[current.accountantReviewStatus || ""]
                : "Sem perfil vigente"}
            </span>
          </p>
          {message && <p role="status">{message}</p>}
          {readiness && (
            <details open={readiness.errors.length > 0}>
              <summary>
                Pendências e avisos fiscais ({readiness.errors.length}{" "}
                impedimentos)
              </summary>
              <ul>
                {[...readiness.errors, ...readiness.warnings].map(
                  (issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ),
                )}
              </ul>
            </details>
          )}
          {permissions.includes("fiscal.products.manage") && (
            <FiscalForm
              key={revision}
              fields={profileFields}
              initial={{
                ...(current || {}),
                validFrom: new Date().toISOString(),
              }}
              onSave={async (d) => {
                if (
                  current &&
                  !confirm(
                    "Salvar nova versão fiscal? Ela precisará de nova revisão contábil.",
                  )
                )
                  return;
                try {
                  await apiRequest(`/products/${productId}/fiscal-profile`, {
                    method: "PUT",
                    body: JSON.stringify(d),
                  });
                  setRevision((r) => r + 1);
                  setMessage(
                    "Nova versão fiscal salva. Aprovação anterior não se aplica à nova versão.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
          )}
          {current && permissions.includes("fiscal.review.submit") && (
            <button
              type="button"
              onClick={() =>
                action(`/products/${productId}/fiscal-profile/submit-review`)
              }
            >
              Enviar para revisão
            </button>
          )}
          {current?.accountantReviewStatus === "PENDING_REVIEW" &&
            permissions.includes("fiscal.review.approve") && (
              <button
                type="button"
                onClick={() => {
                  const note = prompt("Observação da revisão:");
                  const accountantReference = note
                    ? prompt("Nome ou referência do contador:")
                    : null;
                  if (note && accountantReference)
                    void action(
                      `/products/${productId}/fiscal-profile/approve`,
                      {
                        note,
                        accountantReference,
                        decision: confirm(
                          "Aprovar esta configuração? Cancelar registra rejeição.",
                        )
                          ? "APPROVED"
                          : "REJECTED",
                      },
                    );
                }}
              >
                Registrar revisão
              </button>
            )}
          <h3>Histórico de versões</h3>
          {profiles.length ? (
            <ul>
              {profiles.map((p) => (
                <li key={p.id}>
                  Versão {p.version} · NCM {String(p.ncm || "ausente")} ·{" "}
                  {new Date(String(p.validFrom)).toLocaleString("pt-BR")} ·{" "}
                  {reviewLabel[p.accountantReviewStatus || ""]}
                  <details>
                    <summary>Consultar configuração preservada</summary>
                    <dl>
                      {profileFields
                        .filter((f) => p[f.key] != null)
                        .map((f) => (
                          <div key={f.key}>
                            <dt>{f.label}</dt>
                            <dd>{String(p[f.key])}</dd>
                          </div>
                        ))}
                    </dl>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sem configuração fiscal cadastrada.</p>
          )}
        </>
      )}
      <ErrorDialog
        open={Boolean(error)}
        title="Configuração fiscal"
        message={error}
        onClose={() => setError("")}
      />
    </section>
  );
}
