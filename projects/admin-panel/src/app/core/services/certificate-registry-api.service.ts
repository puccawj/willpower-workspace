import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type RegistryType = 'course' | 'donation';
export type RegistryStatus = 'issued' | 'voided';

export interface ApiRegistryRow {
  certificateNo: string;
  recipientName: string;
  recipientEmail: string;
  type: RegistryType;
  detail: string;
  issuedAt: string;
  issuedByName: string | null;
  status: RegistryStatus;
  voidedAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class CertificateRegistryApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/certificate-registry`;

  readonly rows = signal<ApiRegistryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiRegistryRow[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load the certificate registry.');
          this.loading.set(false);
        },
      }),
    );
  }
}
