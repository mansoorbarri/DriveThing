"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import {
  cn,
  downloadFile,
  formatFileSize,
  getFilePreviewKind,
  getFileTypeLabel,
  openFileInNewTab,
} from "~/lib/utils";

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: {
    name: string;
    url: string;
    type: string;
    size: number;
  };
}

interface SpreadsheetSheet {
  name: string;
  rows: string[][];
  columnCount: number;
}

interface PreviewFile {
  name: string;
  url: string;
  type: string;
  size: number;
}

const spreadsheetPreviewCache = new Map<string, Promise<SpreadsheetSheet[]>>();
const pdfPrefetchCache = new Set<string>();
const imageWarmCache = new Set<string>();
const xlsxModulePromise = import("xlsx");

function normalizeWorkbookRows(rows: unknown[][]): { rows: string[][]; columnCount: number } {
  const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const normalizedRows = rows.map((row) =>
    Array.from({ length: columnCount }, (_, index) => {
      const value = row[index];
      return value === null || value === undefined ? "" : String(value);
    })
  );

  return {
    rows: normalizedRows,
    columnCount,
  };
}

function getColumnLabel(index: number): string {
  let label = "";
  let current = index + 1;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

async function loadSpreadsheetPreview(fileUrl: string): Promise<SpreadsheetSheet[]> {
  const cached = spreadsheetPreviewCache.get(fileUrl);
  if (cached) {
    return cached;
  }

  const nextPromise = (async () => {
    const [{ read, utils }, response] = await Promise.all([
      xlsxModulePromise,
      fetch(fileUrl),
    ]);

    if (!response.ok) {
      throw new Error(`Unable to load spreadsheet (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const workbook = read(arrayBuffer, { type: "array" });

    return workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) {
        return {
          name: sheetName,
          rows: [],
          columnCount: 0,
        };
      }

      const rawRows = utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: true,
      }) as unknown[][];
      const { rows, columnCount } = normalizeWorkbookRows(rawRows);

      return {
        name: sheetName,
        rows,
        columnCount,
      };
    });
  })();

  spreadsheetPreviewCache.set(fileUrl, nextPromise);
  return nextPromise;
}

export function warmFilePreview(file: PreviewFile): void {
  const previewKind = getFilePreviewKind(file.type, file.name);

  if (previewKind === "spreadsheet") {
    void loadSpreadsheetPreview(file.url).catch(() => {
      spreadsheetPreviewCache.delete(file.url);
    });
    return;
  }

  if (previewKind === "image") {
    if (imageWarmCache.has(file.url)) {
      return;
    }

    imageWarmCache.add(file.url);
    const image = new window.Image();
    image.src = file.url;
    void image.decode?.().catch(() => undefined);
    return;
  }

  if (previewKind === "pdf") {
    if (pdfPrefetchCache.has(file.url)) {
      return;
    }

    pdfPrefetchCache.add(file.url);
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "document";
    link.href = file.url;
    document.head.appendChild(link);
  }
}

export function FilePreviewModal({
  isOpen,
  onClose,
  file,
}: FilePreviewModalProps) {
  const previewKind = useMemo(
    () => getFilePreviewKind(file.type, file.name),
    [file.name, file.type]
  );
  const [sheets, setSheets] = useState<SpreadsheetSheet[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isLoadingSpreadsheet, setIsLoadingSpreadsheet] = useState(false);
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(previewKind === "pdf");
  const [isImageLoading, setIsImageLoading] = useState(previewKind === "image");

  useEffect(() => {
    if (!isOpen || !previewKind) {
      return;
    }

    warmFilePreview(file);
  }, [file, isOpen, previewKind]);

  useEffect(() => {
    setIsPdfLoading(previewKind === "pdf");
    setIsImageLoading(previewKind === "image");
  }, [file.url, isOpen, previewKind]);

  useEffect(() => {
    if (!isOpen || previewKind !== "spreadsheet") {
      return;
    }

    let isCancelled = false;

    const loadWorkbook = async () => {
      setIsLoadingSpreadsheet(true);
      setSpreadsheetError(null);

      try {
        const nextSheets = await loadSpreadsheetPreview(file.url);

        if (!isCancelled) {
          setSheets(nextSheets);
          setActiveSheet(0);
        }
      } catch (error) {
        if (!isCancelled) {
          setSpreadsheetError(
            error instanceof Error ? error.message : "Unable to preview spreadsheet"
          );
          setSheets([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingSpreadsheet(false);
        }
      }
    };

    void loadWorkbook();

    return () => {
      isCancelled = true;
    };
  }, [file.url, isOpen, previewKind]);

  const currentSheet = sheets[activeSheet];
  const typeLabel = getFileTypeLabel(file.type, file.name);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={file.name}
      className="max-h-[92vh] max-w-6xl overflow-hidden p-0"
    >
      <div className="border-b border-zinc-800 bg-zinc-950/90 px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm text-zinc-500">
              {typeLabel} · {formatFileSize(file.size)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void downloadFile(file.name, file.url)}
            >
              Download
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => openFileInNewTab(file.url)}
            >
              Open original
            </Button>
          </div>
        </div>
      </div>

      <div className="h-[78vh] bg-[#09090b]">
        {previewKind === "pdf" && (
          <div className="relative h-full">
            {isPdfLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950 text-sm text-zinc-400">
                Loading PDF preview...
              </div>
            )}
            <iframe
              src={`${file.url}#toolbar=1&navpanes=0`}
              title={file.name}
              className="h-full w-full bg-white"
              onLoad={() => setIsPdfLoading(false)}
            />
          </div>
        )}

        {previewKind === "image" && (
          <div className="relative h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_38%),linear-gradient(180deg,#101012_0%,#09090b_100%)] p-6">
            <div className="relative h-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
              {isImageLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/80 text-sm text-zinc-400">
                  Loading image preview...
                </div>
              )}
              <Image
                src={file.url}
                alt={file.name}
                fill
                className="object-contain"
                sizes="100vw"
                onLoad={() => setIsImageLoading(false)}
              />
            </div>
          </div>
        )}

        {previewKind === "spreadsheet" && (
          <div className="flex h-full flex-col">
            <div className="border-b border-zinc-800 bg-zinc-950/80 px-3 py-2">
              <div className="flex flex-wrap gap-2">
                {sheets.map((sheet, index) => (
                  <button
                    key={sheet.name}
                    onClick={() => setActiveSheet(index)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      index === activeSheet
                        ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-200"
                        : "border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    )}
                  >
                    {sheet.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {isLoadingSpreadsheet && (
                <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                  Loading spreadsheet preview...
                </div>
              )}

              {!isLoadingSpreadsheet && spreadsheetError && (
                <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center px-6 text-center">
                  <p className="text-base font-medium text-zinc-100">
                    Spreadsheet preview unavailable
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">{spreadsheetError}</p>
                </div>
              )}

              {!isLoadingSpreadsheet && !spreadsheetError && currentSheet && (
                <div className="min-w-full p-4">
                  <div className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                    {currentSheet.rows.length} rows · {currentSheet.columnCount} columns
                  </div>

                  {currentSheet.columnCount === 0 ? (
                    <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center text-sm text-zinc-500">
                      This sheet is empty.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-zinc-900">
                            <th className="w-14 border-b border-r border-zinc-800 px-3 py-2 text-right text-xs font-medium text-zinc-500">
                              #
                            </th>
                            {Array.from({ length: currentSheet.columnCount }, (_, index) => (
                              <th
                                key={getColumnLabel(index)}
                                className="min-w-36 border-b border-zinc-800 px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.2em] text-zinc-500"
                              >
                                {getColumnLabel(index)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentSheet.rows.map((row, rowIndex) => (
                            <tr key={`${currentSheet.name}-${rowIndex}`} className="odd:bg-zinc-950 even:bg-zinc-900/60">
                              <td className="border-r border-t border-zinc-800 px-3 py-2 text-right text-xs text-zinc-500">
                                {rowIndex + 1}
                              </td>
                              {row.map((cell, cellIndex) => (
                                <td
                                  key={`${currentSheet.name}-${rowIndex}-${cellIndex}`}
                                  className="max-w-[24rem] border-t border-zinc-800 px-3 py-2 align-top text-zinc-200"
                                >
                                  <div className="whitespace-pre-wrap break-words">
                                    {cell || <span className="text-zinc-600"> </span>}
                                  </div>
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {!isLoadingSpreadsheet && !spreadsheetError && !currentSheet && (
                <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center px-6 text-center">
                  <p className="text-base font-medium text-zinc-100">
                    No sheets available
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    This spreadsheet did not expose any readable worksheet data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {!previewKind && (
          <div className="flex h-full items-center justify-center px-6 text-center text-zinc-500">
            Preview is not available for this file type.
          </div>
        )}
      </div>
    </Modal>
  );
}
