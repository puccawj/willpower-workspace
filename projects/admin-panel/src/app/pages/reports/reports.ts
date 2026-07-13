import { Component, computed, inject, signal } from '@angular/core';
import { FilterTabs, FilterOption } from '../../shared/filter-tabs/filter-tabs';
import { StatCards, StatCardData } from '../../shared/stat-cards/stat-cards';
import { ExcelService } from '../../core/services/excel.service';
import { PdfService } from '../../core/services/pdf.service';
import { ToastService } from '../../core/services/toast.service';
import { EventApiService } from '../../core/services/event-api.service';
import { BranchApiService } from '../../core/services/branch-api.service';
import { DonationApiService } from '../../core/services/donation-api.service';
import { UserApiService } from '../../core/services/user-api.service';
import { OfferingApiService } from '../../core/services/offering-api.service';
import { CertificateApiService } from '../../core/services/certificate-api.service';
import { ReportsApiService } from '../../core/services/reports-api.service';

interface ReportBar {
  name: string;
  value: string;
  pct: string;
  color: string;
}

interface ReportTabData {
  stats: StatCardData[];
  title: string;
  bars: ReportBar[];
}

const BAR_COLORS = ['var(--w-accent)', 'var(--w-gold)', 'var(--w-green)', '#8a5a2e', 'var(--w-red)'];

