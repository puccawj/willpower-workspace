import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ApiDonationType = 'money' | 'goods';
export type ApiDonationStatus = 'pending' | 'received' | 'verified' | 'rejected';

export interface ApiDonation {
  id: string;
  eventId: string | null;
  branchId: string;
  branchName: string;
  eventTitle: string | null;
  donorName: string;
  isAnonymous: boolean;
  donorPhoneCountryCode: string | null;
  donorPhoneNumber: string;
  donorEmail: string;
  type: ApiDonationType;
  amount: string | null;
  currency: string;
  itemDescription: string | null;
  proofImageUrl: string | null;
  status: ApiDonationStatus;
  certificateNo: string | null;
  certificateIssuedAt: string | null;
  createdAt: string;
}

export interface DonationPayload {
  donorName: string;
  isAnonymous?: boolean;
  donorPhoneCountryCode?: string;
  donorPhoneNumber: string;
  donorEmail: string;
  type: ApiDonationType;
  amountOrItem: string;
  branchId: string;
  eventId?: string;
  proofImage?: string;
}

@Injectable({ providedIn: 'root' })
export class DonationApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/donations`;

  readonly donations = signal<ApiDonation[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  load() {
    this.loading.set(true);
    this.error.set('');
    return this.http.get<ApiDonation[]>(this.baseUrl).pipe(
      tap({
        next: (rows) => {
          this.donations.set(rows);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'Failed to load donations.');
          this.loading.set(false);
        },
      }),
    );
  }

  create(payload: DonationPayload) {
    return this.http.post<ApiDonation>(this.baseUrl, payload).pipe(switchMap(() => this.load()));
  }

  update(id: string, payload: Partial<DonationPayload>) {
    return this.http.patch<ApiDonation>(`${this.baseUrl}/${id}`, payload).pipe(switchMap(() => this.load()));
  }

  remove(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(switchMap(() => this.load()));
  }

  verify(id: string) {
    return this.http.patch<ApiDonation>(`${this.baseUrl}/${id}/verify`, {}).pipe(switchMap(() => this.load()));
  }

  issueCertificate(id: string) {
    return this.http.patch<ApiDonation>(`${this.baseUrl}/${id}/certificate`, {});
  }
}
