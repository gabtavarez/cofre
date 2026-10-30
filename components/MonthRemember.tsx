"use client";

import { useEffect } from "react";
import { setSelectedMonth } from "@/lib/monthStore";

export function MonthRemember({ month }: { month: string }) {
  useEffect(() => {
    setSelectedMonth(month);
  }, [month]);
  return null;
}
