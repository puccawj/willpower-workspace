import { Component, inject } from '@angular/core';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-my-rsvps',
  imports: [BackButton],
  templateUrl: './my-rsvps.html',
  styleUrl: '../profile-list.scss',
})
export class MyRsvps {
  protected readonly meApi = inject(MeApiService);

  constructor() {
    this.meApi.loadEvents().subscribe();
  }

  formatDate(startAt: string): string {
    return new Date(startAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
}
