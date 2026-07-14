import { Component, computed, inject } from '@angular/core';
import { PublicTeamApiService, PublicTeamMember } from '../../core/services/public-team-api.service';

interface TeamBranchGroup {
  branch: string;
  members: PublicTeamMember[];
}

@Component({
  selector: 'app-team',
  imports: [],
  templateUrl: './team.html',
  styleUrl: './team.scss',
})
export class Team {
  private readonly api = inject(PublicTeamApiService);
  readonly team = this.api.members;

  readonly branchGroups = computed<TeamBranchGroup[]>(() => {
    const byBranch = new Map<string, PublicTeamMember[]>();
    for (const member of this.team()) {
      const list = byBranch.get(member.branch) ?? [];
      list.push(member);
      byBranch.set(member.branch, list);
    }
    const isUs = (name: string) => name.toLowerCase().includes('united states');
    return [...byBranch.entries()]
      .sort(([a], [b]) => {
        if (isUs(a) !== isUs(b)) return isUs(a) ? -1 : 1;
        return a.localeCompare(b);
      })
      .map(([branch, members]) => ({ branch, members }));
  });

  constructor() {
    this.api.load().subscribe();
  }
}
