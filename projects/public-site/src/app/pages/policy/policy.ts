import { Component, inject, signal } from '@angular/core';
import { SiteContentApiService } from '../../core/services/site-content-api.service';

interface PolicySection {
  id: string;
  title: string;
  bodyHtml: string;
}

interface PrivacyPolicyContent {
  lastUpdated: string;
  lead: string;
  sections: PolicySection[];
}

const DEFAULT_LAST_UPDATED = 'July 14, 2026';
const DEFAULT_LEAD =
  'This Privacy Policy explains how the Willpower Institute ("we," "us," "our") collects, uses, shares, and protects personal information when you visit our website, enroll in a course, RSVP to an event, or make a donation — across our branches in the United States, Canada, and Australia.';

@Component({
  selector: 'app-policy',
  imports: [],
  templateUrl: './policy.html',
  styleUrl: './policy.scss',
})
export class Policy {
  private readonly siteContent = inject(SiteContentApiService);

  readonly lastUpdated = signal(DEFAULT_LAST_UPDATED);
  readonly lead = signal(DEFAULT_LEAD);
  readonly sections = signal<PolicySection[]>([]);

  constructor() {
    this.siteContent.get<Partial<PrivacyPolicyContent>>('privacy-policy').subscribe({
      next: (data) => {
        if (data.lastUpdated) this.lastUpdated.set(data.lastUpdated);
        if (data.lead) this.lead.set(data.lead);
        if (data.sections?.length) this.sections.set(data.sections);
      },
    });
  }

  goTo(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
