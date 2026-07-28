import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiPublicBranch {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  country: string;
  timezone: string;
  address: string | null;
  zipCode: string | null;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
  email: string | null;
  logoUrl: string | null;
}

export interface PublicBranch {
  id: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
  img: string;
  desc: string;
  address: string | null;
  zipCode: string | null;
  phone: string | null;
  email: string | null;
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1526427158867-98ee4ba58d5a?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1622506092974-38b108ee3436?q=80&w=1200&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1653997412308-308d945f687b?q=80&w=1200&auto=format&fit=crop',
];

function toPublicBranch(row: ApiPublicBranch, index: number): PublicBranch {
  return {
    id: row.id,
    name: row.name,
    city: row.city ?? row.country,
    country: row.country,
    timezone: row.timezone,
    img: row.logoUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    desc: row.description ?? `Our ${row.name} branch, welcoming students to study and practice together.`,
    address: row.address,
    zipCode: row.zipCode,
    phone: row.phoneNumber ? `${row.phoneCountryCode ?? ''} ${row.phoneNumber}`.trim() : null,
    email: row.email,
  };
}

@Injectable({ providedIn: 'root' })
export class BranchApiService {
  private readonly http = inject(HttpClient);

  readonly branches = signal<PublicBranch[]>([]);

  load(): Observable<PublicBranch[]> {
    return this.http.get<ApiPublicBranch[]>(`${environment.apiUrl}/public/branches`).pipe(
      map((rows) => rows.map(toPublicBranch)),
      tap((branches) => this.branches.set(branches)),
    );
  }

  loadOne(id: string): Observable<PublicBranch> {
    return this.http.get<ApiPublicBranch[]>(`${environment.apiUrl}/public/branches`).pipe(
      map((rows) => {
        const index = rows.findIndex((r) => r.id === id);
        if (index === -1) throw new Error('Branch not found');
        return toPublicBranch(rows[index], index);
      }),
    );
  }
}
