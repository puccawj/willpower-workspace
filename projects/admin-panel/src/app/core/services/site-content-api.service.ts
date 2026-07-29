import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiSiteContent {
  id: string;
  slug: string;
  content: Record<string, unknown>;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SiteContentApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/site-content`;

  get<T>(slug: string): Observable<{ id: string; slug: string; content: T; updatedAt: string }> {
    return this.http.get<{ id: string; slug: string; content: T; updatedAt: string }>(`${this.baseUrl}/${slug}`);
  }

  save<T>(slug: string, content: T): Observable<ApiSiteContent> {
    return this.http.put<ApiSiteContent>(`${this.baseUrl}/${slug}`, { content });
  }
}
