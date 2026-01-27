import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export type FileIconType = "image" | "pdf" | "spreadsheet" | "file";

export function getFileIcon(type: string): FileIconType {
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    type === "application/vnd.ms-excel" ||
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "spreadsheet";
  }
  return "file";
}

export function getFileTypeLabel(type: string): string {
  if (type.startsWith("image/")) return "Image";
  if (type === "application/pdf") return "PDF";
  if (type.includes("spreadsheet") || type.includes("excel")) return "Spreadsheet";
  return "File";
}

export async function shareFile(name: string, url: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: name,
        text: `Check out this file: ${name}`,
        url: url,
      });
      return true;
    } catch {
      // User cancelled or share failed
      return false;
    }
  }
  // Fallback: copy to clipboard
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(url);
    return true;
  }
  return false;
}
