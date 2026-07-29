import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface RatingSummary {
  average: number;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class RatingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/public/ratings`;

  summary(targetType: 'event' | 'offering', targetId: string): Observable<RatingSummary> {
    return this.http.get<RatingSummary>(`${this.baseUrl}/${targetType}/${targetId}`);
  }

  bulkSummary(targetType: 'event' | 'offering', targetIds: string[]): Observable<Record<string, RatingSummary>> {
    if (!targetIds.length) return new Observable((sub) => { sub.next({}); sub.complete(); });
    return this.http.get<Record<string, RatingSummary>>(`${this.baseUrl}/${targetType}`, { params: { ids: targetIds.join(',') } });
  }
}
