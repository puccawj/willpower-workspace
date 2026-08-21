import { Component, inject, signal } from '@angular/core';
import { ImageViewerService } from '../../core/services/image-viewer.service';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SCALE_STEP = 0.5;

@Component({
  selector: 'app-image-viewer',
  imports: [],
  templateUrl: './image-viewer.html',
  styleUrl: './image-viewer.scss',
})
export class ImageViewer {
  readonly viewer = inject(ImageViewerService);

  readonly scale = signal(1);
  readonly offsetX = signal(0);
  readonly offsetY = signal(0);

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private offsetStartX = 0;
  private offsetStartY = 0;

  /** Tracks every finger currently down, keyed by pointerId — lets us tell a one-finger drag
   * apart from a two-finger pinch using the same Pointer Events (no separate touch handlers). */
  private readonly activePointers = new Map<number, { x: number; y: number }>();
  private pinchStartDist = 0;
  private pinchStartScale = 1;

  get canZoomIn(): boolean {
    return this.scale() < MAX_SCALE;
  }

  get canZoomOut(): boolean {
    return this.scale() > MIN_SCALE;
  }

  close(): void {
    this.viewer.close();
    this.reset();
  }

  zoomIn(): void {
    this.scale.set(Math.min(MAX_SCALE, this.scale() + SCALE_STEP));
    if (this.scale() === MIN_SCALE) this.resetOffset();
  }

  zoomOut(): void {
    this.scale.set(Math.max(MIN_SCALE, this.scale() - SCALE_STEP));
    if (this.scale() === MIN_SCALE) this.resetOffset();
  }

  reset(): void {
    this.scale.set(1);
    this.resetOffset();
    this.activePointers.clear();
    this.pinchStartDist = 0;
    this.dragging = false;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const next = this.scale() + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    if (this.scale() === MIN_SCALE) this.resetOffset();
  }

  onPointerDown(event: PointerEvent): void {
    // Capture failures (e.g. an already-released pointer) shouldn't stop the second finger of a
    // pinch from being tracked — losing capture just means we might not get move events outside
    // the element bounds, not that the gesture itself should be abandoned.
    try {
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
    this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.activePointers.size === 2) {
      this.dragging = false;
      this.pinchStartDist = this.distanceBetweenPointers();
      this.pinchStartScale = this.scale();
      return;
    }
    if (this.activePointers.size > 2) return;

    if (this.scale() === MIN_SCALE) return;
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.offsetStartX = this.offsetX();
    this.offsetStartY = this.offsetY();
  }

  onPointerMove(event: PointerEvent): void {
    if (this.activePointers.has(event.pointerId)) {
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (this.activePointers.size === 2) {
      const dist = this.distanceBetweenPointers();
      if (this.pinchStartDist > 0) {
        const next = this.pinchStartScale * (dist / this.pinchStartDist);
        this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
        if (this.scale() === MIN_SCALE) this.resetOffset();
      }
      return;
    }

    if (!this.dragging) return;
    this.offsetX.set(this.offsetStartX + (event.clientX - this.dragStartX));
    this.offsetY.set(this.offsetStartY + (event.clientY - this.dragStartY));
  }

  onPointerUp(event: PointerEvent): void {
    this.activePointers.delete(event.pointerId);
    if (this.activePointers.size < 2) this.pinchStartDist = 0;
    if (this.activePointers.size === 0) this.dragging = false;
  }

  private distanceBetweenPointers(): number {
    const points = [...this.activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  private resetOffset(): void {
    this.offsetX.set(0);
    this.offsetY.set(0);
  }
}
