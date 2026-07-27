import { Component, inject } from '@angular/core';
import { ImageViewerService } from '../../core/services/image-viewer.service';

@Component({
  selector: 'app-photo-viewer',
  imports: [],
  templateUrl: './photo-viewer.html',
  styleUrl: './photo-viewer.scss',
})
export class PhotoViewer {
  readonly viewer = inject(ImageViewerService);

  close(): void {
    this.viewer.close();
  }
}
