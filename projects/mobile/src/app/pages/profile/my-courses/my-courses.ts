import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-my-courses',
  imports: [RouterLink, BackButton],
  templateUrl: './my-courses.html',
  styleUrl: '../profile-list.scss',
})
export class MyCourses {
  protected readonly meApi = inject(MeApiService);

  constructor() {
    this.meApi.loadEnrollments().subscribe();
    this.meApi.loadCertificates().subscribe();
  }

  certificateForOffering(offeringId: string) {
    return this.meApi.certificates().find((c) => c.offeringId === offeringId) ?? null;
  }
}
