import { useEffect, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import { integrationService } from "../../services/integration.service";
import type { ChannelConnection } from "../../types/integration";
export function MarketplaceAccountFilters({
  channel,
  account,
  onChange,
  lockedAccount,
}: {
  channel: string;
  account: string;
  onChange: (channel: string, account: string) => void;
  lockedAccount?: boolean;
}) {
  const { activeCompany } = useCompany();
  const [accounts, setAccounts] = useState<ChannelConnection[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    integrationService
      .list()
      .then((data) => {
        if (alive) {
          setAccounts(data);
          setError("");
        }
      })
      .catch(() => {
        if (alive) setError("Filtros de marketplace e conta indisponíveis.");
      });
    return () => {
      alive = false;
    };
  }, [activeCompany?.id]);
  const channels = Array.from(
    new Map(accounts.map((a) => [a.channel.code, a.channel])).values(),
  );
  return (
    <>
      {channels.length > 0 && (
        <>
          <label>
            <span className="ml-sr-only">Marketplace</span>
            <select
              aria-label="Marketplace"
              value={channel}
              disabled={lockedAccount}
              onChange={(e) => onChange(e.target.value, "")}
            >
              <option value="">Todos os marketplaces</option>
              {channels.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="ml-sr-only">Conta conectada</span>
            <select
              aria-label="Conta conectada"
              value={account}
              disabled={lockedAccount}
              onChange={(e) => onChange(channel, e.target.value)}
            >
              <option value="">Todas as contas</option>
              {accounts
                .filter((a) => !channel || a.channel.code === channel)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName}
                  </option>
                ))}
            </select>
          </label>
        </>
      )}
      {error && <small role="status">{error}</small>}
    </>
  );
}
