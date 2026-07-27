import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-my-certificates',
  imports: [RouterLink, BackButton],
  templateUrl: './my-certificates.html',
  styleUrl: '../profile-list.scss',
})
export class MyCertificates {
  protected readonly meApi = inject(MeApiService);

  constructor() {
    this.meApi.loadCertificates().subscribe();
  }
}
