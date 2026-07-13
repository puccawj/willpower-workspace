import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiTeamMember {
  id: string;
  branchId: string;
  branchName: string;
  name: string;
  position: string | null;
  bio: string | null;
  photoUrl: string | null;
  displayOrder: number;
  isShown: boolean;
}

export interface TeamMemberPayload {
  name: string;
  position?: string;
  bio?: string;
  branchId: string;
  photo?: string;
  isShown?: boolean;
  displayOrder?: number;
}

@Injectable({ providedIn: 'root' })
export class TeamMemberApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/team-members`;

  readonly members = signal<ApiTeamMember[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiTeamMember[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.members.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load team members.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: TeamMemberPayload) {
    return this.http.post<ApiTeamMember>(this.baseUrl, payload).pipe(switchMap(() => this.load()));
  }

  update(id: string, payload: Partial<TeamMemberPayload>) {
    return this.http.patch<ApiTeamMember>(`${this.baseUrl}/${id}`, payload).pipe(switchMap(() => this.load()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }
}