function topBars<T>(items: T[], name: (t: T) => string, amount: (t: T) => number, unit: (v: number) => string): ReportBar[] {
  const sorted = [...items].sort((a, b) => amount(b) - amount(a)).slice(0, 5);
  const max = Math.max(1, ...sorted.map(amount));
  return sorted.map((item, i) => ({
    name: name(item),
    value: unit(amount(item)),
    pct: `${Math.round((amount(item) / max) * 100)}%`,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));
}

@Component({
  selector: 'app-reports',
  imports: [FilterTabs, StatCards],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
})
export class Reports {
  private readonly excel = inject(ExcelService);
  private readonly pdf = inject(PdfService);
  private readonly toast = inject(ToastService);
  private readonly eventApi = inject(EventApiService);
  private readonly branchApi = inject(BranchApiService);
  private readonly donationApi = inject(DonationApiService);
  private readonly userApi = inject(UserApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly certificateApi = inject(CertificateApiService);
  private readonly reportsApi = inject(ReportsApiService);

  readonly tab = signal('events');

  readonly tabOptions: FilterOption[] = [
    { key: 'events', label: 'Events' },
    { key: 'learning', label: 'Learning' },
    { key: 'donations', label: 'Donations' },
    { key: 'users', label: 'Users' },
  ];

  constructor() {
    this.eventApi.load().subscribe();
    this.branchApi.load().subscribe();
    this.donationApi.load().subscribe();
    this.userApi.load().subscribe();
    this.offeringApi.load().subscribe();
    this.certificateApi.load().subscribe();
    this.reportsApi.loadLearningSummary().subscribe();
  }

  private readonly branchNameById = computed(() => {
    const map = new Map<string, string>();
    this.branchApi.branches().forEach((b) => map.set(b.id, b.name));
    return map;
  });

  private readonly eventsTab = computed<ReportTabData>(() => {
    const events = this.eventApi.events();
    const branchNameById = this.branchNameById();

    const withCapacity = events.filter((ev) => (ev.capacity ?? 0) > 0);
    const avgRsvpRate = withCapacity.length
      ? Math.round((withCapacity.reduce((sum, ev) => sum + ev.going / (ev.capacity ?? 1), 0) / withCapacity.length) * 100)
      : 0;

    const goingByBranch = new Map<string, number>();
    for (const ev of events) {
      goingByBranch.set(ev.branchId, (goingByBranch.get(ev.branchId) ?? 0) + ev.going);
    }
    const branchRows = [...goingByBranch.entries()].map(([branchId, going]) => ({
      name: branchNameById.get(branchId) ?? '—',
      going,
    }));

    return {
      stats: [
        { label: 'Total events', value: events.length },
        { label: 'Avg. RSVP rate', value: `${avgRsvpRate}%` },
        { label: 'Published', value: events.filter((ev) => ev.status === 'published').length },
        { label: 'Closed', value: events.filter((ev) => ev.status === 'closed').length },
      ],
      title: 'RSVP volume by branch',
      bars: topBars(branchRows, (r) => r.name, (r) => r.going, (v) => `${v} RSVP${v === 1 ? '' : 's'}`),
    };
  });

  private readonly learningTab = computed<ReportTabData>(() => {
    const summary = this.reportsApi.learningSummary();
    const offerings = this.offeringApi.offerings().filter((o) => (o.capacity ?? 0) > 0);

    return {
      stats: [
        { label: 'Active offerings', value: summary.activeOfferings },
        { label: 'Avg. completion', value: `${summary.avgCompletionPercent}%` },
        { label: 'Certificates issued', value: this.certificateApi.certificates().length },
        { label: 'At-risk students', value: summary.atRiskStudents },
      ],
      title: 'Enrollment by offering',
      bars: topBars(
        offerings,
        (o) => o.courseTitle,
        (o) => Math.round((o.enrolledCount / (o.capacity ?? 1)) * 100),
        (v) => `${v}% full`,
      ),
    };
  });

  private readonly donationsTab = computed<ReportTabData>(() => {
    const donations = this.donationApi.donations();
    const branchNameById = this.branchNameById();
    const now = new Date();

    const ytd = donations.filter((d) => new Date(d.createdAt).getFullYear() === now.getFullYear());
    const moneyYtd = ytd.filter((d) => d.type === 'money');
    const goodsYtd = ytd.filter((d) => d.type === 'goods');
    const totalMoney = moneyYtd.reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

    const moneyByBranch = new Map<string, number>();
    for (const d of moneyYtd) {
      moneyByBranch.set(d.branchId, (moneyByBranch.get(d.branchId) ?? 0) + Number(d.amount ?? 0));
    }
    const branchRows = [...moneyByBranch.entries()].map(([branchId, amount]) => ({
      name: branchNameById.get(branchId) ?? '—',
      amount,
    }));

    return {
      stats: [
        { label: 'Money (YTD)', value: `$${totalMoney.toFixed(2)}` },
        { label: 'Goods logged (YTD)', value: goodsYtd.length },
        { label: 'Certificates sent', value: donations.filter((d) => !!d.certificateNo).length },
        { label: 'Total donors (YTD)', value: ytd.length },
      ],
      title: 'Money donations by branch (YTD)',
      bars: topBars(branchRows, (r) => r.name, (r) => r.amount, (v) => `$${v.toFixed(2)}`),
    };
  });

  private readonly usersTab = computed<ReportTabData>(() => {
    const users = this.userApi.users();
    const branches = this.branchApi.branches();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      stats: [
        { label: 'Total members', value: users.length },
        { label: 'New (30d)', value: users.filter((u) => new Date(u.createdAt) >= thirtyDaysAgo).length },
        { label: 'Active', value: users.filter((u) => u.status === 'active').length },
        { label: 'Suspended', value: users.filter((u) => u.status === 'suspended').length },
      ],
      title: 'Members by branch',
      bars: topBars(branches, (b) => b.name, (b) => b.userCount, (v) => `${v} member${v === 1 ? '' : 's'}`),
    };
  });

  readonly current = computed<ReportTabData>(() => {
    switch (this.tab()) {
      case 'learning':
        return this.learningTab();
      case 'donations':
        return this.donationsTab();
      case 'users':
        return this.usersTab();
      default:
        return this.eventsTab();
    }
  });

  setTab = (key: string) => this.tab.set(key);

  private tabLabel(): string {
    return this.tabOptions.find((t) => t.key === this.tab())?.label ?? this.tab();
  }

  exportExcel(): void {
    const c = this.current();
    const rows = [
      ...c.stats.map((s) => ({ Section: 'Summary', Metric: s.label, Value: String(s.value) })),
      ...c.bars.map((b) => ({ Section: c.title, Metric: b.name, Value: b.value })),
    ];
    this.excel.exportRows(`willpower-${this.tab()}-report`, this.tabLabel(), rows);
    this.toast.show(`${this.tabLabel()} report exported to Excel.`, 'success');
  }

  exportPdf(): void {
    const c = this.current();
    this.pdf.downloadReport({
      reportName: `${this.tabLabel()} report`,
      stats: c.stats,
      chartTitle: c.title,
      rows: c.bars.map((b) => ({ name: b.name, value: b.value })),
    });
    this.toast.show(`${this.tabLabel()} report exported to PDF.`, 'success');
  }
}
