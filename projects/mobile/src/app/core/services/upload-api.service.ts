import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadApiService {
  private readonly http = inject(HttpClient);

  uploadFile(file: File): Observable<string> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<{ url: string }>(`${environment.apiUrl}/uploads`, form).pipe(map((res) => res.url));
  }
}
