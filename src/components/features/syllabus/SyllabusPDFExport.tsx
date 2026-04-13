import { useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileDown } from 'lucide-react';
import type { SyllabusWithSections } from '@/types/syllabus';

interface SyllabusPDFExportProps {
  syllabus: SyllabusWithSections;
  isRTL?: boolean;
}

export const SyllabusPDFExport = ({ syllabus, isRTL = false }: SyllabusPDFExportProps) => {
  const { t } = useTranslation();
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useCallback(() => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const structureLabel = syllabus.section_label_override ||
      (syllabus.structure_type === 'weeks' ? 'Week' : syllabus.structure_type === 'units' ? 'Unit' : 'Module');

    const accentColor = syllabus.accent_color || '#6366f1';

    const html = `
      <!DOCTYPE html>
      <html dir="${isRTL ? 'rtl' : 'ltr'}">
      <head>
        <meta charset="utf-8">
        <title>${syllabus.title} - Syllabus</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #1a1a1a;
            line-height: 1.6;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1 { font-size: 28px; margin-bottom: 8px; color: ${accentColor}; }
          h2 { font-size: 18px; margin: 24px 0 12px; color: ${accentColor}; border-bottom: 2px solid ${accentColor}20; padding-bottom: 6px; }
          h3 { font-size: 15px; margin: 16px 0 8px; color: #333; }
          .summary { color: #666; font-size: 14px; margin-bottom: 24px; }
          .meta { display: flex; gap: 20px; margin-bottom: 20px; font-size: 12px; color: #888; flex-wrap: wrap; }
          .meta span { background: #f5f5f5; padding: 4px 10px; border-radius: 6px; }
          .policy-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
          .policy-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 14px; }
          .policy-card h3 { margin: 0 0 6px; font-size: 13px; color: ${accentColor}; }
          .policy-card p { font-size: 12px; color: #555; white-space: pre-wrap; }
          .grading-bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; margin: 8px 0; }
          .grading-item { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 4px; }
          .grading-dot { width: 10px; height: 10px; border-radius: 3px; }
          .section-card {
            border: 1px solid #e5e5e5; border-radius: 10px; padding: 16px; margin-bottom: 12px;
            border-left: 4px solid ${accentColor};
            page-break-inside: avoid;
          }
          .section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
          .section-title { font-weight: 700; font-size: 14px; }
          .section-dates { font-size: 11px; color: #888; }
          .section-desc { font-size: 12px; color: #555; margin-bottom: 8px; }
          .objectives { list-style: none; padding: 0; }
          .objectives li { font-size: 12px; color: #555; padding: 3px 0 3px 16px; position: relative; }
          .objectives li::before { content: '•'; color: ${accentColor}; position: absolute; left: 0; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #aaa; }
          @media print {
            body { padding: 20px; }
            .section-card { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>${syllabus.title}</h1>
        ${syllabus.summary ? `<p class="summary">${syllabus.summary}</p>` : ''}
        <div class="meta">
          <span>${t('syllabus.structureType')}: ${t(`syllabus.${syllabus.structure_type}`)}</span>
          <span>${t('syllabus.settings.status')}: ${syllabus.status}</span>
          ${syllabus.published_at ? `<span>${t('syllabus.publishedAt')}: ${new Date(syllabus.published_at).toLocaleDateString()}</span>` : ''}
        </div>

        ${(syllabus.policies ?? []).filter(p => p.content?.trim()).length > 0 ? `
          <h2>${t('syllabus.policies.title')}</h2>
          <div class="policy-grid">
            ${(syllabus.policies ?? []).filter(p => p.content?.trim()).map(p => `<div class="policy-card"><h3>${p.label}</h3><p>${p.content}</p></div>`).join('')}
          </div>
        ` : ''}

        ${syllabus.grading_categories.length > 0 ? `
          <h2>${t('syllabus.grading.breakdown')}</h2>
          <div>
            ${syllabus.grading_categories.map((cat, i) => {
              const colors = ['#6366f1', '#22c55e', '#f97316', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308', '#ef4444'];
              return `<div class="grading-item"><div class="grading-dot" style="background:${colors[i % colors.length]}"></div><span>${cat.name}</span><strong>${cat.weight}%</strong></div>`;
            }).join('')}
          </div>
        ` : ''}

        <h2>${t('syllabus.tabs.sections')} (${syllabus.sections.length})</h2>
        ${syllabus.sections.map((section, i) => {
          const dateRange = [section.start_date, section.end_date].filter(Boolean).join(' → ');
          return `
            <div class="section-card">
              <div class="section-header">
                <span class="section-title">${structureLabel} ${i + 1}: ${section.title}</span>
                ${dateRange ? `<span class="section-dates">${dateRange}</span>` : ''}
              </div>
              ${section.description ? `<p class="section-desc">${section.description}</p>` : ''}
              ${section.objectives?.length ? `
                <h3>${t('syllabus.detail.objectives')}</h3>
                <ul class="objectives">
                  ${section.objectives.map((obj) => `<li>${obj}</li>`).join('')}
                </ul>
              ` : ''}
            </div>
          `;
        }).join('')}

        <div class="footer">
          ${t('syllabus.pdfExport.generatedOn')} ${new Date().toLocaleDateString()} | Perleap
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }, [syllabus, isRTL, t]);

  return (
    <div ref={printRef}>
      <Button
        variant="outline"
        size="sm"
        onClick={handlePrint}
        className="rounded-full gap-1.5 text-xs"
      >
        <FileDown className="h-3.5 w-3.5" />
        {t('syllabus.pdfExport.button')}
      </Button>
    </div>
  );
};
