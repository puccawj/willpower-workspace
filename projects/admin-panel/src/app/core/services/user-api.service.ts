import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiUserRole = 'superadmin' | 'admin' | 'instructor' | 'student' | 'general';
export type ApiUserStatus = 'active' | 'suspended' | 'pending_verification';
export type ApiRegistrationSource = 'admin' | 'self' | 'google' | 'facebook';

export interface ApiUser {
  id: string;
  role: ApiUserRole;
  primaryBranchId: string | null;
  branchIds: string[];
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  status: ApiUserStatus;
  registrationSource: ApiRegistrationSource;
  createdAt: string;
}

export interface UserPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: ApiUserRole;
  branchIds?: string[];
  phoneCountryCode?: string;
  phoneNumber?: string;
  status?: ApiUserStatus;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  readonly users = signal<ApiUser[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiUser[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.users.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load users.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: UserPayload) {
    return this.http.post<ApiUser>(this.baseUrl, payload).pipe(
      tap((user) => this.users.update((list) => [...list, user])),
    );
  }

  update(id: string, payload: Partial<UserPayload>) {
    return this.http.patch<ApiUser>(`${this.baseUrl}/${id}`, payload).pipe(
      tap((user) => this.users.update((list) => list.map((u) => (u.id === id ? { ...u, ...user } : u)))),
    );
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.users.update((list) => list.filter((u) => u.id !== id))),
    );
  }
}
