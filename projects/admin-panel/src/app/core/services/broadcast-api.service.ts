import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BroadcastHistoryRow {
  broadcastId: string;
  title: string;
  message: string;
  targetBranchId: string | null;
  targetBranchName: string | null;
  recipientCount: number;
  sentAt: string;
  sentByName: string | null;
}

export interface BroadcastPayload {
  title: string;
  message: string;
  scope: 'all' | 'branch';
  branchId?: string;
  studentsOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class BroadcastApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/notifications`;

  readonly history = signal<BroadcastHistoryRow[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  loadHistory() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<BroadcastHistoryRow[]>(`${this.baseUrl}/broadcasts`).pipe(
      tap({
        next: (rows) => {
          this.history.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load broadcast history.');
          this.loading.set(false);
        },
      }),
    );
  }

  send(payload: BroadcastPayload) {
    return this.http
      .post<{ recipientCount: number }>(`${this.baseUrl}/broadcast`, payload)
      .pipe(tap(() => this.loadHistory().subscribe()));
  }
}
