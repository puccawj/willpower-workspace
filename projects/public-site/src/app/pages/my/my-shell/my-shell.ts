import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-my-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './my-shell.html',
  styleUrl: './my-shell.scss',
})
export class MyShell {
  readonly auth = inject(AuthService);
}
