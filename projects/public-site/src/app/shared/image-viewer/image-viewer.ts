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
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const next = this.scale() + (event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP);
    this.scale.set(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    if (this.scale() === MIN_SCALE) this.resetOffset();
  }

  onPointerDown(event: PointerEvent): void {
    if (this.scale() === MIN_SCALE) return;
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.offsetStartX = this.offsetX();
    this.offsetStartY = this.offsetY();
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    this.offsetX.set(this.offsetStartX + (event.clientX - this.dragStartX));
    this.offsetY.set(this.offsetStartY + (event.clientY - this.dragStartY));
  }

  onPointerUp(): void {
    this.dragging = false;
  }

  private resetOffset(): void {
    this.offsetX.set(0);
    this.offsetY.set(0);
  }
}
