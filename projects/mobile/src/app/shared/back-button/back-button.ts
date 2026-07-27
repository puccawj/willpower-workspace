import { Component, Input, inject } from '@angular/core';
import { Location } from '@angular/common';

@Component({
  selector: 'app-back-button',
  imports: [],
  templateUrl: './back-button.html',
  styleUrl: './back-button.scss',
})
export class BackButton {
  private readonly location = inject(Location);

  @Input() variant: 'inline' | 'overlay' = 'inline';

  goBack(): void {
    this.location.back();
  }
}
