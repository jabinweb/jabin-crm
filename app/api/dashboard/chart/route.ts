import { NextRequest, NextResponse } from "next/server";
import { ensureFeatureEnabled } from '@/lib/feature-modules';
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveCompanyContextFromRequest } from "@/lib/auth/company-membership";
import { handleRouteError } from "@/lib/api/tenant-response";

/**
 * Back-compat endpoint used by `components/dashboard/leads-chart.tsx`.
 * Returns monthly lead counts for the last 7 months.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // A user can belong to several workspaces — count only this one's leads
    const { companyId } = await resolveCompanyContextFromRequest(session, request);
    // Leads chart: Leads module on the plan
    await ensureFeatureEnabled(session.user.id, 'LEADS', companyId);

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const chartData: Array<{ name: string; leads: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const monthIndex = (currentMonth - i + 12) % 12;
      const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;

      const startDate = new Date(year, monthIndex, 1);
      const endDate = new Date(year, monthIndex + 1, 0, 23, 59, 59);

      const leadsCount = await prisma.lead.count({
        where: {
          userId: session.user.id,
          companyId,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
      });

      chartData.push({ name: months[monthIndex], leads: leadsCount });
    }

    return NextResponse.json(chartData);
  } catch (error) {
    if (error instanceof Error && (error.name === "TenantError" || "statusCode" in error)) return handleRouteError(error);
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

