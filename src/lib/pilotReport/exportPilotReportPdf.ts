import { exportHtmlBlocksToPdf } from '@/lib/exportHtmlBlocksToPdf';
import { buildPilotReportHtml } from './buildPilotReportHtml';
import type { PilotReportData } from './types';

export {
  A4_WIDTH_MM,
  A4_HEIGHT_MM,
  PAGE_MARGIN_MM,
  PDF_DOC_WIDTH_PX,
  BLOCK_GAP_MM,
  MIN_REMAINING_SPACE_MM,
  blockHeightMm,
  computeVerticalSlices,
  contentAreaMm,
  fitBlockDimensionsMm,
  fitBlockWidthMm,
  needsNewPage,
  scaleToFitPageMm,
} from '@/lib/exportHtmlBlocksToPdf';

export async function exportPilotReportPdf(
  reportData: PilotReportData,
  filename: string,
): Promise<void> {
  const html = buildPilotReportHtml(reportData);
  await exportHtmlBlocksToPdf(html, filename);
}
