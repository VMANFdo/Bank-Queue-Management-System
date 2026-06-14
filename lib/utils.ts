import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility to merge Tailwind CSS class names safely.
 * Combines clsx (conditional class logic) with tailwind-merge (conflict resolution).
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", className)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number of minutes into a human-readable string.
 * e.g. 90 → "1h 30m", 45 → "45 min"
 */
export function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Mask a NIC number for display — shows first 4 and last 2 chars only.
 * e.g. "985623456V" → "9856••••6V"
 */
export function maskNic(nic: string): string {
  if (nic.length <= 6) return "••••••";
  const start = nic.slice(0, 4);
  const end = nic.slice(-2);
  const masked = "•".repeat(nic.length - 6);
  return `${start}${masked}${end}`;
}

/**
 * Validate a Sri Lankan NIC number.
 * Accepts: 9-digit + V/X (old format) or 12-digit numeric (new format)
 */
export function isValidNic(nic: string): boolean {
  // Old format: 9 digits + V or X
  const oldFormat = /^\d{9}[VXvx]$/;
  // New format: 12 digits
  const newFormat = /^\d{12}$/;
  return oldFormat.test(nic) || newFormat.test(nic);
}

/**
 * Format a phone number for display.
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
}

/**
 * Generate a random booking code (6 uppercase alphanumeric characters).
 */
export function generateBookingCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
