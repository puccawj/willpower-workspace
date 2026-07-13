import { Component, inject } from '@angular/core';
import { MockDataService } from '../../core/services/mock-data.service';

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.scss',
})
export class About {
  private readonly data = inject(MockDataService);
  readonly timeline = this.data.timeline;
  readonly branches = this.data.branches;
}
