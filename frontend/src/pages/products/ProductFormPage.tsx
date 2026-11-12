import { merchandiseOriginOptions } from "../fiscal/fiscal-model";
import { FiscalProductEditor } from "../fiscal/FiscalProductEditor";
import { BundleEditor } from "../../components/products/BundleEditor";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ErrorDialog } from "../../components/feedback/ErrorDialog";
import { ApiError } from "../../services/api";
import { productService } from "../../services/product.service";
import { kitService } from "../../services/kit.service";
import type { Category, Product } from "../../types/product";
import "../inventory/inventory.css";
const initial = {
  sku: "",
  name: "",
  description: "",
  barcode: "",
  unitOfMeasure: "UN",
  purchasePrice: "",
  costPrice: "",
  ncm: "",
  cest: "",
  merchandiseOrigin: "",
  weight: "",
  height: "",
  width: "",
  length: "",
  minimumStock: "0",
  status: "ACTIVE",
  categoryId: "",
};
type Form = typeof initial;
type Field = keyof Form;
type Errors = Partial<Record<Field, string>>;
const numericRules: Partial<Record<Field, RegExp>> = {
  purchasePrice: /^\d{1,13}(\.\d{1,2})?$/,
  costPrice: /^\d{1,13}(\.\d{1,2})?$/,
  weight: /^\d{1,9}(\.\d{1,3})?$/,
  height: /^\d{1,10}(\.\d{1,2})?$/,
  width: /^\d{1,10}(\.\d{1,2})?$/,
  length: /^\d{1,10}(\.\d{1,2})?$/,
};
function barcodeValid(value: string) {
  if (!/^\d{8}$|^\d{12,14}$/.test(value)) return false;
  if (![8, 13].includes(value.length)) return true;
  const digits = value.split("").map(Number),
    check = digits.pop()!;
  let sum = 0;
  for (let i = digits.length - 1, p = 0; i >= 0; i--, p++)
    sum += digits[i] * (p % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10 === check;
}
function validate(form: Form): Errors {
  const e: Errors = {};
  if (!form.sku.trim()) e.sku = "O SKU é obrigatório.";
  else if (!/^[A-Za-z0-9._/-]+$/.test(form.sku))
    e.sku = "Use apenas letras, números, ponto, barra, hífen ou sublinhado.";
  if (form.name.trim().length < 2)
    e.name = form.name.trim()
      ? "O nome deve possuir pelo menos 2 caracteres."
      : "O nome do produto é obrigatório.";
  if (!form.unitOfMeasure) e.unitOfMeasure = "Selecione uma unidade de medida.";
  for (const key of Object.keys(numericRules) as Field[])
    if (
      form[key] &&
      (Number(form[key]) < 0 || !numericRules[key]!.test(form[key]))
    )
      e[key] =
        `${({ purchasePrice: "O preço de compra", costPrice: "O preço de custo", weight: "O peso", height: "A altura", width: "A largura", length: "O comprimento" } as Record<string, string>)[key]} não pode ser negativo ou inválido.`;
  if (
    form.minimumStock &&
    (Number(form.minimumStock) < 0 ||
      !/^\d{1,12}(\.\d{1,3})?$/.test(form.minimumStock))
  )
    e.minimumStock = "O estoque mínimo não pode ser negativo ou inválido.";
  if (form.ncm && !/^\d{8}$/.test(form.ncm))
    e.ncm = "O NCM deve possuir 8 dígitos.";
  if (form.cest && !/^\d{7}$/.test(form.cest))
    e.cest = "O CEST deve possuir 7 dígitos.";
  if (form.barcode && !barcodeValid(form.barcode))
    e.barcode = "O código de barras informado é inválido.";
  return e;
}
function dialogMessage(error: unknown, kind: "produto" | "kit") {
  if (!(error instanceof ApiError))
    return `Não foi possível salvar o ${kind}. Tente novamente.`;
  if (error.status === 0) return error.message;
  if (error.status === 403)
    return `Você não possui permissão para cadastrar ${kind === "kit" ? "kits" : "produtos"}.`;
  if (error.status === 409) return error.message;
  if (error.status === 400) return "Existem informações inválidas no cadastro.";
  return (
    error.message || `Não foi possível salvar o ${kind}. Tente novamente.`
  );
}
export function ProductFormPage({ kind = "product" }: { kind?: "product" | "kit" }) {
  const isKit = kind === "kit";
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({ ...initial, unitOfMeasure: isKit ? "KIT" : "UN" });
  const [components, setComponents] = useState<{ product: Product; quantity: string }[]>([]);
  const [componentSearch, setComponentSearch] = useState("");
  const [componentOptions, setComponentOptions] = useState<Product[]>([]);
  const [selectedComponent, setSelectedComponent] = useState("");
  const [componentQuantity, setComponentQuantity] = useState("1");
  const [componentError, setComponentError] = useState("");
  const [loadingProduct, setLoadingProduct] = useState(Boolean(id));
  const [loadError, setLoadError] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [summary, setSummary] = useState("");
  const [uploadWarning, setUploadWarning] = useState("");
  const [dialog, setDialog] = useState<{
    message: string;
    fields?: Record<string, string[]>;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const refs = useRef<Partial<Record<Field, HTMLElement | null>>>({});
  useEffect(() => {
    void productService.categories().then(setCategories);
    if (id) {
      setLoadingProduct(true);
      void productService
        .get(id)
        .then((p) => {
          if (Boolean(p.isBundle) !== isKit) {
            navigate(p.isBundle ? `/kits/${id}/edit` : `/products/${id}/edit`, { replace: true });
            return;
          }
          setForm(
            Object.fromEntries(
              Object.keys(initial).map((k) => [
                k,
                String((p as unknown as Record<string, unknown>)[k] ?? ""),
              ]),
            ) as Form,
          );
          setLoadingProduct(false);
        })
        .catch(() => { setLoadError("Não foi possível carregar o cadastro."); setLoadingProduct(false); });
    }
  }, [id, isKit, navigate]);
  useEffect(() => {
    if (!isKit || id) return;
    let active = true;
    const timer = setTimeout(() => {
      void productService.list(new URLSearchParams({ search: componentSearch, limit: "100", status: "ACTIVE" }))
        .then((page) => { if (active) setComponentOptions(page.data); })
        .catch(() => { if (active) setComponentError("Não foi possível buscar produtos para o kit."); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [isKit, id, componentSearch]);
  const closeDialog = useCallback(() => {
    setDialog(null);
    const first = Object.keys(errors)[0] as Field | undefined;
    if (first) setTimeout(() => refs.current[first]?.focus(), 0);
  }, [errors]);
  function change(key: Field, value: string) {
    const normalizedValue = key === "ncm" ? value.replace(/\D/g, "") : value;
    const next = { ...form, [key]: normalizedValue };
    setForm(next);
    if (touched[key]) setErrors(validate(next));
  }
  function blur(key: Field) {
    setTouched((x) => ({ ...x, [key]: true }));
    setErrors(validate(form));
  }
  function markAndFocus(next: Errors) {
    setTouched(Object.fromEntries(Object.keys(initial).map((k) => [k, true])));
    setErrors(next);
    setSummary(`Revise os campos destacados antes de salvar o ${isKit ? "kit" : "produto"}.`);
    const first = Object.keys(next)[0] as Field | undefined;
    if (first) {
      refs.current[first]?.focus();
      refs.current[first]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    const local = validate(form);
    if (Object.keys(local).length) {
      markAndFocus(local);
      return;
    }
    if (isKit && !id && !components.length) {
      setComponentError("Adicione pelo menos um produto ao kit.");
      return;
    }
    setSaving(true);
    setSummary("");
    setUploadWarning("");
    const payload = Object.fromEntries(
      Object.entries(form).map(([key, value]) => [
        key,
        value === "" ? null : value,
      ]),
    );
    if (isKit) delete payload.unitOfMeasure;
    try {
      const product = id
        ? isKit ? await kitService.update(id, payload) : await productService.update(id, payload)
        : isKit
          ? await kitService.create({ ...payload, components: components.map(({ product, quantity }) => ({ productId: product.id, quantity: Number(quantity) })) })
          : await productService.create(payload);
      const failures: string[] = [];
      for (const file of files)
        try {
          await productService.upload(product.id, file);
        } catch {
          failures.push(file.name);
        }
      if (failures.length) {
        setUploadWarning(
          `${isKit ? "Kit" : "Produto"} salvo com sucesso, mas não foi possível enviar: ${failures.join(", ")}.`,
        );
        if (!id)
          navigate(isKit ? `/kits/${product.id}/edit` : `/products/${product.id}/edit`, {
            replace: true,
            state: { uploadWarning: failures },
          });
        return;
      }
      navigate(`/products/${product.id}`);
    } catch (reason) {
      const api = reason instanceof ApiError ? reason : null;
      const fields = api?.fieldErrors;
      const mapped: Errors = {};
      if (fields)
        for (const [k, v] of Object.entries(fields))
          if (k in initial) mapped[k as Field] = v[0];
      if (api?.status === 409 && api.message.toLowerCase().includes("sku")) {
        mapped.sku = dialogMessage(api, isKit ? "kit" : "produto");
      }
      if (Object.keys(mapped).length) {
        setErrors((x) => ({ ...x, ...mapped }));
        setTouched((x) => ({
          ...x,
          ...Object.fromEntries(Object.keys(mapped).map((k) => [k, true])),
        }));
      }
      setDialog({ message: dialogMessage(reason, isKit ? "kit" : "produto"), fields });
    } finally {
      setSaving(false);
    }
  }
  const input = (key: Field, label: string, type = "text") => {
    const error = touched[key] ? errors[key] : undefined;
    return (
      <label htmlFor={key}>
        {label}
        <input
          ref={(node) => {
            refs.current[key] = node;
          }}
          id={key}
          type={type}
          min={type === "number" ? "0" : undefined}
          step={
            type === "number"
              ? key === "weight"
                ? "0.001"
                : "0.01"
              : undefined
          }
          value={form[key]}
          onChange={(e) => change(key, e.target.value)}
          onBlur={() => blur(key)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${key}-error` : undefined}
          className={error ? "field-invalid" : undefined}
        />
        {error && (
          <span id={`${key}-error`} className="field-error">
            {error}
          </span>
        )}
      </label>
    );
  };
  if (loadingProduct) return <main className="page">Carregando cadastro...</main>;
  if (loadError) return <main className="page"><p className="form-error">{loadError}</p><Link to="/products">Voltar aos produtos</Link></main>;
  return (
    <main className="page">
      <div className="page-title">
        <div>
          <h1>{id ? (isKit ? "Editar kit" : "Editar produto") : (isKit ? "Novo kit" : "Novo produto")}</h1>
          <p className="muted">
            Preencha os dados comerciais, fiscais e de estoque mínimo.
          </p>
        </div>
      </div>
      <form className="product-form" noValidate onSubmit={submit}>
        <fieldset>
          <legend>Informações gerais</legend>
          {input("sku", "SKU *")}
          {input("name", "Nome *")}
          <label>
            Descrição
            <textarea
              value={form.description}
              onChange={(e) => change("description", e.target.value)}
            />
          </label>
          {input("barcode", "Código de barras")}
          <label>
            Categoria
            <select
              value={form.categoryId}
              onChange={(e) => change("categoryId", e.target.value)}
            >
              <option value="">Sem categoria</option>
              {categories
                .filter((c) => c.isActive)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
          {isKit ? <p className="muted">Tipo: Kit. O estoque será calculado pelos componentes.</p> : <label>
            Unidade *
            <select
              ref={(node) => {
                refs.current.unitOfMeasure = node;
              }}
              value={form.unitOfMeasure}
              onChange={(e) => change("unitOfMeasure", e.target.value)}
              onBlur={() => blur("unitOfMeasure")}
              aria-invalid={Boolean(
                touched.unitOfMeasure && errors.unitOfMeasure,
              )}
            >
              {[
                "UN",
                "KG",
                "G",
                "L",
                "ML",
                "M",
                "CM",
                "M2",
                "M3",
                "CX",
                "PCT",
                "PAR",
              ].map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>}
        </fieldset>
        {isKit && !id && <fieldset>
          <legend>Composição do kit *</legend>
          <p className="muted">Escolha os produtos e a quantidade de cada um por kit.</p>
          <label>Buscar produto
            <input value={componentSearch} onChange={(e) => setComponentSearch(e.target.value)} placeholder="SKU ou nome" />
          </label>
          <div className="kit-component-fields">
            <label>Produto
              <select value={selectedComponent} onChange={(e) => setSelectedComponent(e.target.value)}>
                <option value="">Selecione um produto</option>
                {componentOptions.filter((p) => !components.some((c) => c.product.id === p.id)).map((p) =>
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </label>
            <label>Quantidade por kit
              <input type="number" min="1" step="1" value={componentQuantity} onChange={(e) => setComponentQuantity(e.target.value)} />
            </label>
            <button type="button" className="secondary" onClick={() => {
              const product = componentOptions.find((p) => p.id === selectedComponent);
              const quantity = Number(componentQuantity);
              if (!product || !Number.isSafeInteger(quantity) || quantity <= 0) {
                setComponentError("Selecione um produto e informe uma quantidade inteira positiva.");
                return;
              }
              setComponents((items) => [...items, { product, quantity: componentQuantity }]);
              setSelectedComponent("");
              setComponentQuantity("1");
              setComponentError("");
            }}>Adicionar componente</button>
          </div>
          {components.length > 0 && <ul className="kit-selected-components">{components.map(({ product, quantity }) =>
            <li key={product.id}>{product.sku} — {product.name} · {quantity} <button type="button" onClick={() => setComponents((items) => items.filter((item) => item.product.id !== product.id))}>Remover</button></li>)}</ul>}
          {componentError && <p className="form-error" role="alert">{componentError}</p>}
        </fieldset>}
        <fieldset>
          <legend>Preços</legend>
          {input("purchasePrice", "Preço de Compra", "number")}
          {input("costPrice", "Preço de Custo", "number")}
          <p className="muted">Compra: valor pago ao fornecedor por unidade.</p>
          <p className="muted">
            Custo: valor total por unidade, incluindo compra e despesas
            adicionais. Informe manualmente.
          </p>
        </fieldset>
        <fieldset>
          <legend>Informações fiscais básicas (legado)</legend>
          {id && (
            <p>
              O perfil fiscal versionado é administrado na seção Fiscal abaixo.
              Estes campos preservam o cadastro original.
            </p>
          )}
          {input("ncm", "NCM (8 dígitos)")}
          {input("cest", "CEST (7 dígitos)")}
          <label>
            Origem
            <select
              value={form.merchandiseOrigin}
              onChange={(e) => change("merchandiseOrigin", e.target.value)}
            >
              <option value="">Não informada</option>
              {merchandiseOriginOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>Peso e dimensões</legend>
          {input("weight", "Peso (kg)", "number")}
          {input("height", "Altura (cm)", "number")}
          {input("width", "Largura (cm)", "number")}
          {input("length", "Comprimento (cm)", "number")}
        </fieldset>
        <fieldset>{input("minimumStock", "Estoque mínimo", "number")}</fieldset>
        <fieldset>
          <legend>Imagens</legend>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
          <div className="previews">
            {files.map((f) => (
              <span key={f.name}>{f.name}</span>
            ))}
          </div>
        </fieldset>
        {summary && (
          <p className="form-error" role="alert">
            {summary}
          </p>
        )}
        {uploadWarning && <p className="notice">{uploadWarning}</p>}
        <div className="form-actions">
          <button
            type="submit"
            className="product-save-button"
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <Link to="/products">Cancelar</Link>
        </div>
      </form>
      {id && <FiscalProductEditor productId={id} />}
      {id && isKit && <BundleEditor key={id} productId={id} />}
      <ErrorDialog
        open={Boolean(dialog)}
        title={
          id
            ? `Não foi possível atualizar o ${isKit ? "kit" : "produto"}`
            : `Não foi possível cadastrar o ${isKit ? "kit" : "produto"}`
        }
        message={dialog?.message ?? ""}
        fieldErrors={dialog?.fields}
        onClose={closeDialog}
      />
    </main>
  );
}
