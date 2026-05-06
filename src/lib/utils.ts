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

export type FilePreviewKind = "image" | "pdf" | "spreadsheet";

function getFileExtension(name: string): string {
  const lastDot = name.lastIndexOf(".");
  return lastDot === -1 ? "" : name.slice(lastDot + 1).toLowerCase();
}

function isSpreadsheetFile(type: string, name?: string): boolean {
  const extension = name ? getFileExtension(name) : "";
  return (
    type.includes("spreadsheet") ||
    type.includes("excel") ||
    type === "application/vnd.ms-excel" ||
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "text/csv" ||
    ["csv", "xls", "xlsx", "xlsm"].includes(extension)
  );
}

function isPdfFile(type: string, name?: string): boolean {
  return type === "application/pdf" || (name ? getFileExtension(name) === "pdf" : false);
}

export function getFileIcon(type: string, name?: string): FileIconType {
  if (type.startsWith("image/")) return "image";
  if (isPdfFile(type, name)) return "pdf";
  if (isSpreadsheetFile(type, name)) return "spreadsheet";
  return "file";
}

export function getFileTypeLabel(type: string, name?: string): string {
  if (type.startsWith("image/")) return "Image";
  if (isPdfFile(type, name)) return "PDF";
  if (isSpreadsheetFile(type, name)) return "Spreadsheet";
  return "File";
}

export function getFilePreviewKind(type: string, name: string): FilePreviewKind | null {
  if (type.startsWith("image/")) return "image";
  if (isPdfFile(type, name)) return "pdf";
  if (isSpreadsheetFile(type, name)) return "spreadsheet";
  return null;
}

export function canPreviewFile(type: string, name: string): boolean {
  return getFilePreviewKind(type, name) !== null;
}

export function openFileInNewTab(url: string): void {
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function downloadFile(name: string, url: string): Promise<void> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    openFileInNewTab(url);
  }
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
