import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiBranch {
  id: string;
  name: string;
  city: string | null;
  country: string;
  timezone: string;
  address: string | null;
  zipCode: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  email: string | null;
  logoUrl: string | null;
  status: 'active' | 'inactive';
  adminCount: number;
  userCount: number;
  eventCount: number;
}

export interface BranchPayload {
  name: string;
  city?: string;
  country?: string;
  timezone?: string;
  address?: string;
  zipCode?: string;
  phoneCountryCode?: string;
  phoneNumber?: string;
  email?: string;
  logo?: string;
  status?: 'active' | 'inactive';
}

@Injectable({ providedIn: 'root' })
export class BranchApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/branches`;

  readonly branches = signal<ApiBranch[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiBranch[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.branches.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load branches.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: BranchPayload) {
    return this.http.post<Partial<ApiBranch>>(this.baseUrl, payload).pipe(
      tap((branch) => {
        const withCounts: ApiBranch = {
          adminCount: 0,
          userCount: 0,
          eventCount: 0,
          ...branch,
        } as ApiBranch;
        this.branches.update((list) => [...list, withCounts]);
      }),
    );
  }

  update(id: string, payload: Partial<BranchPayload>) {
    return this.http.patch<ApiBranch>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((branch) => this.branches.update((list) => list.map((b) => (b.id === id ? { ...b, ...branch } : b)))),
    );
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.branches.update((list) => list.filter((b) => b.id !== id))),
    );
  }
}
