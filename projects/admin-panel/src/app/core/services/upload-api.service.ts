import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UploadApiService {
  private readonly http = inject(HttpClient);

  uploadDataUri(dataUri: string): Observable<string> {
    return new Observable<Blob>((subscriber) => {
      fetch(dataUri)
        .then((res) => res.blob())
        .then((blob) => {
          subscriber.next(blob);
          subscriber.complete();
        })
        .catch((err) => subscriber.error(err));
    }).pipe(
      switchMap((blob) => {
        const form = new FormData();
        form.append('file', blob, 'upload');
        return this.http.post<{ url: string }>(`${environment.apiUrl}/uploads`, form);
      }),
      map((res) => res.url),
    );
  }
}
