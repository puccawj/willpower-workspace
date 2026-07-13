import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface CertificatePdfData {
  kind: string;
  recipientName: string;
  bodyLine: string;
  refNo: string;
  issueDate: string;
}

export interface ReportPdfData {
  reportName: string;
  stats: { label: string; value: string | number }[];
  chartTitle: string;
  rows: { name: string; value: string }[];
}

export type CertLayoutFieldKey = 'kicker' | 'name' | 'course' | 'certNo' | 'issueDate';

export interface CertLayoutPosition {
  xPct: number;
  yPct: number;
}

export interface CertLayoutConfig {
  kickerText?: string;
  positions?: Partial<Record<CertLayoutFieldKey, CertLayoutPosition>>;
}

export interface TemplateCertificateData {
  backgroundImageUrl: string;
  layoutConfig: CertLayoutConfig | null | undefined;
  recipientName: string;
  courseLine: string;
  certificateNo: string;
  issueDate: string;
}

export const DEFAULT_CERT_POSITIONS: Record<CertLayoutFieldKey, CertLayoutPosition> = {
  kicker: { xPct: 50, yPct: 22 },
  name: { xPct: 50, yPct: 44 },
  course: { xPct: 50, yPct: 62 },
  certNo: { xPct: 12, yPct: 90 },
  issueDate: { xPct: 88, yPct: 90 },
};

