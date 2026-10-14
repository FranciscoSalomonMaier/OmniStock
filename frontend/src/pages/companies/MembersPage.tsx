import "./members.css";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useCompany } from "../../hooks/useCompany";
import { companyService } from "../../services/company.service";
import type { CompanyRole, Membership } from "../../types/company";
const roleLabels: Record<CompanyRole, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  STOCKIST: "Estoquista",
  BILLING: "Faturamento",
  SUPPORT: "Suporte",
  VIEWER: "Visualizador",
};
const roles: CompanyRole[] = [
  "ADMIN",
  "MANAGER",
  "STOCKIST",
  "BILLING",
  "SUPPORT",
  "VIEWER",
];
export function MembersPage() {
  const { activeCompany, activeMembership } = useCompany();
  const [members, setMembers] = useState<Membership[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CompanyRole>("VIEWER");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    if (activeCompany)
      setMembers(await companyService.members(activeCompany.id));
  }, [activeCompany]);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  if (!activeCompany)
    return (
      <main className="page">
        <p>Selecione uma empresa.</p>
      </main>
    );
  if (!["ADMIN", "MANAGER"].includes(activeMembership?.role ?? ""))
    return (
      <main className="page">
        <p>Você não possui permissão.</p>
      </main>
    );
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await companyService.addMember(activeCompany!.id, email, role);
      setEmail("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha");
    }
  }
  return (
    <main className="page members-page">
      <header className="members-header">
        <span className="eyebrow">Empresas</span>
        <h1>Membros da empresa</h1>
        <p>
          Gerencie os acessos e perfis de{" "}
          <strong>{activeCompany.tradeName}</strong>.
        </p>
      </header>
      <section className="members-add">
        <h2>Adicionar membro</h2>
        <p>Informe o e-mail do usuário e selecione seu perfil de acesso.</p>
        <form className="members-form" onSubmit={add}>
          <label>
            E-mail
            <input
              type="email"
              placeholder="usuario@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Perfil de acesso
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as CompanyRole)}
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabels[r]}
                </option>
              ))}
            </select>
          </label>
          <button className="members-primary" type="submit">
            + Adicionar membro
          </button>
        </form>
      </section>
      {message && (
        <p className="form-error" role="alert">
          {message}
        </p>
      )}
      <section className="members-list">
        <div className="members-list-header">
          <h2>Membros cadastrados</h2>
          <span>
            {members.length} {members.length === 1 ? "membro" : "membros"}
          </span>
        </div>
        {members.map((member) => (
          <article className="members-row" key={member.id}>
            <span className="member-avatar" aria-hidden="true">
              {(member.user?.name || "?").trim().slice(0, 1).toUpperCase()}
            </span>
            <div className="member-info">
              <strong>{member.user?.name}</strong>
              <span>{member.user?.email}</span>
            </div>
            <span
              className={`member-status ${member.isActive ? "" : "inactive"}`}
            >
              {member.isActive ? "Ativo" : "Inativo"}
            </span>
            <label className="member-role">
              <span>Perfil de acesso</span>
              <select
                aria-label={`Perfil de ${member.user?.name ?? "membro"}`}
                value={member.role}
                onChange={async (e) => {
                  try {
                    await companyService.updateMember(
                      activeCompany.id,
                      member.id,
                      { role: e.target.value as CompanyRole },
                    );
                    await load();
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Falha ao atualizar perfil",
                    );
                  }
                }}
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {roleLabels[r]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="members-deactivate"
              onClick={async () => {
                if (confirm("Desativar este membro?")) {
                  try {
                    await companyService.updateMember(
                      activeCompany.id,
                      member.id,
                      { isActive: false },
                    );
                    await load();
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "Falha ao desativar membro",
                    );
                  }
                }
              }}
            >
              Desativar
            </button>
          </article>
        ))}
      </section>
    </main>
  );
}
