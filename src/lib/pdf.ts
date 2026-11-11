const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const LINE_HEIGHT = 14.5;

function escapePdf(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

interface PdfLine {
  text: string;
  size: number;
  bold: boolean;
  color?: [number, number, number];
  gap?: number;
}

export function createPdf(input: {
  title: string;
  subtitle?: string;
  lines: string[];
  footer?: string;
}): Buffer {
  const content: PdfLine[] = [];
  content.push({ text: "BHUMI 3D", size: 19, bold: true, color: [0.078, 0.325, 0.176], gap: 6 });
  content.push({ text: input.title, size: 15, bold: true, color: [0.06, 0.09, 0.16], gap: 4 });
  if (input.subtitle) {
    content.push({ text: input.subtitle, size: 9, bold: false, color: [0.4, 0.45, 0.52], gap: 12 });
  }
  content.push({ text: "", size: 9, bold: false, gap: 2 });

  for (const raw of input.lines) {
    if (raw.startsWith("## ")) {
      content.push({ text: raw.slice(3), size: 12, bold: true, color: [0.078, 0.325, 0.176], gap: 6 });
      continue;
    }
    if (raw.startsWith("# ")) {
      content.push({ text: raw.slice(2), size: 16, bold: true, color: [0.06, 0.09, 0.16], gap: 8 });
      continue;
    }
    if (raw === "---") {
      content.push({ text: " ", size: 4, bold: false, gap: 10 });
      continue;
    }
    if (!raw) {
      content.push({ text: "", size: 9, bold: false, gap: 6 });
      continue;
    }
    for (const line of wrap(raw, 96)) {
      content.push({ text: line, size: 9.5, bold: false, gap: 0 });
    }
    content.push({ text: "", size: 9.5, bold: false, gap: 4 });
  }

  const usableHeight = PAGE_HEIGHT - MARGIN * 2 - 40;
  const pages: PdfLine[][] = [];
  let page: PdfLine[] = [];
  let height = 0;
  for (const line of content) {
    const h = line.gap || LINE_HEIGHT;
    if (height + h > usableHeight) {
      pages.push(page);
      page = [];
      height = 0;
    }
    page.push(line);
    height += h;
  }
  if (page.length) pages.push(page);

  const objects: string[] = [];
  const pageObjectNumbers: number[] = [];
  const firstPageObject = 5;
  pages.forEach((_, i) => pageObjectNumbers.push(firstPageObject + i * 2));

  const fontRegularObj = 3;
  const fontBoldObj = 4;
  const totalObjects = 4 + pages.length * 2;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((n) => `${n} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`;
  objects[fontRegularObj] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  objects[fontBoldObj] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

  pages.forEach((lines, index) => {
    const pageObj = pageObjectNumbers[index];
    const contentObj = pageObj + 1;
    let y = PAGE_HEIGHT - MARGIN;
    const streamParts: string[] = [];
    for (const line of lines) {
      if (line.text) {
        const [r, g, b] = line.color ?? [0.1, 0.13, 0.18];
        streamParts.push(
          `BT /${line.bold ? "F2" : "F1"} ${line.size} Tf ${r} ${g} ${b} rg 1 0 0 1 ${MARGIN} ${y.toFixed(
            2
          )} Tm (${escapePdf(line.text)}) Tj ET`
        );
      }
      y -= line.gap || LINE_HEIGHT;
    }
    streamParts.push(
      `BT /F1 7.5 Tf 0.45 0.5 0.55 rg 1 0 0 1 ${MARGIN} ${MARGIN / 2} Tm (${escapePdf(
        input.footer ?? "BHUMI 3D prototype · illustrative demo data · not a government-issued certificate"
      )}) Tj ET`
    );
    const stream = streamParts.join("\n");
    objects[pageObj] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Resources << /Font << /F1 ${fontRegularObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${contentObj} 0 R >>`;
    objects[contentObj] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i <= totalObjects; i++) {
    offsets[i] = Buffer.byteLength(pdf, "latin1");
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${totalObjects + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= totalObjects; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}
