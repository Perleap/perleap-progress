import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PAGE_MARGIN_MM = 10;
export const PDF_DOC_WIDTH_PX = 860;
export const BLOCK_GAP_MM = 3;
export const CAPTURE_PADDING_PX = 2;
export const MIN_REMAINING_SPACE_MM = 40;

export function contentAreaMm(): { width: number; height: number } {
  return {
    width: A4_WIDTH_MM - PAGE_MARGIN_MM * 2,
    height: A4_HEIGHT_MM - PAGE_MARGIN_MM * 2,
  };
}

/** Fit block width to page content area; preserve full height for slicing. */
export function fitBlockWidthMm(
  canvasWidth: number,
  maxWidthMm: number,
): { widthMm: number; xMm: number } {
  if (canvasWidth <= 0) {
    return { widthMm: maxWidthMm, xMm: PAGE_MARGIN_MM };
  }

  const widthMm = maxWidthMm;
  const xMm = PAGE_MARGIN_MM;
  return { widthMm, xMm };
}

/** Map canvas pixel height to mm at a given output width. */
export function blockHeightMm(
  canvasHeight: number,
  canvasWidth: number,
  widthMm: number,
): number {
  if (canvasWidth <= 0 || canvasHeight <= 0) return 0;
  return (canvasHeight / canvasWidth) * widthMm;
}

/** Scale block dimensions to fit within page content area while preserving aspect ratio. */
export function scaleToFitPageMm(
  canvasWidth: number,
  canvasHeight: number,
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number; xMm: number } {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return { widthMm: maxWidthMm, heightMm: maxHeightMm, xMm: PAGE_MARGIN_MM };
  }

  let widthMm = maxWidthMm;
  let heightMm = (canvasHeight / canvasWidth) * widthMm;

  if (heightMm > maxHeightMm) {
    const scale = maxHeightMm / heightMm;
    widthMm *= scale;
    heightMm = maxHeightMm;
  }

  const xMm = PAGE_MARGIN_MM + (maxWidthMm - widthMm) / 2;
  return { widthMm, heightMm, xMm };
}

export type VerticalSlicePlan = {
  sourceY: number;
  sliceHeightPx: number;
  heightMm: number;
};

/** Split a tall canvas into page-height slices at full content width. */
export function computeVerticalSlices(
  canvasHeight: number,
  canvasWidth: number,
  widthMm: number,
  maxSliceHeightMm: number,
): VerticalSlicePlan[] {
  if (canvasWidth <= 0 || canvasHeight <= 0 || maxSliceHeightMm <= 0) {
    return [];
  }

  const maxSliceHeightPx = (maxSliceHeightMm / widthMm) * canvasWidth;
  const slices: VerticalSlicePlan[] = [];
  let sourceY = 0;

  while (sourceY < canvasHeight) {
    const sliceHeightPx = Math.min(maxSliceHeightPx, canvasHeight - sourceY);
    const heightMm = (sliceHeightPx / canvasWidth) * widthMm;
    slices.push({ sourceY, sliceHeightPx, heightMm });
    sourceY += sliceHeightPx;
  }

  return slices;
}

/** @deprecated Use fitBlockWidthMm + blockHeightMm + computeVerticalSlices. Kept for tests. */
export function fitBlockDimensionsMm(
  canvasWidth: number,
  canvasHeight: number,
  maxWidthMm: number,
  maxHeightMm: number,
): { widthMm: number; heightMm: number; xMm: number } {
  return scaleToFitPageMm(canvasWidth, canvasHeight, maxWidthMm, maxHeightMm);
}

/** Whether the next block needs a new page before placement. */
export function needsNewPage(
  currentYMm: number,
  blockHeightMm: number,
  marginMm: number,
  contentHeightMm: number,
): boolean {
  const pageBottom = marginMm + contentHeightMm;
  return currentYMm + blockHeightMm > pageBottom && currentYMm > marginMm;
}

function remainingSpaceMm(currentY: number, contentHeight: number): number {
  return PAGE_MARGIN_MM + contentHeight - currentY;
}

function createSliceCanvas(
  source: HTMLCanvasElement,
  sourceY: number,
  sliceHeightPx: number,
): HTMLCanvasElement {
  const slice = document.createElement('canvas');
  slice.width = source.width;
  slice.height = sliceHeightPx;
  const ctx = slice.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(
    source,
    0,
    sourceY,
    source.width,
    sliceHeightPx,
    0,
    0,
    source.width,
    sliceHeightPx,
  );
  return slice;
}

type PdfLayoutState = {
  pdf: jsPDF;
  currentY: number;
  contentHeight: number;
  contentWidth: number;
};

