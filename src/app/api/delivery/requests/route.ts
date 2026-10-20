// Inside src/app/api/admin/delivery/requests/route.ts

export async function GET() {
  try {
    const { user, error } = await requireAdmin();
    if (error) return error;

    const requests = await db.deliveryCoverageRequest.findMany({
      select: {
        id: true,
        email: true,       // 👈 Make sure this is here
        notes: true,       // 👈 Make sure this is here
        status: true,
        requestCount: true,
        lastRequestedAt: true,
        region: { select: { name: true } },
        district: { select: { name: true } },
        locality: { select: { name: true } },
      },
      orderBy: { lastRequestedAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error: any) {
    console.error("🚨 Admin coverage requests GET error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch requests" }, { status: 500 });
  }
}