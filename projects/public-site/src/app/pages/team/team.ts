import { Component, inject } from '@angular/core';
import { PublicTeamApiService } from '../../core/services/public-team-api.service';

@Component({
  selector: 'app-team',
  imports: [],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team {
  private readonly api = inject(PublicTeamApiService);
  readonly team = this.api.members;

  constructor() {
    this.api.load().subscribe();
  }
}
