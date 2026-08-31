import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiPublicBranch {
  id: string;
  name: string;
}

export interface PublicBranch {
  id: string;
  name: string;
}

@Injectable({ providedIn: 'root' })
export class BranchApiService {
  private readonly http = inject(HttpClient);

  load(): Observable<PublicBranch[]> {
    return this.http
      .get<ApiPublicBranch[]>(`${environment.apiUrl}/public/branches`)
      .pipe(map((rows) => rows.map((r) => ({ id: r.id, name: r.name }))));
  }
}
