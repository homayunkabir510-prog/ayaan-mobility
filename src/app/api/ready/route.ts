import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json(
      { status: "ready", checks: { database: "ok" } },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "not_ready", checks: { database: "unavailable" } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
