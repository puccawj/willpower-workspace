import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MockDataService } from '../../core/services/mock-data.service';
import { BranchApiService } from '../../core/services/branch-api.service';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private readonly data = inject(MockDataService);
  private readonly branchApi = inject(BranchApiService);
  readonly timeline = this.data.timeline;
  readonly branches = this.branchApi.branches;

  constructor() {
    this.branchApi.load().subscribe();
  }
}
