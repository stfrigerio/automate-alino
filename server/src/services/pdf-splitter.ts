import { PDFDocument } from "pdf-lib";
import { readFileSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { randomUUID } from "crypto";

export interface SplitResult {
  filePath: string;
  originalName: string;
  pages: number[]; // 1-based
}

/**
 * Split a PDF into multiple files based on page ranges.
 * @param sourcePath Path to the source PDF
 * @param pageRanges Array of arrays of 1-based page numbers, e.g. [[1,2], [3], [4,5]]
 * @param outputDir Directory to write the split PDFs
 */
export async function splitPdf(
  sourcePath: string,
  pageRanges: number[][],
  outputDir: string,
): Promise<SplitResult[]> {
  const sourceBytes = readFileSync(sourcePath);
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const totalPages = sourcePdf.getPageCount();
  const sourceBaseName = basename(sourcePath).replace(/\.pdf$/i, "");
  const results: SplitResult[] = [];

  for (let i = 0; i < pageRanges.length; i++) {
    const pages = pageRanges[i].filter((p) => p >= 1 && p <= totalPages);
    if (pages.length === 0) continue;

    const newPdf = await PDFDocument.create();
    const copiedPages = await newPdf.copyPages(
      sourcePdf,
      pages.map((p) => p - 1), // pdf-lib uses 0-based indices
    );
    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    const pdfBytes = await newPdf.save();
    const id = randomUUID();
    const outName = `${id}_${sourceBaseName}_part${i + 1}.pdf`;
    const outPath = join(outputDir, outName);
    writeFileSync(outPath, pdfBytes);
    results.push({
      filePath: outPath,
      originalName: `${sourceBaseName}_part${i + 1}.pdf`,
      pages,
    });
  }

  return results;
}
