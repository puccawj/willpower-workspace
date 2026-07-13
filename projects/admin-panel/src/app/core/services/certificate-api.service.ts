import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiCertificate {
  id: string;
  userId: string;
  offeringId: string;
  templateId: string;
  certificateNo: string;
  attendancePercent: string;
  issuedAt: string;
  fileUrl: string;
  studentName: string;
  studentEmail: string;
}

export interface IssueCertificatePayload {
  offeringId: string;
  userId: string;
  fileUrl: string;
  certificateNo: string;
}

@Injectable({ providedIn: 'root' })
export class CertificateApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/certificates`;

  readonly certificates = signal<ApiCertificate[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(offeringId?: string) {
    this.loading.set(true);
    this.error.set('');
    const url = offeringId ? `${this.baseUrl}?offeringId=${offeringId}` : this.baseUrl;
    return this.http.get<ApiCertificate[]>(url).pipe(
      tap({
        next: (rows) => {
          this.certificates.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load certificates.');
          this.loading.set(false);
        },
      }),
    );
  }

  issue(payload: IssueCertificatePayload) {
    return this.http.post<ApiCertificate>(this.baseUrl, payload).pipe(switchMap(() => this.load(payload.offeringId)));
  }
}
