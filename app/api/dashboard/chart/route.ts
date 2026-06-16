import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * Back-compat endpoint used by `components/dashboard/leads-chart.tsx`.
 * Returns monthly lead counts for the last 7 months.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("Error fetching chart data:", error);
    return NextResponse.json(
      { error: "Failed to fetch chart data" },
      { status: 500 }
    );
  }
}

