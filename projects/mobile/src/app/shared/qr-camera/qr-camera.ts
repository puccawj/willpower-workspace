import { Component, ElementRef, OnDestroy, effect, input, output, signal, viewChild } from '@angular/core';

declare const BarcodeDetector: {
  new (options?: { formats: string[] }): {
    detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
  };
};

@Component({
  selector: 'app-qr-camera',
  templateUrl: './qr-camera.html',
  styleUrl: './qr-camera.scss',
})
export class QrCamera implements OnDestroy {
  readonly enabled = input(false);
  readonly detected = output<string>();

  readonly supported = typeof BarcodeDetector !== 'undefined';
  readonly error = signal('');

  private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private stream: MediaStream | null = null;
  private scanning = false;

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

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const loop = async () => {
        if (!this.scanning) return;
        try {
          const results = await detector.detect(video);
          if (results.length > 0) {
            this.detected.emit(results[0].rawValue);
          }
        } catch {
          // transient decode errors are expected between frames — ignore and keep scanning
        }
        if (this.scanning) requestAnimationFrame(() => void loop());
      };
      void loop();
    } catch {
      this.error.set('Camera unavailable.');
      this.scanning = false;
    }
  }

  private stop(): void {
    this.scanning = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
