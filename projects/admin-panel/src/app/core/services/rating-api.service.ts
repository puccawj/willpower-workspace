import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AdminRatingRow {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  stars: number;
  note: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class RatingApiService {
  private readonly http = inject(HttpClient);

  eventRatings(eventId: string): Observable<AdminRatingRow[]> {
    return this.http.get<AdminRatingRow[]>(`${environment.apiUrl}/events/${eventId}/ratings`);
  }

  offeringRatings(offeringId: string): Observable<AdminRatingRow[]> {
    return this.http.get<AdminRatingRow[]>(`${environment.apiUrl}/course-offerings/${offeringId}/ratings`);
  }

  countAll(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(`${environment.apiUrl}/ratings/count`);
  }
}
