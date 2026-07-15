import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, concatMap, from, map, of, switchMap } from 'rxjs';
import { CourseApiService } from '../../core/services/course-api.service';
import { ApiOffering, OfferingApiService } from '../../core/services/offering-api.service';
import { EnrollmentApiService } from '../../core/services/enrollment-api.service';
import { CertificateApiService } from '../../core/services/certificate-api.service';
import {
  ApiCertificateTemplate,
  CertificateTemplateApiService,
} from '../../core/services/certificate-template-api.service';
import { UploadApiService } from '../../core/services/upload-api.service';
import { PdfService } from '../../core/services/pdf.service';
import { CertificatePreviewService } from '../../core/services/certificate-preview.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ListController } from '../../core/list-controller';
import { TableToolbar } from '../../shared/table-toolbar/table-toolbar';

interface CertRow {
  userId: string;
  name: string;
  email: string;
  pctLabel: string;
  pctValue: number;
  eligible: boolean;
  eligibleLabel: string;
  eligibleColor: string;
  issued: boolean;
  certId: string;
  certNo: string;
  templateId: string;
  issuedAt: string;
  fileUrl: string;
  issueLabel: string;
  actionIcon: string;
  actionColor: string;
}

@Component({
  selector: 'app-certificates',
  imports: [TableToolbar, FormsModule],
  templateUrl: './certificates.html',
  styleUrl: './certificates.scss',
})
export class Certificates {
  private readonly courseApi = inject(CourseApiService);
  private readonly offeringApi = inject(OfferingApiService);
  private readonly enrollmentApi = inject(EnrollmentApiService);
  private readonly certApi = inject(CertificateApiService);
  private readonly templateApi = inject(CertificateTemplateApiService);
  private readonly uploads = inject(UploadApiService);
  private readonly pdf = inject(PdfService);
  private readonly certPreview = inject(CertificatePreviewService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly loading = this.enrollmentApi.loading;
  readonly error = this.enrollmentApi.error;

  readonly offerings = this.offeringApi.offerings;
  readonly selectedOfferingId = signal('');
  readonly selectedOffering = computed(() => this.offerings().find((o) => o.id === this.selectedOfferingId()) ?? null);
  readonly passingPercent = computed(() => {
    const offering = this.selectedOffering();
    return offering ? this.coursePassingPercent(offering.courseId) : 80;
  });

  readonly activeTemplate = signal<ApiCertificateTemplate | null>(null);
  readonly templateLoaded = signal(false);

  private readonly issuedByUserId = computed(() => {
    const map = new Map<string, { id: string; certNo: string; templateId: string; issuedAt: string; fileUrl: string }>();
    this.certApi.certificates().forEach((c) =>
      map.set(c.userId, { id: c.id, certNo: c.certificateNo, templateId: c.templateId, issuedAt: c.issuedAt, fileUrl: c.fileUrl }),
    );
    return map;
  });

  private readonly rows = computed<CertRow[]>(() => {
    const issuedMap = this.issuedByUserId();
    const passing = this.passingPercent();

    return this.enrollmentApi.enrollments().map((e) => {
      const eligible = e.attendancePercent >= passing;
      const issuedInfo = issuedMap.get(e.userId);
      const issued = !!issuedInfo;

      return {
        userId: e.userId,
        name: e.name,
        email: e.email,
        pctLabel: `${e.attendancePercent}%`,
        pctValue: e.attendancePercent,
        eligible,
        eligibleLabel: eligible ? 'Eligible' : 'Not yet',
        eligibleColor: eligible ? 'var(--w-green)' : 'var(--w-muted)',
        issued,
        certId: issuedInfo?.id ?? '',
        certNo: issuedInfo?.certNo ?? '—',
        templateId: issuedInfo?.templateId ?? '',
        issuedAt: issuedInfo?.issuedAt ?? '',
        fileUrl: issuedInfo?.fileUrl ?? '',
        issueLabel: issued ? 'Issued' : eligible ? 'Ready to issue' : '—',
        actionIcon: issued ? '⤓' : eligible ? '◈' : '—',
        actionColor: issued || eligible ? 'var(--w-accent)' : '#c9bfa8',
      };
    });
  });

  readonly ctrl = new ListController<CertRow>(this.rows);

  constructor() {
    this.courseApi.load().subscribe();
    this.offeringApi.load().subscribe(() => {
      const first = this.offerings()[0]?.id ?? '';
      if (first) this.selectOffering(first);
    });
  }

  private coursePassingPercent(courseId: string): number {
    const course = this.courseApi.courses().find((c) => c.id === courseId);
    return course ? Number(course.passingAttendancePercent) : 80;
  }

  selectOffering(offeringId: string): void {
    this.selectedOfferingId.set(offeringId);
    if (!offeringId) return;
    this.enrollmentApi.load(offeringId).subscribe();
    this.certApi.load(offeringId).subscribe();

    this.templateLoaded.set(false);
    const offering = this.offerings().find((o) => o.id === offeringId) ?? null;
    this.templateApi.findActiveForBranch(offering?.branchId ?? null).subscribe({
      next: (template) => {
        this.activeTemplate.set(template);
        this.templateLoaded.set(true);
      },
      error: () => {
        this.activeTemplate.set(null);
        this.templateLoaded.set(true);
      },
    });
  }

  private showError(err: unknown, fallback: string): void {
    const message = (err as { error?: { message?: string } })?.error?.message ?? fallback;
    this.toast.show(message, 'error');
  }

  private issueOne(row: CertRow) {
    const offering = this.selectedOffering();
    const template = this.activeTemplate();
    if (!offering || !template) return of(false);

    const certificateNo = `WPI-CERT-${new Date().getFullYear()}-${Math.floor(Math.random() * 9000) + 1000}`;
    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return from(
      this.pdf.certificateFromTemplateDataUri({
        backgroundImageUrl: template.backgroundImageUrl,
        layoutConfig: template.layoutConfig,
        recipientName: row.name,
        courseLine: offering.courseTitle,
        certificateNo,
        issueDate,
      }),
    ).pipe(
      switchMap((dataUri) => this.uploads.uploadDataUri(dataUri)),
      switchMap((fileUrl) =>
        this.certApi.issue({ offeringId: offering.id, userId: row.userId, fileUrl, certificateNo }),
      ),
      map(() => true),
      catchError((err) => {
        this.showError(err, `Failed to issue certificate for ${row.name}.`);
        return of(false);
      }),
    );
  }

  viewCertificate(row: CertRow): void {
    const offering = this.selectedOffering();
    if (!offering) return;
    if (!row.templateId) {
      this.toast.show('This certificate predates template tracking and can’t be previewed — void it, then re-issue to enable preview.', 'error');
      return;
    }

    this.templateApi.getOne(row.templateId).subscribe({
      next: (template) => {
        const issueDate = row.issuedAt
          ? new Date(row.issuedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          : '';
        this.certPreview.ask(
          {
            backgroundImageUrl: template.backgroundImageUrl,
            layoutConfig: template.layoutConfig,
            recipientName: row.name,
            detailLine: offering.courseTitle,
            certificateNo: row.certNo,
            issueDate,
          },
          { title: `Certificate for ${row.name}`, confirmLabel: 'Close', viewOnly: true },
        );
      },
      error: (err) => this.showError(err, 'Failed to load the certificate template.'),
    });
  }

  async voidCertificate(row: CertRow): Promise<void> {
    if (!row.certId) return;
    const offering = this.selectedOffering();
    const confirmed = await this.confirm.ask(
      `Void the certificate for ${row.name}? You can issue a new one afterward.`,
      { title: 'Void certificate', confirmLabel: 'Void', danger: true },
    );
    if (!confirmed) return;

    this.certApi.remove(row.certId, offering?.id).subscribe({
      next: () => this.toast.show(`Certificate for ${row.name} voided.`, 'success'),
      error: (err) => this.showError(err, 'Failed to void certificate.'),
    });
  }

  toggle(row: CertRow): void {
    if (row.issued || !row.eligible) return;

    const offering = this.selectedOffering();
    const template = this.activeTemplate();
    if (!offering || !template) {
      this.toast.show('No active certificate template is configured for this branch — set one up in Certificate Templates.', 'error');
      return;
    }

    const issueDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    this.certApi.nextNumber().subscribe({
      next: ({ certificateNo }) => this.showIssuePreview(row, offering, template, certificateNo, issueDate),
      error: (err) => this.showError(err, 'Failed to reserve a certificate number.'),
    });
  }

  private showIssuePreview(
    row: CertRow,
    offering: ApiOffering,
    template: ApiCertificateTemplate,
    certificateNo: string,
    issueDate: string,
  ): void {
    this.certPreview
      .ask(
        {
          backgroundImageUrl: template.backgroundImageUrl,
          layoutConfig: template.layoutConfig,
          recipientName: row.name,
          detailLine: offering.courseTitle,
          certificateNo,
          issueDate,
        },
        { title: `Certificate for ${row.name}` },
      )
      .then(async (confirmed) => {
        if (!confirmed) return;

        const dataUri = await this.pdf.certificateFromTemplateDataUri({
          backgroundImageUrl: template.backgroundImageUrl,
          layoutConfig: template.layoutConfig,
          recipientName: row.name,
          courseLine: offering.courseTitle,
          certificateNo,
          issueDate,
        });

        this.uploads
          .uploadDataUri(dataUri)
          .pipe(
            switchMap((fileUrl) => this.certApi.issue({ offeringId: offering.id, userId: row.userId, fileUrl, certificateNo })),
            catchError((err) => {
              this.showError(err, `Failed to issue certificate for ${row.name}.`);
              return of(null);
            }),
          )
          .subscribe((res) => {
            if (res) this.toast.show(`Certificate issued to ${row.name}.`, 'success');
          });
      });
  }

  bulkIssue(): void {
    if (!this.activeTemplate()) {
      this.toast.show('No active certificate template is configured for this branch — set one up in Certificate Templates.', 'error');
      return;
    }

    const eligibleRows = this.rows().filter((r) => r.eligible && !r.issued);
    if (!eligibleRows.length) {
      this.toast.show('No newly eligible students to issue.', 'info');
      return;
    }

    from(eligibleRows)
      .pipe(
        concatMap((row) => this.issueOne(row)),
        map((ok) => (ok ? 1 : 0)),
      )
      .subscribe({
        next: () => {},
        complete: () => {
          this.toast.show(`Finished issuing certificates for ${eligibleRows.length} eligible student(s).`, 'success');
        },
      });
  }
}
