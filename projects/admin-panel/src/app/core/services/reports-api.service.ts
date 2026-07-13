import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiLearningSummary {
  activeOfferings: number;
  avgCompletionPercent: number;
  atRiskStudents: number;
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/reports`;

  readonly learningSummary = signal<ApiLearningSummary>({ activeOfferings: 0, avgCompletionPercent: 0, atRiskStudents: 0 });
  readonly loading = signal(false);
  readonly error = signal('');

  loadLearningSummary() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiLearningSummary>(`${this.baseUrl}/learning-summary`).pipe(
      tap({
        next: (row) => {
          this.learningSummary.set(row);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load learning summary.');
          this.loading.set(false);
        },
      }),
    );
  }
}
