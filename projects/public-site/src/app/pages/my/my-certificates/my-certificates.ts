import { Component, computed, inject } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api.service';

interface CertificateRow {
  id: string;
  courseTitle: string;
  issuedDate: string;
  certNo: string;
  fileUrl: string;
}

@Component({
  selector: 'app-my-certificates',
  imports: [],
  templateUrl: './my-certificates.html',
  styleUrl: './my-certificates.scss',
})
export class MyCertificates {
  private readonly api = inject(MeApiService);

  readonly certificates = computed<CertificateRow[]>(() =>
    this.api.certificates().map((c) => ({
      id: c.id,
      courseTitle: c.courseTitle ?? c.templateName,
      issuedDate: new Date(c.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      certNo: c.certificateNo,
      fileUrl: c.fileUrl,
    })),
  );

  constructor() {
    this.api.loadCertificates().subscribe();
  }
}
