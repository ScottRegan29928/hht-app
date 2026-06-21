import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export function weekNumberToDateRange(weekNumber: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  const jan1 = new Date(y, 0, 1);
  const startDay = (weekNumber - 1) * 7;
  const start = new Date(jan1.getTime() + startDay * 86400000);
  const end = new Date(start.getTime() + 6 * 86400000);
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}
