import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SiteContentApiService {
  private readonly http = inject(HttpClient);

  get<T>(slug: string): Observable<T> {
    return this.http.get<T>(`${environment.apiUrl}/public/site-content/${slug}`);
  }
}
