import { ChevronLeft, ChevronRight } from 'lucide-react';

export function paginate<T>(list: T[], page: number, perPage: number): T[] {
  if (perPage === 0) return list;
  const start = (page - 1) * perPage;
  return list.slice(start, start + perPage);
}

export function sortNewestFirst<T>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const ta = (a as Record<string, unknown>).createdAt ? new Date(String((a as Record<string, unknown>).createdAt)).getTime() : 0;
    const tb = (b as Record<string, unknown>).createdAt ? new Date(String((b as Record<string, unknown>).createdAt)).getTime() : 0;
    return tb - ta;
  });
}

export default function Pagination({
  total,
  page,
  perPage,
  onPage,
  onPerPage,
}: {
  total: number;
  page: number;
  perPage: number;
  onPage: (p: number) => void;
  onPerPage: (n: number) => void;
}) {
  const totalPages = perPage === 0 ? 1 : Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = perPage === 0 ? 1 : total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = perPage === 0 ? total : Math.min(safePage * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-bold text-foreground">{from}</span>–<span className="font-bold text-foreground">{to}</span> of{' '}
          <span className="font-bold text-foreground">{total}</span>
        </span>
        <select
          value={perPage}
          onChange={(e) => onPerPage(Number(e.target.value))}
          className="h-8 rounded-lg border border-border bg-input px-2 text-xs outline-none focus:border-primary"
          title="Records per page"
        >
          <option value={10}>10 / page</option>
          <option value={15}>15 / page</option>
          <option value={50}>50 / page</option>
          <option value={0}>All</option>
        </select>
      </div>

      {perPage > 0 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce<(number | 'gap')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('gap');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === 'gap' ? (
                <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPage(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${p === safePage ? 'bg-primary text-primary-foreground' : 'border border-border bg-card text-muted-foreground hover:text-primary'}`}
                >
                  {p}
                </button>
              )
            )}
          <button
            onClick={() => onPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-primary disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
