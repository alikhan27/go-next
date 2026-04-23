import { Input } from "./ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { Button } from "./ui/button";
import { TableHead } from "./ui/table";
import { Search, ChevronLeft, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export function TableToolbar({
  query, onQueryChange, placeholder = "Search…",
  pageSize, onPageSizeChange, total, rightSlot, testidPrefix,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-5 py-3 bg-white">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={placeholder}
          className="pl-8 h-9 rounded-full border-stone-200 bg-[#F9F8F6]"
          data-testid={testidPrefix ? `${testidPrefix}-search` : undefined}
        />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.22em] text-stone-500" data-testid={testidPrefix ? `${testidPrefix}-total` : undefined}>
          {total} {total === 1 ? "row" : "rows"}
        </span>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-9 w-[120px] rounded-full border-stone-200 bg-[#F9F8F6]" data-testid={testidPrefix ? `${testidPrefix}-page-size` : undefined}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 / page</SelectItem>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>
        {rightSlot}
      </div>
    </div>
  );
}

export function SortableHead({ label, sortKey, sort, onToggle, className = "", children, ...rest }) {
  const active = sort && sort.key === sortKey;
  const dir = active ? sort.dir : null;
  return (
    <TableHead className={`cursor-pointer select-none hover:text-[#A86246] ${className}`} onClick={() => onToggle(sortKey)} {...rest}>
      <span className="inline-flex items-center gap-1">
        {children || label}
        {dir === "asc" ? (
          <ArrowUp className="h-3 w-3" />
        ) : dir === "desc" ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </TableHead>
  );
}

export function TablePagination({ page, totalPages, onPageChange, testidPrefix }) {
  const goto = (n) => onPageChange(Math.min(Math.max(1, n), totalPages));
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-stone-200 bg-white" data-testid={testidPrefix ? `${testidPrefix}-pagination` : undefined}>
      <p className="text-xs text-stone-500">
        Page <span className="font-medium text-stone-700">{page}</span> of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="rounded-full border-stone-200 h-8"
          onClick={() => goto(page - 1)} disabled={page <= 1}
          data-testid={testidPrefix ? `${testidPrefix}-prev` : undefined}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="rounded-full border-stone-200 h-8"
          onClick={() => goto(page + 1)} disabled={page >= totalPages}
          data-testid={testidPrefix ? `${testidPrefix}-next` : undefined}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
