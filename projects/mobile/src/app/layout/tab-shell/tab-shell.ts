import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PullToRefreshService } from '../../core/services/pull-to-refresh.service';

const PULL_THRESHOLD = 60;
const PULL_MAX = 80;
const PULL_RESISTANCE = 0.5;

@Component({
  selector: 'app-tab-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './tab-shell.html',
  styleUrl: './tab-shell.scss',
})
export class TabShell {
  private readonly pullToRefresh = inject(PullToRefreshService);

  @ViewChild('tabContent') private readonly tabContentRef!: ElementRef<HTMLDivElement>;

  readonly pullDistance = signal(0);
  readonly refreshing = signal(false);
  readonly dragging = signal(false);

  private tracking = false;
  private startY = 0;

  onTouchStart(event: TouchEvent): void {
    if (this.refreshing()) return;
    if (this.tabContentRef.nativeElement.scrollTop > 0) {
      this.tracking = false;
      return;
    }
    this.tracking = true;
    this.startY = event.touches[0].clientY;
    this.dragging.set(true);
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.tracking || this.refreshing()) return;
    if (this.tabContentRef.nativeElement.scrollTop > 0) {
      this.tracking = false;
      this.pullDistance.set(0);
      return;
    }
    const dy = event.touches[0].clientY - this.startY;
    if (dy <= 0) {
      this.pullDistance.set(0);
      return;
    }
    this.pullDistance.set(Math.min(PULL_MAX, dy * PULL_RESISTANCE));
    event.preventDefault();
  }

  onTouchEnd(): void {
    this.dragging.set(false);
    if (!this.tracking) return;
    this.tracking = false;

    if (this.pullDistance() >= PULL_THRESHOLD) {
      this.refreshing.set(true);
      this.pullDistance.set(PULL_MAX * 0.6);
      void this.pullToRefresh.trigger().finally(() => {
        this.refreshing.set(false);
        this.pullDistance.set(0);
      });
    } else {
      this.pullDistance.set(0);
    }
  }
}
