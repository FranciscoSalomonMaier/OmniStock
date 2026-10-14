import { useEffect, useRef, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { friendly } from "./labels";
export function LinkBadge({ status }: { status: string | null }) {
  const value = status || "NOT_VALIDATED";
  return (
    <span className={`ml-badge ml-badge-${value.toLowerCase()}`}>
      {friendly[value] || value}
    </span>
  );
}
export function ProductInfo({
  name,
  sku,
  image,
}: {
  name: string;
  sku?: string | null;
  image?: string | null;
}) {
  return (
    <div className="ml-info">
      {image ? (
        <img src={image} alt="" loading="lazy" />
      ) : (
        <span className="ml-placeholder" aria-hidden="true">
          ▦
        </span>
      )}
      <div>
        <strong className="ml-clamp" title={name}>
          {name}
        </strong>
        {sku && <small>SKU {sku}</small>}
      </div>
    </div>
  );
}
export function MarketplaceLinksLayout({
  title,
  description,
  action,
  count,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  return (
    <main className="page ml-page">
      <header className="ml-header">
        <div>
          <span className="eyebrow">Integrações</span>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action}
      </header>
      <nav className="ml-tabs" aria-label="Vinculação de anúncios">
        {[
          ["/marketplace-links", "Vinculados"],
          ["/marketplace-links/unlinked", "Não vinculados"],
          ["/marketplace-links/suggestions", "Sugestões"],
        ].map(([to, label]) => (
          <NavLink key={to} to={to} end>
            {({ isActive }) => (
              <>
                {label}
                {isActive && count !== undefined && <span>{count}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {children}
    </main>
  );
}
export function LinkEmpty({
  loading,
  error,
  filtered,
  title,
  description,
}: {
  loading: boolean;
  error: string;
  filtered: boolean;
  title: string;
  description: string;
}) {
  return (
    <div className="ml-empty" role={error ? "alert" : "status"}>
      <span aria-hidden="true">{error ? "!" : "▦"}</span>
      <h2>
        {loading
          ? "Carregando…"
          : error
            ? "Não foi possível carregar os dados"
            : filtered
              ? "Nenhum resultado para esta pesquisa"
              : title}
      </h2>
      <p>
        {loading
          ? "Aguarde enquanto consultamos os registros."
          : error ||
            (filtered
              ? "Altere a pesquisa ou os filtros e tente novamente."
              : description)}
      </p>
    </div>
  );
}
export function LinkPagination({
  page,
  pages,
  total,
  busy,
  onPage,
  pageCountOnly = false,
}: {
  page: number;
  pages: number;
  total: number;
  busy: boolean;
  onPage: (page: number) => void;
  pageCountOnly?: boolean;
}) {
  return (
    <footer className="ml-pagination">
      <span>
        {total} {pageCountOnly ? "sugestões nesta página" : "resultados"} ·
        Página {page} de {pages || 1}
      </span>
      <div>
        <button disabled={busy || page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </button>
        <button
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </button>
      </div>
    </footer>
  );
}
export function LinkDrawer({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const working = useRef(busy);
  useEffect(() => {
    close.current = onClose;
    working.current = busy;
  }, [onClose, busy]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("button,input")?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === "Escape" && !working.current) {
        e.preventDefault();
        e.stopImmediatePropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
          ) || [],
        );
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="ml-drawer-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        ref={ref}
        className="ml-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ml-drawer-title"
      >
        <header>
          <h2 id="ml-drawer-title">{title}</h2>
          <button aria-label="Fechar painel" disabled={busy} onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
