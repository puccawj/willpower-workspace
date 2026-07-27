import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PhotoViewer } from './shared/photo-viewer/photo-viewer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, PhotoViewer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
