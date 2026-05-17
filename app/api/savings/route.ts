import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { blockDemoResponse } from "@/lib/demo-account";
import { sanitizeErrorForProduction } from "@/lib/api-error";
import { withCacheHeaders, withETag, handleConditionalRequest } from "@/lib/api-helpers";
import { ROUTE_CACHE_PROFILES } from "@/lib/cache-headers";
import { normalizePaginationParams } from "@/lib/pagination";

// ── Exported for testability ──────────────────────────────────────────────────

export function validateGoal({
  name,
  targetAmount,
}: {
  name: string;
  targetAmount: number;
}): { valid: boolean; error?: string } {
  if (!name || !name.trim())
    return { valid: false, error: "Nama goal dan target amount wajib diisi" };
  if (!targetAmount || targetAmount <= 0)
    return { valid: false, error: "Nama goal dan target amount wajib diisi" };
  return { valid: true };
}

// ── GET — list all savings goals with contributions ───────────────────────────

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.userId;

  // Parse pagination params
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const { page: normalizedPage, limit: normalizedLimit, skip } = normalizePaginationParams({ page, limit });

  // Fetch goals and contributions in parallel
  const [goals, contributions] = await Promise.all([
    prisma.savingsGoal.findMany({ where: { userId } }),
    prisma.savingsContribution.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    }),
  ]);

  // Build goals with progress
  const goalsWithProgress = goals.map((goal) => {
    const goalContributions = contributions
      .filter((contribution) => contribution.goalId === goal.id)
      .map((contribution) => ({
        id: contribution.transactionId,
        date: contribution.date,
        amount: contribution.amount.toNumber(),
        note: contribution.note,
      }));
    const totalContributed = goalContributions.reduce((sum, contribution) => sum + contribution.amount, 0);

    return {
      id: goal.id,
      userId: goal.userId,
      name: goal.name,
      targetAmount: Number(goal.targetAmount),
      deadline: goal.deadline ? goal.deadline.toISOString() : null,
      createdAt: goal.createdAt.toISOString(),
      totalContributed,
      contributions: goalContributions,
    };
  });

  // Apply pagination
  const total = goalsWithProgress.length;
  const totalPages = Math.ceil(total / normalizedLimit);
  const paginatedGoals = goalsWithProgress.slice(skip, skip + normalizedLimit);

  const responseData = {
    goals: paginatedGoals,
    pagination: {
      page: normalizedPage,
      limit: normalizedLimit,
      total,
      totalPages,
    },
  };

  // Handle conditional request (ETag / 304)
  const conditionalResponse = handleConditionalRequest(req, responseData);
  if (conditionalResponse) return conditionalResponse;

  // Build response with cache headers and ETag
  const profile = ROUTE_CACHE_PROFILES["/api/savings"];
  let response = NextResponse.json(responseData);
  response = withCacheHeaders(response, profile);
  response = withETag(response, responseData);

  return response;
}

// ── POST — create a new savings goal ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const demoBlock = await blockDemoResponse(session);
  if (demoBlock) return demoBlock;
  if (!session?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, targetAmount, deadline } = body as {
    name: string;
    targetAmount: number;
    deadline?: string;
  };

  const validation = validateGoal({ name, targetAmount });
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const goal = await prisma.savingsGoal.create({
      data: {
        userId: session.userId,
        name: name.trim(),
        targetAmount,
        deadline: deadline ? new Date(deadline) : null,
      },
    });

    return NextResponse.json({
      goal: {
        id: goal.id,
        userId: goal.userId,
        name: goal.name,
        targetAmount: Number(goal.targetAmount),
        deadline: goal.deadline ? goal.deadline.toISOString() : null,
        createdAt: goal.createdAt.toISOString(),
      },
    });
  } catch (error) {
    const apiError = sanitizeErrorForProduction(error, "internal");
    return NextResponse.json(
      { error: apiError.error, code: apiError.code },
      { status: apiError.statusCode }
    );
  }
}
