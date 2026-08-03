import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiHomeBanner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
}

export interface HomeBanner {
  id: string;
  imageUrl: string;
  linkUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class HomeBannerApiService {
  private readonly http = inject(HttpClient);

  readonly banners = signal<HomeBanner[]>([]);

  load(): Observable<HomeBanner[]> {
    return this.http.get<ApiHomeBanner[]>(`${environment.apiUrl}/public/home-banners`).pipe(
      map((rows) => rows.map((r) => ({ id: r.id, imageUrl: r.imageUrl, linkUrl: r.linkUrl }))),
      tap((banners) => this.banners.set(banners)),
    );
  }
}
