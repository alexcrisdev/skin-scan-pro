import { getIdToken } from "@/lib/auth";
import { resolveAnalysisImageUrl } from "@/lib/analysis-images";
import { getLesionName } from "@/lib/lesion-names";
import { jsPDF } from "jspdf";

type AnalysisPdfRecord = {
  id: string;
  image_url: string | null;
  confidence: number;
  analyzed_at: string | null;
  created_at: string | null;
  ai_interpretation: string | null;
  prediction_details: Record<string, number> | null;
  lesion_types: {
    name: string;
    description: string;
  } | null;
};

type PdfExportOptions = {
  title: string;
  subtitle: string;
  userName: string;
  analyses: AnalysisPdfRecord[];
  fileName: string;
};

type Color = [number, number, number];

const PAGE_MARGIN = 14;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const FOOTER_TOP = 279;
const LINE_HEIGHT = 4.9;

const COLORS = {
  primary: [37, 99, 235] as Color,
  primarySoft: [239, 246, 255] as Color,
  accent: [16, 185, 129] as Color,
  accentSoft: [236, 253, 245] as Color,
  danger: [220, 38, 38] as Color,
  dangerSoft: [254, 242, 242] as Color,
  warning: [245, 158, 11] as Color,
  warningSoft: [255, 251, 235] as Color,
  neutral: [71, 85, 105] as Color,
  muted: [148, 163, 184] as Color,
  text: [15, 23, 42] as Color,
  border: [226, 232, 240] as Color,
  white: [255, 255, 255] as Color,
  background: [248, 250, 252] as Color,
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function shortId(id: string) {
  return `AN-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function classifyLesion(lesionCode: string | null | undefined) {
  const normalized = lesionCode?.toLowerCase();

  if (["mel", "bcc", "akiec"].includes(normalized ?? "")) {
    return { label: "Maligno", color: COLORS.danger, soft: COLORS.dangerSoft };
  }

  return { label: "Benigno", color: COLORS.accent, soft: COLORS.accentSoft };
}

function normalizeParagraph(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/^\s*\d+\.\s+/gm, "• ")
    .trim();
}

function extractSection(text: string, aliases: string[]) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const headingPattern = /^#{1,6}\s*(.+)$/;
  const labelPattern = /^(conclusiones?|recomendaciones?|resultados?|insights?)\s*:?(.*)$/i;

  let start = -1;
  let end = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index].trim();
    const headingMatch = rawLine.match(headingPattern);
    const labelMatch = rawLine.match(labelPattern);
    const headingText = (headingMatch?.[1] ?? labelMatch?.[1] ?? "").toLowerCase();

    if (start === -1 && aliases.some((alias) => headingText.includes(alias))) {
      start = labelMatch && labelMatch[2].trim() ? index : index + 1;
      continue;
    }

    if (start !== -1 && index > start && (headingMatch || labelMatch)) {
      end = index;
      break;
    }
  }

  if (start === -1) return null;

  return lines
    .slice(start, end)
    .join("\n")
    .replace(/^\s*[:\-•]\s*/gm, "")
    .trim();
}

function arrayBufferToDataUrl(arrayBuffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return `data:${contentType};base64,${btoa(binary)}`;
}

async function loadImageElement(url: string) {
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

async function fetchImageDataUrl(url: string | null, analysisId: string) {
  if (!url) return null;

  try {
    const response = await fetch(`/api/analyses/${analysisId}/image`, {
      headers: { authorization: `Bearer ${await getIdToken()}` },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = await response.arrayBuffer();
    return arrayBufferToDataUrl(bytes, contentType);
  } catch {
    return null;
  }
}

function detectImageFormat(dataUrl: string) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  if (dataUrl.startsWith("data:image/webp")) return "WEBP";
  return "JPEG";
}

function detectImageFormatFromUrl(url: string) {
  const cleanUrl = url.split("?")[0].toLowerCase();

  if (cleanUrl.endsWith(".png")) return "PNG";
  if (cleanUrl.endsWith(".webp")) return "WEBP";
  return "JPEG";
}

async function measureRemoteImage(url: string) {
  return await new Promise<{ width: number; height: number } | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
      });
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function fitContainedBox(
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number,
) {
  const widthScale = maxWidth / sourceWidth;
  const heightScale = maxHeight / sourceHeight;
  const scale = Math.min(widthScale, heightScale, 1);

  return {
    width: sourceWidth * scale,
    height: sourceHeight * scale,
  };
}

async function renderAnalysisImage(
  doc: jsPDF,
  analysis: AnalysisPdfRecord,
  y: number,
  maxHeight: number,
) {
  if (!analysis.image_url) {
    return y;
  }

  const containerHeight = maxHeight;
  doc.setFillColor(...COLORS.background);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, containerHeight, 5, 5, "FD");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8);
  doc.text("Imagen del análisis", PAGE_MARGIN + 4, y + 5);

  const imageData = await fetchImageDataUrl(analysis.image_url, analysis.id);

  const resolvedUrl = await resolveAnalysisImageUrl(analysis.image_url);
  const measured = resolvedUrl ? await measureRemoteImage(resolvedUrl) : null;

  if (!imageData) {
    doc.text("Imagen no disponible para incrustar.", PAGE_MARGIN + 4, y + 14);
    return y + containerHeight;
  }

  try {
    const intrinsicWidth = measured?.width ?? 1600;
    const intrinsicHeight = measured?.height ?? 900;
    const paddingX = 5;
    const paddingTop = 10;
    const paddingBottom = 6;
    const availableWidth = CONTENT_WIDTH - paddingX * 2;
    const availableHeight = containerHeight - paddingTop - paddingBottom;
    const fitted = fitContainedBox(
      intrinsicWidth,
      intrinsicHeight,
      availableWidth,
      availableHeight,
    );
    const x = PAGE_MARGIN + (CONTENT_WIDTH - fitted.width) / 2;
    const imageY = y + paddingTop + (availableHeight - fitted.height) / 2;

    doc.addImage(
      imageData,
      typeof imageData === "string"
        ? detectImageFormat(imageData)
        : detectImageFormatFromUrl(analysis.image_url),
      x,
      imageY,
      fitted.width,
      fitted.height,
      undefined,
      "FAST",
    );
  } catch {
    doc.text("No se pudo incrustar la imagen.", PAGE_MARGIN + 4, y + 14);
  }

  return y + containerHeight;
}

function drawImageSectionTitle(doc: jsPDF, y: number, title: string, subtitle: string) {
  doc.setFillColor(...COLORS.primarySoft);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 14, 5, 5, "FD");
  doc.setTextColor(...COLORS.primary);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(title, PAGE_MARGIN + 4, y + 5.2);
  doc.setTextColor(...COLORS.neutral);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(subtitle, PAGE_MARGIN + 4, y + 10);
  return y + 18;
}

function drawText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  options?: { size?: number; color?: Color; bold?: boolean; width?: number },
) {
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setFontSize(options?.size ?? 10);
  doc.setTextColor(...(options?.color ?? COLORS.text));

  if (!options?.width) {
    doc.text(text, x, y);
    return y + LINE_HEIGHT;
  }

  const lines = doc.splitTextToSize(text, options.width) as string[];
  doc.text(lines, x, y);
  return y + lines.length * LINE_HEIGHT;
}

function ensureSpace(doc: jsPDF, y: number, needed: number) {
  if (y + needed <= FOOTER_TOP) {
    return y;
  }

  doc.addPage();
  return PAGE_MARGIN;
}

function drawHeaderBand(
  doc: jsPDF,
  title: string,
  subtitle: string,
  userName: string,
  generatedAt: string,
) {
  doc.setFillColor(...COLORS.primarySoft);
  doc.roundedRect(PAGE_MARGIN, PAGE_MARGIN, CONTENT_WIDTH, 42, 6, 6, "F");

  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(PAGE_MARGIN + 5, PAGE_MARGIN + 6, 13, 13, 4, 4, "F");
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.8);
  doc.circle(PAGE_MARGIN + 11.5, PAGE_MARGIN + 12.8, 3.2, "S");
  doc.line(PAGE_MARGIN + 14.1, PAGE_MARGIN + 15.1, PAGE_MARGIN + 17.2, PAGE_MARGIN + 18.2);
  doc.line(PAGE_MARGIN + 10.2, PAGE_MARGIN + 12.8, PAGE_MARGIN + 12.8, PAGE_MARGIN + 12.8);
  doc.line(PAGE_MARGIN + 11.5, PAGE_MARGIN + 11.5, PAGE_MARGIN + 11.5, PAGE_MARGIN + 14.1);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, PAGE_MARGIN + 22, PAGE_MARGIN + 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.neutral);
  doc.text(subtitle, PAGE_MARGIN + 22, PAGE_MARGIN + 24);

  const metaRightX = PAGE_MARGIN + CONTENT_WIDTH - 2;
  doc.setFontSize(9);
  doc.text(`Usuario: ${userName}`, metaRightX, PAGE_MARGIN + 10, { align: "right" });
  doc.text(`Generado: ${generatedAt}`, metaRightX, PAGE_MARGIN + 16, { align: "right" });
}

function drawSummaryCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  color: Color,
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, w, h, 5, 5, "FD");
  doc.setFillColor(...color);
  doc.roundedRect(x + 4, y + 4, 5, h - 8, 2, 2, "F");
  doc.setTextColor(...COLORS.neutral);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 12, y + 10);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(value, x + 12, y + 21);
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setDrawColor(...COLORS.border);
  doc.line(PAGE_MARGIN, y, PAGE_MARGIN + CONTENT_WIDTH, y);
  y += 6;
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(title, PAGE_MARGIN, y);
  return y + 5;
}

function drawKeyValue(
  doc: jsPDF,
  x: number,
  y: number,
  label: string,
  value: string,
  width: number,
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, width, 16, 4, 4, "FD");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text(label, x + 4, y + 6);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  const lines = doc.splitTextToSize(value, width - 8) as string[];
  doc.text(lines, x + 4, y + 11);
}

function drawPredictionBars(doc: jsPDF, predictionDetails: Record<string, number>, y: number) {
  const entries = Object.entries(predictionDetails).sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    return drawText(doc, "No se registraron métricas de predicción.", PAGE_MARGIN, y, {
      size: 9,
      color: COLORS.muted,
    });
  }

  const maxWidth = CONTENT_WIDTH - 24;
  const maxValue = Math.max(...entries.map(([, value]) => value), 1);
  let currentY = y;

  for (const [label, value] of entries.slice(0, 6)) {
    currentY = ensureSpace(doc, currentY, 10);
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.text(getLesionName(label), PAGE_MARGIN, currentY);
    doc.text(`${value.toFixed(1)}%`, PAGE_MARGIN + CONTENT_WIDTH, currentY, { align: "right" });
    currentY += 2.5;

    doc.setFillColor(...COLORS.border);
    doc.roundedRect(PAGE_MARGIN, currentY, maxWidth, 4.4, 2, 2, "F");
    const filledWidth = Math.max(6, (value / maxValue) * maxWidth);
    const barColor =
      label.toLowerCase().includes("mel") || label.toLowerCase().includes("bcc")
        ? COLORS.danger
        : COLORS.primary;
    doc.setFillColor(...barColor);
    doc.roundedRect(PAGE_MARGIN, currentY, filledWidth, 4.4, 2, 2, "F");
    currentY += 8;
  }

  return currentY;
}

function drawMarkdownBlock(doc: jsPDF, text: string, y: number) {
  const normalized = normalizeParagraph(text);
  const paragraphs = normalized.split(/\n\s*\n/).filter(Boolean);
  let currentY = y;

  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, CONTENT_WIDTH) as string[];
    currentY = ensureSpace(doc, currentY, lines.length * LINE_HEIGHT + 2);
    doc.setTextColor(...COLORS.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(lines, PAGE_MARGIN, currentY);
    currentY += lines.length * LINE_HEIGHT + 2;
  }

  return currentY;
}

async function drawAnalysisCard(
  doc: jsPDF,
  analysis: AnalysisPdfRecord,
  currentIndex: number,
  total: number,
  y: number,
) {
  const title = getLesionName(analysis.lesion_types?.name, analysis.lesion_types?.description);
  const status = classifyLesion(analysis.lesion_types?.name);
  const dateText = formatDateTime(analysis.analyzed_at ?? analysis.created_at);

  y = ensureSpace(doc, y, 80);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 13, 5, 5, "FD");

  doc.setFillColor(...COLORS.primarySoft);
  doc.roundedRect(PAGE_MARGIN + 3, y + 2.8, 10, 7, 3, 3, "F");
  doc.setTextColor(...COLORS.primary);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(`${currentIndex}/${total}`, PAGE_MARGIN + 8, y + 7.5, { align: "center" });

  doc.setTextColor(...COLORS.text);
  doc.setFontSize(12);
  doc.text(title, PAGE_MARGIN + 16, y + 8.8);

  doc.setFontSize(8.2);
  doc.setTextColor(...COLORS.muted);
  doc.text(shortId(analysis.id), PAGE_MARGIN + CONTENT_WIDTH, y + 7.5, { align: "right" });

  y += 19;

  const smallBoxWidth = (CONTENT_WIDTH - 8) / 3;
  drawKeyValue(doc, PAGE_MARGIN, y, "Fecha", dateText, smallBoxWidth);
  drawKeyValue(doc, PAGE_MARGIN + smallBoxWidth + 4, y, "Estado", status.label, smallBoxWidth);
  drawKeyValue(
    doc,
    PAGE_MARGIN + (smallBoxWidth + 4) * 2,
    y,
    "Confianza",
    `${Number(analysis.confidence).toFixed(1)}%`,
    smallBoxWidth,
  );
  y += 20;

  if (analysis.image_url) {
    const imageHeight = total === 1 ? 116 : 80;
    y = ensureSpace(doc, y, imageHeight + 8);
    y = drawImageSectionTitle(
      doc,
      y,
      "Imagen del análisis",
      total === 1
        ? "Vista ampliada para el análisis individual"
        : "Vista compacta para el historial completo",
    );
    y = await renderAnalysisImage(doc, analysis, y, imageHeight);
    y += 8;
  }

  y = drawSectionTitle(doc, "Resumen del análisis", y);
  y = drawText(doc, `Resultado principal: ${title}`, PAGE_MARGIN, y, { size: 10, bold: true });
  y = drawText(doc, `Estado clasificado: ${status.label}`, PAGE_MARGIN, y, {
    size: 9.5,
    color: status.color,
  });
  y = drawText(doc, `Fecha de análisis: ${dateText}`, PAGE_MARGIN, y, { size: 9.5 });
  y += 2;

  y = drawSectionTitle(doc, "Métricas", y);
  y = drawPredictionBars(doc, analysis.prediction_details ?? {}, y);
  y += 2;

  const interpretation = analysis.ai_interpretation?.trim();
  if (interpretation) {
    const conclusions = extractSection(interpretation, ["conclusiones", "conclusion"]);
    const recommendations = extractSection(interpretation, ["recomendaciones", "recomendacion"]);

    y = drawSectionTitle(doc, "Detalle completo", y);
    y = drawMarkdownBlock(doc, interpretation, y);
    y += 2;

    if (conclusions) {
      y = drawSectionTitle(doc, "Conclusiones", y);
      y = drawMarkdownBlock(doc, conclusions, y);
      y += 2;
    }

    if (recommendations) {
      y = drawSectionTitle(doc, "Recomendaciones", y);
      y = drawMarkdownBlock(doc, recommendations, y);
      y += 2;
    }
  }

  y = ensureSpace(doc, y, 14);
  doc.setFillColor(...COLORS.warningSoft);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 12, 5, 5, "FD");
  doc.setTextColor(...COLORS.warning);
  doc.setFontSize(8);
  doc.text("Aviso", PAGE_MARGIN + 4, y + 4.5);
  doc.setTextColor(...COLORS.neutral);
  doc.text(
    "Este documento es orientativo y no reemplaza una valoración médica profesional.",
    PAGE_MARGIN + 4,
    y + 8.4,
  );

  return y + 16;
}

function drawSimpleCard(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  title: string,
  value: string,
  accent: Color,
) {
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, width, height, 5, 5, "FD");
  doc.setFillColor(...accent);
  doc.roundedRect(x + 4, y + 4, 4, height - 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.setFont("helvetica", "normal");
  doc.text(title, x + 12, y + 10);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(value, x + 12, y + 18);
}

function drawSingleAnalysisCover(
  doc: jsPDF,
  analysis: AnalysisPdfRecord,
  userName: string,
  generatedAt: string,
) {
  const title = getLesionName(analysis.lesion_types?.name, analysis.lesion_types?.description);
  const status = classifyLesion(analysis.lesion_types?.name);
  const pageTop = 16;

  doc.setFillColor(...COLORS.background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  doc.setFillColor(...COLORS.primarySoft);
  doc.roundedRect(PAGE_MARGIN, pageTop, CONTENT_WIDTH, 34, 7, 7, "F");

  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(PAGE_MARGIN + 5, pageTop + 5, 12, 12, 4, 4, "F");
  doc.setDrawColor(...COLORS.white);
  doc.setLineWidth(0.8);
  doc.circle(PAGE_MARGIN + 11, pageTop + 11, 3, "S");
  doc.line(PAGE_MARGIN + 13.2, pageTop + 13.2, PAGE_MARGIN + 16, pageTop + 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(18);
  doc.text("Detalle del análisis", PAGE_MARGIN + 21, pageTop + 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.neutral);
  doc.text(title, PAGE_MARGIN + 21, pageTop + 21);
  doc.text(shortId(analysis.id), PAGE_MARGIN + CONTENT_WIDTH, pageTop + 13, { align: "right" });

  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(`Usuario: ${userName}`, PAGE_MARGIN, 58);
  doc.text(
    `Fecha: ${formatDateTime(analysis.analyzed_at ?? analysis.created_at)}`,
    PAGE_MARGIN,
    63,
  );
  doc.text(`Generado: ${generatedAt}`, PAGE_MARGIN, 68);

  const infoTop = 78;
  const cardWidth = (CONTENT_WIDTH - 8) / 3;
  drawSimpleCard(doc, PAGE_MARGIN, infoTop, cardWidth, 24, "Resultado", title, COLORS.primary);
  drawSimpleCard(
    doc,
    PAGE_MARGIN + cardWidth + 4,
    infoTop,
    cardWidth,
    24,
    "Estado",
    status.label,
    status.color,
  );
  drawSimpleCard(
    doc,
    PAGE_MARGIN + (cardWidth + 4) * 2,
    infoTop,
    cardWidth,
    24,
    "Confianza",
    `${Number(analysis.confidence).toFixed(1)}%`,
    COLORS.warning,
  );

  return infoTop + 30;
}

function drawDetailIntroSection(doc: jsPDF, analysis: AnalysisPdfRecord, y: number) {
  const status = classifyLesion(analysis.lesion_types?.name);
  const title = getLesionName(analysis.lesion_types?.name, analysis.lesion_types?.description);

  y = drawSectionTitle(doc, "Resumen visual", y);
  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 18, 5, 5, "FD");
  doc.setTextColor(...COLORS.neutral);
  doc.setFontSize(8);
  doc.text(`Lesión: ${title}`, PAGE_MARGIN + 4, y + 7);
  doc.text(`Estado: ${status.label}`, PAGE_MARGIN + 4, y + 12);
  doc.text(
    `Confianza: ${Number(analysis.confidence).toFixed(1)}%`,
    PAGE_MARGIN + CONTENT_WIDTH - 4,
    y + 12,
    { align: "right" },
  );
  return y + 24;
}

function drawStyledDetailSection(doc: jsPDF, analysis: AnalysisPdfRecord, y: number) {
  const interpretation = analysis.ai_interpretation?.trim();

  y = drawSectionTitle(doc, "Detalle completo", y);

  if (!interpretation) {
    doc.setFillColor(...COLORS.background);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 18, 5, 5, "FD");
    doc.setTextColor(...COLORS.muted);
    doc.setFontSize(9);
    doc.text(
      "No hay contenido de interpretación disponible para este análisis.",
      PAGE_MARGIN + 4,
      y + 10,
    );
    return y + 22;
  }

  const conclusions = extractSection(interpretation, ["conclusiones", "conclusion"]);
  const recommendations = extractSection(interpretation, ["recomendaciones", "recomendacion"]);

  doc.setFillColor(...COLORS.primarySoft);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 22, 5, 5, "FD");
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.neutral);
  doc.text("Interpretación IA", PAGE_MARGIN + 4, y + 7);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(
    titleCase(getLesionName(analysis.lesion_types?.name, analysis.lesion_types?.description)),
    PAGE_MARGIN + 4,
    y + 13,
  );
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(
    "Contenido interpretativo procesado para lectura clínica rápida.",
    PAGE_MARGIN + 4,
    y + 18,
  );
  y += 28;

  if (conclusions) {
    doc.setFillColor(...COLORS.accentSoft);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 14, 5, 5, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.accent);
    doc.setFont("helvetica", "bold");
    doc.text("Conclusiones", PAGE_MARGIN + 4, y + 5.5);
    y += 18;
    y = drawMarkdownBlock(doc, conclusions, y);
    y += 2;
  }

  if (recommendations) {
    doc.setFillColor(...COLORS.warningSoft);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 14, 5, 5, "FD");
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.warning);
    doc.setFont("helvetica", "bold");
    doc.text("Recomendaciones", PAGE_MARGIN + 4, y + 5.5);
    y += 18;
    y = drawMarkdownBlock(doc, recommendations, y);
    y += 2;
  }

  doc.setFillColor(...COLORS.white);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 16, 5, 5, "FD");
  doc.setTextColor(...COLORS.muted);
  doc.setFontSize(8.5);
  doc.text(
    "Detalle completo basado en el contenido almacenado en la base de datos.",
    PAGE_MARGIN + 4,
    y + 10,
  );
  return y + 22;
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function drawCover(
  doc: jsPDF,
  title: string,
  subtitle: string,
  userName: string,
  analyses: AnalysisPdfRecord[],
  generatedAt: string,
) {
  doc.setFillColor(...COLORS.background);
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "F");

  doc.setFillColor(...COLORS.primarySoft);
  doc.roundedRect(PAGE_MARGIN, 18, CONTENT_WIDTH, 78, 8, 8, "F");

  drawHeaderBand(doc, title, subtitle, userName, generatedAt);

  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    "Historial personal generado a partir de los registros reales almacenados en Supabase.",
    PAGE_MARGIN,
    108,
    { maxWidth: CONTENT_WIDTH },
  );

  const malignantCount = analyses.filter(
    (analysis) => classifyLesion(analysis.lesion_types?.name).label === "Maligno",
  ).length;
  const benignCount = analyses.filter(
    (analysis) => classifyLesion(analysis.lesion_types?.name).label === "Benigno",
  ).length;
  const averageConfidence = analyses.length
    ? analyses.reduce((sum, analysis) => sum + Number(analysis.confidence || 0), 0) /
      analyses.length
    : 0;

  drawSummaryCard(
    doc,
    PAGE_MARGIN,
    120,
    58,
    28,
    "Análisis",
    String(analyses.length),
    COLORS.primary,
  );
  drawSummaryCard(
    doc,
    PAGE_MARGIN + 62,
    120,
    58,
    28,
    "Benignos",
    String(benignCount),
    COLORS.accent,
  );
  drawSummaryCard(
    doc,
    PAGE_MARGIN + 124,
    120,
    58,
    28,
    "Malignos",
    String(malignantCount),
    COLORS.danger,
  );
  drawSummaryCard(
    doc,
    PAGE_MARGIN,
    154,
    58,
    28,
    "Confianza prom.",
    `${averageConfidence.toFixed(1)}%`,
    COLORS.warning,
  );

  const lastAnalysis = analyses[0];
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(PAGE_MARGIN, 190, CONTENT_WIDTH, 48, 6, 6, "FD");
  doc.setFontSize(10.5);
  doc.setTextColor(...COLORS.text);
  doc.setFont("helvetica", "bold");
  doc.text("Resumen general", PAGE_MARGIN + 4, 198);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.neutral);
  doc.text(`Usuario: ${userName}`, PAGE_MARGIN + 4, 206);
  doc.text(
    `Último análisis: ${lastAnalysis ? formatDateTime(lastAnalysis.analyzed_at ?? lastAnalysis.created_at) : "—"}`,
    PAGE_MARGIN + 4,
    212,
  );
  doc.text(`Generado el: ${generatedAt}`, PAGE_MARGIN + 4, 218);
  doc.text(`Registros incluidos: ${analyses.length}`, PAGE_MARGIN + 4, 224);
}

function addFooter(doc: jsPDF, generatedAt: string) {
  const totalPages = doc.getNumberOfPages();

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
    doc.setPage(pageNumber);
    doc.setDrawColor(...COLORS.border);
    doc.line(PAGE_MARGIN, 282, PAGE_MARGIN + CONTENT_WIDTH, 282);
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.muted);
    doc.text(`SkinScan · Generado ${generatedAt}`, PAGE_MARGIN, 288);
    doc.text(`Página ${pageNumber} de ${totalPages}`, PAGE_MARGIN + CONTENT_WIDTH, 288, {
      align: "right",
    });
  }
}

export async function downloadAnalysisPdf(options: PdfExportOptions) {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const generatedAt = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  drawCover(doc, options.title, options.subtitle, options.userName, options.analyses, generatedAt);

  for (let index = 0; index < options.analyses.length; index += 1) {
    doc.addPage();
    drawHeaderBand(doc, options.title, options.subtitle, options.userName, generatedAt);
    await drawAnalysisCard(doc, options.analyses[index], index + 1, options.analyses.length, 66);
  }

  addFooter(doc, generatedAt);
  doc.save(options.fileName);
}
