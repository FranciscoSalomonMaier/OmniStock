import { useEffect, useState } from "react";
import { useCompany } from "../../hooks/useCompany";
import {
  bundleService,
  type BundleComposition,
} from "../../services/bundle.service";
import { productService } from "../../services/product.service";
import type { Product } from "../../types/product";
import "./bundle-editor.css";
export function BundleEditor(props: { productId: string; readOnly?: boolean }) {
  const { activeCompany } = useCompany();
  return (
    <BundleEditorForCompany
      key={`${props.productId}:${activeCompany?.id}`}
      {...props}
    />
  );
}
function BundleEditorForCompany({
  productId,
  readOnly = false,
}: {
  productId: string;
  readOnly?: boolean;
}) {
  const { activeCompany, activeMembership } = useCompany();
  const [composition, setComposition] = useState<BundleComposition | null>(
      null,
    ),
    [products, setProducts] = useState<Product[]>([]),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [productsLoading, setProductsLoading] = useState(true);
  const availableProducts = products.filter(
    (p) => !composition?.components.some((c) => c.productId === p.id),
  );
  const canEdit =
    !readOnly &&
    ["ADMIN", "MANAGER", "STOCKIST"].includes(activeMembership?.role ?? "");
  useEffect(() => {
    let alive = true;
    bundleService
      .get(productId)
      .then((x) => {
        if (alive) setComposition(x);
      })
      .catch((e) => {
        if (alive)
          setError(
            e instanceof Error ? e.message : "Falha ao consultar o kit.",
          );
      });
    return () => {
      alive = false;
    };
  }, [productId, activeCompany?.id]);
  useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    const timer = setTimeout(() => {
      setProductsLoading(true);
      productService
        .list(new URLSearchParams({ search, limit: "100", status: "ACTIVE" }))
        .then((x) => {
          if (alive) setProducts(x.data.filter((p) => p.id !== productId));
        })
        .catch((e) => {
          if (alive)
            setError(
              e instanceof Error ? e.message : "Falha ao buscar componentes.",
            );
        })
        .finally(() => {
          if (alive) setProductsLoading(false);
        });
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [search, productId, activeCompany?.id, canEdit]);
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setComposition(await bundleService.get(productId));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível alterar o kit.",
      );
    } finally {
      setBusy(false);
    }
  }
  function edit(id: string, old: string) {
    const next = window.prompt(
      "Quantidade por kit (inteiro positivo):",
      String(Number(old)),
    );
    if (next === null) return;
    const n = Number(next);
    if (!Number.isSafeInteger(n) || n <= 0) {
      setError("Informe uma quantidade inteira positiva.");
      return;
    }
    void mutate(() => bundleService.update(productId, id, n));
  }
  return (
    <section
      className="bundle-editor"
      aria-label="Composição do produto"
      aria-busy={busy}
    >
      <header className="bundle-header">
        <div>
          <h2>Composição do produto</h2>
          <p>Defina os produtos e as quantidades que fazem parte do kit.</p>
        </div>
        {composition && (
          <span className="bundle-type">
            {composition.isBundle ? "Kit" : "Produto unitário"}
          </span>
        )}
      </header>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!composition ? (
        <p className="bundle-note">Carregando composição...</p>
      ) : !composition.isBundle ? (
        <div className="bundle-unitary">
          <p>Produto unitário com estoque físico.</p>
          {canEdit && (
            <button
              className="bundle-button bundle-primary"
              type="button"
              disabled={busy}
              onClick={() => void mutate(() => bundleService.create(productId))}
            >
              Cadastrar como kit
            </button>
          )}
          <p className="bundle-note">
            Para vender kits de um produto que já possui estoque, cadastre um
            novo produto comercial.
          </p>
        </div>
      ) : (
        <>
          <div className="bundle-summary">
            <span className="bundle-summary-icon" aria-hidden="true">
              ▦
            </span>
            <div>
              <span>Disponível para venda</span>
              <strong>
                {composition.availableKits} <small>kits</small>
              </strong>
            </div>
            <p>
              O estoque é calculado pelos componentes.
              <br />
              Alterações valem para novos pedidos.
            </p>
          </div>
          <div className="bundle-section-heading">
            <h3>Componentes do kit</h3>
            <span>
              {composition.components.length}{" "}
              {composition.components.length === 1 ? "produto" : "produtos"}
            </span>
          </div>
          {!composition.components.length ? (
            <p className="bundle-empty">
              Adicione pelo menos um componente para disponibilizar este kit.
            </p>
          ) : (
            <ul className="bundle-components">
              {composition.components.map((c) => (
                <li key={c.id}>
                  <div className="bundle-component-info">
                    <strong>{c.productName}</strong>
                    <span>
                      {Number(c.quantity).toLocaleString("pt-BR")}{" "}
                      {Number(c.quantity) === 1 ? "unidade" : "unidades"} por
                      kit
                    </span>
                  </div>
                  {canEdit && (
                    <div className="bundle-component-actions">
                      <button
                        className="bundle-button bundle-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => edit(c.id, c.quantity)}
                      >
                        Editar quantidade
                      </button>
                      <button
                        className="bundle-button bundle-remove"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remover ${c.productName} deste kit?`,
                            )
                          )
                            void mutate(() =>
                              bundleService.remove(productId, c.id),
                            );
                        }}
                      >
                        Remover
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <div className="bundle-add-panel">
              <h3>Adicionar componente</h3>
              <p className="bundle-note">
                Busque pelo nome ou SKU, selecione o produto e informe quantas
                unidades compõem cada kit.
              </p>
              <div className="bundle-fields">
                <label>
                  Buscar componente
                  <input
                    placeholder="Nome ou SKU, por exemplo MK004"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelected("");
                      setProductsLoading(true);
                    }}
                    disabled={busy}
                  />
                  <small>Filtra as opções no campo Produto.</small>
                </label>
                <label>
                  Produto
                  <select
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                    disabled={busy || productsLoading}
                  >
                    <option value="">
                      {productsLoading
                        ? "Carregando produtos…"
                        : availableProducts.length
                          ? "Selecione um produto"
                          : "Nenhum produto disponível"}
                    </option>
                    {availableProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.sku} — {p.name}
                      </option>
                    ))}
                  </select>
                  <small role="status">
                    {productsLoading
                      ? "Consultando produtos cadastrados…"
                      : availableProducts.length
                        ? `${availableProducts.length} produtos disponíveis nesta busca.`
                        : search
                          ? "Nenhum produto disponível para esta busca."
                          : "O próprio kit e os componentes já adicionados não aparecem nesta lista."}
                  </small>
                </label>
                <label>
                  Quantidade por kit
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>
              <div className="bundle-add-actions">
                <button
                  className="bundle-button bundle-primary"
                  type="button"
                  disabled={
                    busy ||
                    productsLoading ||
                    !availableProducts.some((p) => p.id === selected) ||
                    !Number.isSafeInteger(Number(quantity)) ||
                    Number(quantity) <= 0
                  }
                  onClick={() =>
                    void mutate(() =>
                      bundleService.add(productId, selected, Number(quantity)),
                    )
                  }
                >
                  + Adicionar componente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
