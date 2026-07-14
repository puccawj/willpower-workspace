import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';
import { Footer } from './layout/footer/footer';
import { InAppBrowserNotice } from './shared/in-app-browser-notice/in-app-browser-notice';
import { ToastHost } from './shared/toast-host/toast-host';
import { ConfirmDialog } from './shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, InAppBrowserNotice, ToastHost, ConfirmDialog],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
