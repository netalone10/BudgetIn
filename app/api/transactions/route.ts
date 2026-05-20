import { NextResponse } from "next/server";

// /api/transactions/ memang tidak punya handler — sub-routes (/manual,
// /calendar, dll.) yang dipakai. Handler eksplisit ini cegah Vercel default
// directory-listing behavior dan return 404 yang jelas.
const notFound = () =>
  NextResponse.json({ error: "Not found" }, { status: 404 });

export const GET = notFound;
export const POST = notFound;
export const PATCH = notFound;
export const PUT = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
