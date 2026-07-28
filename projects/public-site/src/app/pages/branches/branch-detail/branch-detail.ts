import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { BranchApiService, PublicBranch } from '../../../core/services/branch-api.service';

@Component({
  selector: 'app-branch-detail',
  imports: [RouterLink],
  templateUrl: './branch-detail.html',
  styleUrl: './branch-detail.scss',
})
export class BranchDetail {
  private readonly api = inject(BranchApiService);
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id') ?? '')), {
    initialValue: '',
  });

  readonly branch = signal<PublicBranch | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    const id = this.id();
    if (!id) return;
    this.api.loadOne(id).subscribe({
      next: (branch) => {
        this.branch.set(branch);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('This branch could not be found.');
        this.loading.set(false);
      },
    });
  }
}