function ensureSpace(state: PdfLayoutState, requiredHeightMm: number): void {
  if (needsNewPage(state.currentY, requiredHeightMm, PAGE_MARGIN_MM, state.contentHeight)) {
    state.pdf.addPage();
    state.currentY = PAGE_MARGIN_MM;
  }
}

function ensureNewPageIfLowSpace(state: PdfLayoutState, minRemainingMm: number): void {
  if (state.currentY > PAGE_MARGIN_MM && remainingSpaceMm(state.currentY, state.contentHeight) < minRemainingMm) {
    state.pdf.addPage();
    state.currentY = PAGE_MARGIN_MM;
  }
}

function addCanvasFitPageToPdf(state: PdfLayoutState, canvas: HTMLCanvasElement): void {
  ensureNewPageIfLowSpace(state, MIN_REMAINING_SPACE_MM);

  const { widthMm, heightMm, xMm } = scaleToFitPageMm(
    canvas.width,
    canvas.height,
    state.contentWidth,
    state.contentHeight,
  );

  ensureSpace(state, heightMm);

  const imgData = canvas.toDataURL('image/png');
  state.pdf.addImage(imgData, 'PNG', xMm, state.currentY, widthMm, heightMm);
  state.currentY += heightMm + BLOCK_GAP_MM;

  if (state.currentY > PAGE_MARGIN_MM + state.contentHeight) {
    state.pdf.addPage();
    state.currentY = PAGE_MARGIN_MM;
  }
}

function addCanvasSlicesToPdf(state: PdfLayoutState, canvas: HTMLCanvasElement): void {
  const { widthMm, xMm } = fitBlockWidthMm(canvas.width, state.contentWidth);
  const slices = computeVerticalSlices(
    canvas.height,
    canvas.width,
    widthMm,
    state.contentHeight,
  );

  for (const slice of slices) {
    ensureSpace(state, slice.heightMm);

    const sliceCanvas = createSliceCanvas(canvas, slice.sourceY, slice.sliceHeightPx);
    const imgData = sliceCanvas.toDataURL('image/png');
    state.pdf.addImage(imgData, 'PNG', xMm, state.currentY, widthMm, slice.heightMm);
    state.currentY += slice.heightMm + BLOCK_GAP_MM;

    if (state.currentY > PAGE_MARGIN_MM + state.contentHeight) {
      state.pdf.addPage();
      state.currentY = PAGE_MARGIN_MM;
    }
  }
}

function prepareClonedPdfStyles(clonedDoc: Document): void {
  const content = clonedDoc.getElementById('lesson-brief-content');
  if (content) {
    content.style.maxWidth = `${PDF_DOC_WIDTH_PX}px`;
    content.style.background = '#fff';
  }

  clonedDoc.querySelectorAll<HTMLElement>('.lesson-brief-student-card').forEach((el) => {
    el.style.border = '2px solid #94a3b8';
    el.style.boxShadow = 'none';
  });

  clonedDoc.querySelectorAll<HTMLElement>('.lesson-brief-student-card .recharts-responsive-container').forEach((el) => {
    el.style.height = '220px';
    el.style.margin = '0 auto';
  });

  clonedDoc.querySelectorAll<HTMLElement>('.lesson-brief-radar-chart .max-w-md').forEach((el) => {
    el.style.maxWidth = '28rem';
    el.style.marginLeft = 'auto';
    el.style.marginRight = 'auto';
  });
}

function prepareClonedPilotReportStyles(clonedDoc: Document): void {
  clonedDoc.querySelectorAll<HTMLElement>('.appendix-card').forEach((el) => {
    el.style.border = '1px solid #B8CFE8';
    el.style.boxSizing = 'border-box';
  });

  clonedDoc.querySelectorAll<HTMLElement>('.appendix-summary-col-strength').forEach((el) => {
    el.style.border = '1px solid #B5E0C6';
  });
  clonedDoc.querySelectorAll<HTMLElement>('.appendix-summary-col-risk').forEach((el) => {
    el.style.border = '1px solid #ECB8B8';
  });
  clonedDoc.querySelectorAll<HTMLElement>('.appendix-summary-col-action').forEach((el) => {
    el.style.border = '1px solid #B8CFE8';
  });

  clonedDoc.querySelectorAll<HTMLElement>('.card-badge').forEach((el) => {
    el.style.display = 'inline-grid';
    el.style.placeItems = 'center';
    el.style.justifyItems = 'center';
    el.style.textAlign = 'center';
    el.style.direction = 'ltr';
    el.style.boxShadow = 'none';
  });
  clonedDoc.querySelectorAll<HTMLElement>('.card-badges').forEach((el) => {
    el.style.direction = 'ltr';
  });
}

