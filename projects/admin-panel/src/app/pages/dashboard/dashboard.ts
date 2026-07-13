import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ApiEventStatus, EventApiService } from '../../core/services/event-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { DonationApiService } from '../../core/services/donation-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { formatDateShort } from '../../core/date-time.util';
import { StatCards, StatCardData } from '../../shared/stat-cards/stat-cards';

interface BranchBar {
  name: string;
  value: string;
  pct: string;
  color: string;
}

interface ActivityRow {
  id: string;
  title: string;
  branch: string;
  dateShort: string;
  rsvpSummary: string;
  status: string;
  statusColor: string;
}

const STATUS_LABEL: Record<ApiEventStatus, string> = {
  draft: 'Draft',
  published: 'Publish',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  Publish: 'var(--w-accent)',
  Draft: 'var(--w-muted)',
  Closed: 'var(--w-ink-soft)',
};

const BAR_COLORS = ['var(--w-accent)', 'var(--w-gold)', 'var(--w-green)', 'var(--w-red)', 'var(--w-ink-soft)'];

@Component({
  selector: 'app-dashboard',
  imports: [StatCards],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly eventApi = inject(EventApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly donationApi = inject(DonationApiService);
  private readonly userApi = inject(UserApiService);
  private readonly router = inject(Router);

  constructor() {
    this.eventApi.load().subscribe();
    this.branchApi.load().subscribe();
    this.donationApi.load().subscribe();
    this.userApi.load().subscribe();
  }

  private readonly upcomingEvents = computed(() => {
    const now = new Date();
    return this.eventApi.events().filter((ev) => ev.status === 'published' && new Date(ev.startAt) >= now);
  });

  readonly statCards = computed<StatCardData[]>(() => {
    const now = new Date();

    const rsvpThisMonth = this.eventApi
      .events()
      .filter((ev) => {
        const start = new Date(ev.startAt);
        return start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth();
      })
      .reduce((sum, ev) => sum + ev.going + ev.maybe, 0);

    const donationsThisMonth = this.donationApi.donations().filter((d) => {
      const created = new Date(d.createdAt);
      return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
    });
    const moneyThisMonth = donationsThisMonth
      .filter((d) => d.type === 'money' && d.amount)
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const goodsThisMonth = donationsThisMonth.filter((d) => d.type === 'goods').length;

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const newMembers = this.userApi.users().filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length;

    return [
      { label: 'Upcoming events', value: this.upcomingEvents().length, sub: 'Published, not yet started' },
      { label: 'RSVP this month', value: rsvpThisMonth, sub: 'Going + maybe, across all branches' },
      {
        label: 'Donations this month',
        value: `$${moneyThisMonth.toFixed(2)}`,
        sub: goodsThisMonth ? `+ ${goodsThisMonth} goods donation${goodsThisMonth === 1 ? '' : 's'}` : 'Money donations',
      },
      { label: 'New members (30d)', value: newMembers, sub: 'Across all branches' },
    ];
  });

  readonly branchBars = computed<BranchBar[]>(() => {
    const branches = [...this.branchApi.branches()].sort((a, b) => b.userCount - a.userCount).slice(0, 5);
    const max = Math.max(1, ...branches.map((b) => b.userCount));
    return branches.map((b, i) => ({
      name: b.name,
      value: `${b.userCount} member${b.userCount === 1 ? '' : 's'}`,
      pct: `${Math.round((b.userCount / max) * 100)}%`,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }));
  });

  readonly rsvpBreakdown = computed(() => {
    const upcoming = this.upcomingEvents();
    const going = upcoming.reduce((sum, ev) => sum + ev.going, 0);
    const maybe = upcoming.reduce((sum, ev) => sum + ev.maybe, 0);
    const cancel = upcoming.reduce((sum, ev) => sum + ev.cancel, 0);
    return [
      { label: 'Confirmed', value: going, color: 'var(--w-green)' },
      { label: 'Maybe', value: maybe, color: 'var(--w-gold)' },
      { label: 'Cancelled', value: cancel, color: 'var(--w-red)' },
    ];
  });

  readonly avgAttendanceRate = computed(() => {
    const upcoming = this.upcomingEvents();
    const capacity = upcoming.reduce((sum, ev) => sum + (ev.capacity ?? 0), 0);
    const going = upcoming.reduce((sum, ev) => sum + ev.going, 0);
    return capacity > 0 ? `${Math.round((going / capacity) * 100)}%` : '—';
  });

  private readonly branchNameById = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.id, b.name));
    return map;
  });

  readonly activity = computed<ActivityRow[]>(() => {
    const branchNameById = this.branchNameById();
    return [...this.eventApi.events()]
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime())
      .slice(0, 8)
      .map((ev) => {
        const status = STATUS_LABEL[ev.status];
        return {
          id: ev.id,
          title: ev.title,
          branch: branchNameById.get(ev.branchId) ?? '—',
          dateShort: formatDateShort(new Date(ev.startAt)),
          rsvpSummary: `${ev.going}✓ ${ev.maybe}? ${ev.cancel}✕`,
          status,
          statusColor: STATUS_COLORS[status],
        };
      });
  });

  goEvents(): void {
    this.router.navigate(['/events']);
  }
}
