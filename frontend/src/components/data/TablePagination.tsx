export function TablePagination({
  page,
  totalPages,
  limit,
  onPage,
  onLimit,
}: {
  page: number;
  totalPages: number;
  limit: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}) {
  return (
    <div className="table-pagination">
      <label>
        Registros por página
        <select value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
          {[10, 20, 50, 100].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <span>
        Página {page} de {Math.max(totalPages, 1)}
      </span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Anterior
      </button>
      <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
        Próxima
      </button>
    </div>
  );
}
