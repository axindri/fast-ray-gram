export function computePages(total, limit) {
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeTotal = Math.max(0, Number(total) || 0);
  return Math.max(1, Math.ceil(safeTotal / safeLimit) || 1);
}

export function clampPage(page, pages) {
  const safePages = Math.max(1, Number(pages) || 1);
  const safePage = Math.max(1, Number(page) || 1);
  return Math.min(safePage, safePages);
}

export function normalizePaginated(data, fallback = {}) {
  if (Array.isArray(data)) {
    const limit = Math.max(data.length, 1);
    return {
      items: data,
      total: data.length,
      page: 1,
      limit,
      pages: 1,
    };
  }

  const limit = data?.limit ?? fallback.limit ?? 3;
  const total = data?.total ?? 0;
  const pages = data?.pages ?? computePages(total, limit);
  const page = clampPage(data?.page ?? fallback.page ?? 1, pages);

  return {
    items: data?.items ?? [],
    total,
    page,
    limit,
    pages,
  };
}

export function emptyPagination(limit = 3) {
  return { items: [], total: 0, page: 1, limit, pages: 1 };
}
