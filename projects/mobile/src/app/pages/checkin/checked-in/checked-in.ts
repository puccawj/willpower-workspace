import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-checked-in',
  imports: [RouterLink],
  templateUrl: './checked-in.html',
  styleUrl: './checked-in.scss',
})
export class CheckedIn {
  private readonly route = inject(ActivatedRoute);

  readonly title = this.route.snapshot.queryParamMap.get('title') ?? 'Session';
  readonly alreadyCheckedIn = this.route.snapshot.queryParamMap.get('already') === '1';
  readonly now = new Date().toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
