import { Injectable, signal } from '@angular/core';
import { CertLayoutConfig } from './pdf.service';

export interface CertificatePreviewData {
  backgroundImageUrl: string;
  layoutConfig: CertLayoutConfig | null | undefined;
  recipientName: string;
  detailLine: string;
  certificateNo: string;
  issueDate: string;
}

export interface CertificatePreviewRequest {
  data: CertificatePreviewData;
  title: string;
  confirmLabel: string;
}

@Injectable({ providedIn: 'root' })
export class CertificatePreviewService {
  readonly request = signal<CertificatePreviewRequest | null>(null);
  private resolver: ((result: boolean) => void) | null = null;

  ask(data: CertificatePreviewData, options?: { title?: string; confirmLabel?: string }): Promise<boolean> {
    this.request.set({
      data,
      title: options?.title ?? 'Preview certificate',
      confirmLabel: options?.confirmLabel ?? 'Issue certificate',
    });
    return new Promise((resolve) => {
      this.resolver = resolve;
    });
  }

  respond(result: boolean): void {
    this.resolver?.(result);
    this.resolver = null;
    this.request.set(null);
  }
}
