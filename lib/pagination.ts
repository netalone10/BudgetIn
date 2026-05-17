export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function normalizePaginationParams(params: PaginationParams): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginateArray<T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> {
  const { page, limit, skip } = normalizePaginationParams(params);
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const data = items.slice(skip, skip + limit);

  return { data, pagination: { page, limit, total, totalPages } };
}
