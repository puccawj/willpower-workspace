import { Component, computed, inject } from '@angular/core';
import { CertLayoutPosition } from '../../core/services/pdf.service';
import { CertificatePreviewService } from '../../core/services/certificate-preview.service';

@Component({
  selector: 'app-certificate-preview',
  imports: [],
  templateUrl: './certificate-preview.html',
  styleUrl: './certificate-preview.scss',
})
export class CertificatePreview {
  readonly preview = inject(CertificatePreviewService);

  readonly positions = computed<Partial<Record<'kicker' | 'name' | 'course' | 'certNo' | 'issueDate', CertLayoutPosition>>>(
    () => this.preview.request()?.data.layoutConfig?.positions ?? {},
  );

  readonly kickerText = computed(() => this.preview.request()?.data.layoutConfig?.kickerText || 'CERTIFICATE OF COMPLETION');

  respond(result: boolean): void {
    this.preview.respond(result);
  }
}
