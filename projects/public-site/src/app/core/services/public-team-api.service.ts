import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiPublicTeamMemberRow {
  id: string;
  name: string;
  position: string | null;
  bio: string | null;
  photoUrl: string | null;
  branchName: string;
}

export interface PublicTeamMember {
  id: string;
  name: string;
  role: string;
  branch: string;
  photoUrl: string | null;
  initials: string;
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter((w) => w.length > 0)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function toPublicTeamMember(row: ApiPublicTeamMemberRow): PublicTeamMember {
  return {
    id: row.id,
    name: row.name,
    role: row.position ?? 'Team member',
    branch: row.branchName,
    photoUrl: row.photoUrl,
    initials: initialsOf(row.name),
  };
}

@Injectable({ providedIn: 'root' })
export class PublicTeamApiService {
  private readonly http = inject(HttpClient);

  readonly members = signal<PublicTeamMember[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load(): Observable<PublicTeamMember[]> {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiPublicTeamMemberRow[]>(`${environment.apiUrl}/public/team`).pipe(
      map((rows) => rows.map(toPublicTeamMember)),
      tap({
        next: (members) => {
          this.members.set(members);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Unable to load our team right now.');
          this.loading.set(false);
        },
      }),
    );
  }
}
