import { useEffect, useRef } from "react";
export function ErrorDialog({
  open,
  title,
  message,
  fieldErrors,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose, open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-title"
        aria-describedby="error-message"
      >
        <h2 id="error-title">{title}</h2>
        <p id="error-message">{message}</p>
        {fieldErrors && (
          <ul>
            {Object.values(fieldErrors)
              .flat()
              .map((x, i) => (
                <li key={`${x}-${i}`}>{x}</li>
              ))}
          </ul>
        )}
        <div className="form-actions">
          <button ref={closeRef} onClick={onClose}>
            Fechar
          </button>
        </div>
      </section>
    </div>
  );
}
