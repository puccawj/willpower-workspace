import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Share } from '@capacitor/share';
import { AuthService } from '../../../core/services/auth.service';
import { MeApiService } from '../../../core/services/me-api.service';
import { BackButton } from '../../../shared/back-button/back-button';

@Component({
  selector: 'app-certificate-received',
  imports: [BackButton],
  templateUrl: './certificate-received.html',
  styleUrl: './certificate-received.scss',
})
export class CertificateReceived {
  private readonly route = inject(ActivatedRoute);
  private readonly meApi = inject(MeApiService);
  protected readonly auth = inject(AuthService);

  readonly certId = this.route.snapshot.paramMap.get('id')!;
  readonly downloading = signal(false);

  readonly certificate = computed(() => this.meApi.certificates().find((c) => c.id === this.certId) ?? null);

  constructor() {
    this.meApi.loadCertificates().subscribe();
  }

  async downloadPdf(): Promise<void> {
    const fileUrl = this.certificate()?.fileUrl;
    if (!fileUrl) return;
    this.downloading.set(true);
    try {
      await Browser.open({ url: fileUrl });
    } finally {
      this.downloading.set(false);
    }
  }

  async share(): Promise<void> {
    const cert = this.certificate();
    if (!cert) return;
    try {
      await Share.share({
        title: cert.courseTitle ?? 'My certificate',
        text: `I completed ${cert.courseTitle} at Willpower Institute!`,
        url: cert.fileUrl,
      });
    } catch {
      // user cancelled the native share sheet — nothing to do
    }
  }
}
