export interface TransactionQueryParams {
  userId: string;
  month: string; // YYYY-MM format
  accountId?: string;
  type?: string;
}

export interface TransactionQueryConfig {
  where: Record<string, unknown>;
  select: Record<string, boolean>;
  orderBy: Record<string, string>;
  take: number;
}

export const TRANSACTION_SELECT_FIELDS = {
  id: true,
  date: true,
  time: true,
  amount: true,
  category: true,
  note: true,
  type: true,
  accountId: true,
  transferId: true,
  isInitialBalance: true,
} as const;

export function buildTransactionQuery(
  params: TransactionQueryParams
): TransactionQueryConfig {
  const [year, monthNum] = params.month.split("-").map(Number);
  const startDate = `${params.month}-01`;
  // Calculate last day of month: day 0 of the next month gives the last day of the current month
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${params.month}-${String(lastDay).padStart(2, "0")}`;

  const where: Record<string, unknown> = {
    userId: params.userId,
    date: { gte: startDate, lte: endDate },
  };

  if (params.accountId) where.accountId = params.accountId;
  if (params.type) where.type = params.type;

  return {
    where,
    select: { ...TRANSACTION_SELECT_FIELDS },
    orderBy: { date: "desc" },
    take: 200,
  };
}
