import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { MeApiService } from '../../../core/services/me-api.service';
import { QrCamera } from '../../../shared/qr-camera/qr-camera';

/**
 * QR codes just encode a bare event/session UUID with no type marker (see
 * api/src/events/attendance.controller.ts), so there's no way to tell from the scanned
 * value alone whether it's an event or a course session — try event check-in first, fall
 * back to a course session on failure.
 */
@Component({
  selector: 'app-qr-scan',
  imports: [QrCamera],
  templateUrl: './qr-scan.html',
  styleUrl: './qr-scan.scss',
})
export class QrScan implements OnDestroy {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly meApi = inject(MeApiService);

  readonly isNative = Capacitor.isNativePlatform();
  readonly checking = signal(false);
  readonly error = signal('');
  // @capacitor-mlkit/barcode-scanning only supports CocoaPods on iOS (no SPM build of
  // Google's ML Kit SDK exists) and this project is pure-SPM, so the native plugin isn't
  // linked into the iOS binary — BarcodeScanner.startScan() always throws there. Falling
  // back to the browser-based <app-qr-camera> (Shape Detection API) instead of a dead end;
  // that works from iOS 17 onward without touching the native project.
  readonly nativeFailed = signal(false);
  private handledOnce = false;
  private listenerHandle?: { remove: () => void | Promise<void> };

  constructor() {
    if (this.isNative) {
      void this.startNativeScan();
    }
  }

  ngOnDestroy(): void {
    if (this.isNative && !this.nativeFailed()) {
      void BarcodeScanner.stopScan();
      document.body.classList.remove('scanner-active');
      void this.listenerHandle?.remove();
    }
  }

  goBack(): void {
    this.location.back();
  }

  onWebDetected(value: string): void {
    void this.handleScanned(value);
  }

  private async startNativeScan(): Promise<void> {
    document.body.classList.add('scanner-active');
    try {
      this.listenerHandle = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        const barcode = event.barcodes[0];
        const value = barcode?.rawValue || barcode?.displayValue;
        if (value) void this.handleScanned(value);
      });
      await BarcodeScanner.startScan();
    } catch {
      document.body.classList.remove('scanner-active');
      void this.listenerHandle?.remove();
      this.listenerHandle = undefined;
      this.nativeFailed.set(true);
    }
  }

  private handleScanned(rawValue: string): void {
    if (this.handledOnce) return;
    this.handledOnce = true;
    this.checking.set(true);
    const id = rawValue.trim();

    this.meApi.checkinEvent(id).subscribe({
      next: (res) => this.onCheckinSuccess(res, 'event'),
      error: () => {
        this.meApi.checkinSession(id).subscribe({
          next: (res) => this.onCheckinSuccess(res, 'session'),
          error: () => {
            this.checking.set(false);
            this.error.set("That doesn't look like a valid Willpower Institute check-in code.");
            this.handledOnce = false;
          },
        });
      },
    });
  }

  private onCheckinSuccess(res: { title: string; alreadyCheckedIn: boolean }, type: 'event' | 'session'): void {
    this.checking.set(false);
    if (this.isNative && !this.nativeFailed()) void BarcodeScanner.stopScan();
    this.router.navigate(['/checkin/success'], {
      queryParams: { title: res.title, already: res.alreadyCheckedIn ? '1' : '', type },
    });
  }
}