interface TextStyle {
  font: string;
  style: string;
  size: number;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class PdfService {
  private buildCertificateDoc(data: CertificatePdfData): jsPDF {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Background + border
    doc.setFillColor('#f4eddd');
    doc.rect(0, 0, pageW, pageH, 'F');
    doc.setDrawColor('#b98a32');
    doc.setLineWidth(1.2);
    doc.rect(10, 10, pageW - 20, pageH - 20);
    doc.setDrawColor('#c6a24a');
    doc.setLineWidth(0.4);
    doc.rect(14, 14, pageW - 28, pageH - 28);

    doc.setTextColor('#b98a32');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('WILLPOWER INSTITUTE', pageW / 2, 34, { align: 'center' });

    doc.setTextColor('#241c15');
    doc.setFontSize(22);
    doc.text(data.kind.toUpperCase(), pageW / 2, 48, { align: 'center' });

    doc.setFont('times', 'italic');
    doc.setFontSize(32);
    doc.text(data.recipientName, pageW / 2, 72, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.setTextColor('#5a5044');
    const bodyLines = doc.splitTextToSize(data.bodyLine, pageW - 80);
    doc.text(bodyLines, pageW / 2, 90, { align: 'center' });

    doc.setFontSize(10.5);
    doc.setTextColor('#8a7d6a');
    doc.text(`Reference No. ${data.refNo}`, 24, pageH - 20);
    doc.text(`Issued ${data.issueDate}`, pageW - 24, pageH - 20, { align: 'right' });

    return doc;
  }

  /** Renders a decorative certificate/anumodana PDF and triggers a browser download. */
  downloadCertificate(data: CertificatePdfData): void {
    const doc = this.buildCertificateDoc(data);
    doc.save(`${data.kind.replace(/\s+/g, '-')}-${data.refNo}.pdf`);
  }

  /** Renders the same certificate PDF as a base64 data URI, for uploading instead of downloading. */
  certificateDataUri(data: CertificatePdfData): string {
    return this.buildCertificateDoc(data).output('datauristring');
  }

  /**
   * Renders a certificate using a custom uploaded background image, drawing only the fields the
   * admin actually placed on the template's designer canvas (layoutConfig.positions) — a field
   * left in the palette (never placed) is simply skipped.
   */
  async certificateFromTemplateDataUri(data: TemplateCertificateData): Promise<string> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const { dataUri: bgDataUri, format } = await this.fetchImageAsDataUri(data.backgroundImageUrl, pageW / pageH);
    doc.addImage(bgDataUri, format, 0, 0, pageW, pageH);

    const positions = data.layoutConfig?.positions ?? {};
    const kickerText = data.layoutConfig?.kickerText || 'CERTIFICATE OF COMPLETION';

    const fieldContent: Record<CertLayoutFieldKey, { text: string; style: TextStyle; maxWidth?: number }> = {
      kicker: { text: kickerText, style: { font: 'helvetica', style: 'bold', size: 11, color: '#b98a32' } },
      name: { text: data.recipientName, style: { font: 'times', style: 'italic', size: 28, color: '#241c15' } },
      course: {
        text: data.courseLine,
        style: { font: 'helvetica', style: 'normal', size: 12, color: '#5a5044' },
        maxWidth: pageW - 80,
      },
      certNo: {
        text: `No. ${data.certificateNo}`,
        style: { font: 'helvetica', style: 'normal', size: 9, color: '#8a7d6a' },
      },
      issueDate: {
        text: `Issued ${data.issueDate}`,
        style: { font: 'helvetica', style: 'normal', size: 9, color: '#8a7d6a' },
      },
    };

    for (const key of Object.keys(positions) as CertLayoutFieldKey[]) {
      const pos = positions[key];
      const content = fieldContent[key];
      if (!pos || !content) continue;
      this.drawCentered(doc, pos, content.text, pageW, pageH, content.style, content.maxWidth);
    }

    return doc.output('datauristring');
  }

  private drawCentered(
    doc: jsPDF,
    pos: CertLayoutPosition,
    text: string,
    pageW: number,
    pageH: number,
    style: TextStyle,
    maxWidth?: number,
  ): void {
    doc.setFont(style.font, style.style);
    doc.setFontSize(style.size);
    doc.setTextColor(style.color);
    const x = (pos.xPct / 100) * pageW;
    const y = (pos.yPct / 100) * pageH;
    const content = maxWidth ? doc.splitTextToSize(text, maxWidth) : text;
    doc.text(content, x, y, { align: 'center' });
  }

  /**
   * Fetches the background image and center-crops it to the given aspect ratio (matching the
   * designer canvas's CSS `object-fit: cover`), so the PDF shows exactly the same framing the
   * admin saw while placing fields — instead of jsPDF's addImage stretching the raw image to
   * fit the page and distorting it whenever the upload isn't already A4-landscape shaped.
   */
  private async fetchImageAsDataUri(url: string, targetAspect: number): Promise<{ dataUri: string; format: string }> {
    const res = await fetch(url);
    const blob = await res.blob();
    const bitmap = await createImageBitmap(blob);

    const outW = 1600;
    const outH = Math.round(outW / targetAspect);
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;

    const srcAspect = bitmap.width / bitmap.height;
    let sx = 0;
    let sy = 0;
    let sw = bitmap.width;
    let sh = bitmap.height;
    if (srcAspect > targetAspect) {
      sw = bitmap.height * targetAspect;
      sx = (bitmap.width - sw) / 2;
    } else {
      sh = bitmap.width / targetAspect;
      sy = (bitmap.height - sh) / 2;
    }
    ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, outW, outH);

    return { dataUri: canvas.toDataURL('image/jpeg', 0.92), format: 'JPEG' };
  }

  /** Renders a simple statistics + table report and triggers a browser download. */
  downloadReport(data: ReportPdfData): void {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setTextColor('#241c15');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Willpower Institute — Report', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#8a7d6a');
    doc.text(data.reportName, 14, 27);
    doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }), pageW - 14, 27, {
      align: 'right',
    });

    autoTable(doc, {
      startY: 34,
      head: [['Metric', 'Value']],
      body: data.stats.map((s) => [s.label, String(s.value)]),
      headStyles: { fillColor: '#241c15' },
      theme: 'striped',
    });

    const afterStatsY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor('#241c15');
    doc.text(data.chartTitle, 14, afterStatsY);

    autoTable(doc, {
      startY: afterStatsY + 4,
      head: [['Name', 'Value']],
      body: data.rows.map((r) => [r.name, r.value]),
      headStyles: { fillColor: '#a94b2c' },
      theme: 'striped',
    });

    doc.save(`${data.reportName.replace(/\s+/g, '-')}-report.pdf`);
  }
}
