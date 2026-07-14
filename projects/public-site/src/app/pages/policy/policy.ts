import { Component } from '@angular/core';

@Component({
  selector: 'app-policy',
  imports: [],
  templateUrl: './policy.html',
  styleUrl: './policy.scss',
})
export class Policy {
  readonly lastUpdated = 'July 14, 2026';

  goTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