function prepareClonedBlock(clonedBlock: HTMLElement, clonedDoc?: Document): void {
  clonedBlock.style.overflow = 'visible';

  let parent = clonedBlock.parentElement;
  while (parent) {
    parent.style.overflow = 'visible';
    if (parent.id === 'lesson-brief-content') break;
    parent = parent.parentElement;
  }

  const pad = CAPTURE_PADDING_PX;
  const currentPad = parseFloat(getComputedStyle(clonedBlock).paddingTop) || 0;
  clonedBlock.style.paddingTop = `${currentPad + pad}px`;
  clonedBlock.style.paddingBottom = `${pad}px`;

  clonedBlock.querySelectorAll<HTMLElement>('*').forEach((el) => {
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
  });

  if (clonedDoc) {
    prepareClonedPdfStyles(clonedDoc);
    prepareClonedPilotReportStyles(clonedDoc);
  }
}

async function waitForLayout(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function captureBlock(
  block: HTMLElement,
  windowRef?: Window,
): Promise<HTMLCanvasElement> {
  const captureWindow = windowRef ?? window;
  const scrollX = captureWindow.scrollX;
  const scrollY = captureWindow.scrollY;

  return html2canvas(block, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
    window: windowRef,
    scrollX: -scrollX,
    scrollY: -scrollY,
    onclone: (clonedDoc, clonedBlock) => {
      prepareClonedBlock(clonedBlock, clonedDoc);
    },
  });
}

function collectPdfBlocks(root: Element): HTMLElement[] {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.pdf-block'));
  return blocks.filter((block) => !block.closest('.no-print'));
}

function blockFitsOnePage(block: HTMLElement): boolean {
  return block.dataset.pdfFitPage === 'true';
}

async function waitForIframeLayout(iframe: HTMLIFrameElement): Promise<void> {
  const doc = iframe.contentDocument;
  if (!doc) return;

  const externalScripts = Array.from(doc.querySelectorAll<HTMLScriptElement>('script[src]'));
  if (externalScripts.length > 0) {
    await Promise.all(
      externalScripts.map(
        (script) =>
          new Promise<void>((resolve) => {
            if (script.dataset.loaded === 'true') {
              resolve();
              return;
            }
            script.addEventListener('load', () => resolve(), { once: true });
            script.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    );
  }

  await waitForLayout();
}

function loadHtmlInIframe(html: string): Promise<HTMLIFrameElement> {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.left = '-9999px';
      iframe.style.top = '0';
      iframe.style.width = `${PDF_DOC_WIDTH_PX}px`;
      iframe.style.height = '10000px';
      iframe.style.border = 'none';
      iframe.setAttribute('aria-hidden', 'true');

      document.body.appendChild(iframe);
      const doc = iframe.contentDocument;
      if (!doc) {
        iframe.remove();
        reject(new Error('PDF iframe document unavailable'));
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      resolve(iframe);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

async function exportBlocksToPdf(
  blocks: HTMLElement[],
  filename: string,
  captureWindow?: Window,
): Promise<void> {
  if (blocks.length === 0) throw new Error('No PDF blocks found');

  const { width: contentWidth, height: contentHeight } = contentAreaMm();
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const state: PdfLayoutState = {
    pdf,
    currentY: PAGE_MARGIN_MM,
    contentHeight,
    contentWidth,
  };

  for (const block of blocks) {
    const canvas = await captureBlock(block, captureWindow);
    if (blockFitsOnePage(block)) {
      addCanvasFitPageToPdf(state, canvas);
    } else {
      addCanvasSlicesToPdf(state, canvas);
    }
  }

  pdf.save(filename);
}

export async function exportDomBlocksToPdf(rootSelector: string, filename: string): Promise<void> {
  const root = document.querySelector(rootSelector);
  if (!root) throw new Error(`PDF root not found: ${rootSelector}`);

  const savedScrollX = window.scrollX;
  const savedScrollY = window.scrollY;

  try {
    const blocks = collectPdfBlocks(root);
    await exportBlocksToPdf(blocks, filename);
  } finally {
    window.scrollTo(savedScrollX, savedScrollY);
  }
}

export async function exportHtmlBlocksToPdf(html: string, filename: string): Promise<void> {
  const iframe = await loadHtmlInIframe(html);

  try {
    await waitForIframeLayout(iframe);

    const doc = iframe.contentDocument;
    if (!doc) throw new Error('PDF iframe document unavailable');

    const blocks = collectPdfBlocks(doc.body);
    await exportBlocksToPdf(blocks, filename, iframe.contentWindow ?? undefined);
  } finally {
    iframe.remove();
  }
}
