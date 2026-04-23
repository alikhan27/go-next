import { useMemo, useState, useEffect } from "react";

/**
 * Small table state helper: search → sort → paginate.
 * rows: source data
 * opts.searchKeys: array of keys to search across (string values)
 * opts.initialSort: { key, dir: "asc" | "desc" }
 * opts.pageSize: default page size (10)
 */
export function useTableControls(rows, opts = {}) {
  const {
    searchKeys = [],
    initialSort = null,
    pageSize: defaultPageSize = 10,
  } = opts;

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(initialSort); // { key, dir }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      searchKeys.some((k) => {
        const v = r?.[k];
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort || !sort.key) return filtered;
    const { key, dir } = sort;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a?.[key];
      const bv = b?.[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      if (typeof av === "boolean" || typeof bv === "boolean") {
        return (av === bv) ? 0 : (av ? -1 : 1);
      }
      return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
    });
    if (dir === "desc") arr.reverse();
    return arr;
  }, [filtered, sort]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [page, totalPages]);

  const visible = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page, pageSize]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
    setPage(1);
  };

  const setSearch = (v) => {
    setQuery(v);
    setPage(1);
  };

  return {
    visible,
    total,
    page,
    totalPages,
    pageSize,
    sort,
    query,
    setPage,
    setPageSize: (n) => { setPageSize(n); setPage(1); },
    setSearch,
    toggleSort,
  };
}
