import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CertLayoutConfig } from './pdf.service';

export type ApiTemplateType = 'certificate' | 'donation_money' | 'donation_goods';

export interface ApiCertificateTemplate {
  id: string;
  name: string;
  type: ApiTemplateType;
  backgroundImageUrl: string;
  layoutConfig: CertLayoutConfig | null;
  year: number | null;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
}

export interface TemplatePayload {
  name: string;
  type: ApiTemplateType;
  backgroundImage: string;
  year?: number;
  branchId?: string;
  isActive?: boolean;
  layoutConfig?: CertLayoutConfig;
}

@Injectable({ providedIn: 'root' })
export class CertificateTemplateApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/certificate-templates`;

  readonly templates = signal<ApiCertificateTemplate[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiCertificateTemplate[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.templates.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load certificate templates.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: TemplatePayload) {
    return this.http.post<ApiCertificateTemplate>(this.baseUrl, payload).pipe(switchMap(() => this.load()));
  }

  update(id: string, payload: Partial<TemplatePayload>) {
    return this.http.patch<ApiCertificateTemplate>(`${this.baseUrl}/${id}`, payload).pipe(switchMap(() => this.load()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }

  /** Persists just the drag-designer's field positions/kicker text for a template. */
  saveLayout(id: string, layoutConfig: CertLayoutConfig): Observable<ApiCertificateTemplate> {
    return this.http.patch<ApiCertificateTemplate>(`${this.baseUrl}/${id}`, { layoutConfig });
  }

  findActiveForBranch(branchId: string | null, type: ApiTemplateType = 'certificate'): Observable<ApiCertificateTemplate | null> {
    const params = new URLSearchParams({ type });
    if (branchId) params.set('branchId', branchId);
    return this.http.get<ApiCertificateTemplate | null>(`${this.baseUrl}/active/lookup?${params.toString()}`);
  }
}
