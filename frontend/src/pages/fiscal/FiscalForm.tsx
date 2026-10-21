import { useState, type FormEvent } from "react";
import {
  type Field,
  toForm,
  toPayload,
  formatFiscalValue,
} from "./fiscal-model";
export function FiscalForm({
  fields,
  initial = {},
  onSave,
  onCancel,
  busy = false,
}: {
  fields: Field[];
  initial?: Record<string, unknown>;
  onSave: (v: Record<string, unknown>) => Promise<void>;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const [values, setValues] = useState(() => toForm(initial, fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localBusy, setLocalBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setLocalBusy(true);
    try {
      await onSave(toPayload(values, fields));
    } finally {
      setLocalBusy(false);
    }
  }
  return (
    <form className="fiscal-form" onSubmit={submit}>
      {Array.from(new Set(fields.map((f) => f.section))).map((section) => (
        <fieldset key={section}>
          <legend>{section}</legend>
          <div className="fiscal-grid">
            {fields
              .filter((f) => f.section === section)
              .map((f) => (
                <label key={f.key}>
                  {f.label}
                  {f.required ? " *" : ""}
                  {f.options ? (
                    <select
                      required={f.required}
                      value={String(values[f.key] ?? "")}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                    >
                      <option value="">Selecione</option>
                      {f.options.map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type || "text"}
                      required={f.required}
                      pattern={f.pattern}
                      checked={
                        f.type === "checkbox"
                          ? Boolean(values[f.key])
                          : undefined
                      }
                      value={
                        f.type === "checkbox"
                          ? undefined
                          : String(values[f.key] ?? "")
                      }
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [f.key]:
                            f.type === "checkbox"
                              ? e.target.checked
                              : e.target.value,
                        })
                      }
                      onBlur={(e) => {
                        if (f.type !== "checkbox")
                          setValues((old) => ({
                            ...old,
                            [f.key]: formatFiscalValue(f.key, e.target.value),
                          }));
                        const message = e.target.validationMessage;
                        setErrors((old) => ({ ...old, [f.key]: message }));
                        if (message)
                          e.target.setAttribute("aria-invalid", "true");
                        else e.target.removeAttribute("aria-invalid");
                      }}
                    />
                  )}
                  {f.hint && <small>{f.hint}</small>}
                  {errors[f.key] && (
                    <small role="alert" className="fiscal-field-error">
                      {errors[f.key]}
                    </small>
                  )}
                </label>
              ))}
          </div>
        </fieldset>
      ))}
      <div className="fiscal-actions">
        <button className="primary" disabled={busy || localBusy}>
          {localBusy ? "Salvando…" : "Salvar configuração"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
