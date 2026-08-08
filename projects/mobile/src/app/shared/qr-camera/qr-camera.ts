import { Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';
import jsQR from 'jsqr';

@Component({
  selector: 'app-qr-camera',
  templateUrl: './qr-camera.html',
  styleUrl: './qr-camera.scss',
})
export class QrCamera implements OnDestroy {
  readonly enabled = input(false);
  readonly detected = output<string>();

  // Requires only getUserMedia + <canvas> — both work in Capacitor's iOS WKWebView.
  // The Shape Detection API's BarcodeDetector this used previously is unreliable there:
  // it's undefined even on iOS versions/WKWebView builds where Safari itself supports it,
  // which left the QR check-in camera dead on real iPhones. jsQR decodes frames in pure
  // JS against a canvas, so it doesn't depend on that API being exposed at all.
  readonly supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  readonly error = signal('');

  private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private stream: MediaStream | null = null;
  private scanning = false;
  private canvas?: HTMLCanvasElement;
  private ctx?: CanvasRenderingContext2D;

  constructor() {
    effect(() => {
      const el = this.videoEl();
      if (el && this.enabled() && this.supported) {
        this.start(el.nativeElement);
      } else if (!this.enabled()) {
        this.stop();
      }
    });
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async start(video: HTMLVideoElement): Promise<void> {
    if (this.scanning) return;
    this.scanning = true;
    this.error.set('');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = this.stream;
      await video.play();

      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true }) ?? undefined;

      const loop = () => {
        if (!this.scanning) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA && this.ctx && this.canvas) {
          this.canvas.width = video.videoWidth;
          this.canvas.height = video.videoHeight;
          this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
          const frame = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const result = jsQR(frame.data, frame.width, frame.height);
          if (result) {
            this.detected.emit(result.data);
          }
        }
        if (this.scanning) requestAnimationFrame(loop);
      };
      loop();
    } catch {
      this.error.set('Camera unavailable.');
      this.scanning = false;
    }
  }

  private stop(): void {
    this.scanning = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.canvas = undefined;
    this.ctx = undefined;
  }
}
