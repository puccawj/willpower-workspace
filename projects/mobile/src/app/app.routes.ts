import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { securityGateGuard } from './core/guards/security-gate.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'splash' },
  { path: 'splash', loadComponent: () => import('./pages/splash/splash').then((m) => m.Splash) },
  { path: 'introduction', loadComponent: () => import('./pages/introduction/introduction').then((m) => m.Introduction) },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  { path: 'register', loadComponent: () => import('./pages/register/register').then((m) => m.Register) },
  {
    path: 'security/set-pin',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/security/set-pin/set-pin').then((m) => m.SetPin),
  },
  {
    path: 'security/unlock',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/security/unlock/unlock').then((m) => m.Unlock),
  },
  {
    path: '',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./layout/tab-shell/tab-shell').then((m) => m.TabShell),
    children: [
      { path: 'home', loadComponent: () => import('./pages/home/home').then((m) => m.Home) },
      { path: 'events', loadComponent: () => import('./pages/events/event-list/event-list').then((m) => m.EventList) },
      { path: 'courses', loadComponent: () => import('./pages/courses/course-list/course-list').then((m) => m.CourseList) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile) },
      { path: 'profile/courses', loadComponent: () => import('./pages/profile/my-courses/my-courses').then((m) => m.MyCourses) },
      {
        path: 'profile/certificates',
        loadComponent: () => import('./pages/profile/my-certificates/my-certificates').then((m) => m.MyCertificates),
      },
      { path: 'profile/rsvps', loadComponent: () => import('./pages/profile/my-rsvps/my-rsvps').then((m) => m.MyRsvps) },
      {
        path: 'profile/donations',
        loadComponent: () => import('./pages/profile/my-donations/my-donations').then((m) => m.MyDonations),
      },
      {
        path: 'profile/apply-student',
        loadComponent: () => import('./pages/profile/apply-student/apply-student').then((m) => m.ApplyStudent),
      },
    ],
  },
  {
    path: 'events/:id',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/events/event-detail/event-detail').then((m) => m.EventDetail),
  },
  {
    path: 'courses/:id',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/courses/course-detail/course-detail').then((m) => m.CourseDetail),
  },
  {
    path: 'checkin/scan',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/checkin/qr-scan/qr-scan').then((m) => m.QrScan),
  },
  {
    path: 'checkin/success',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/checkin/checked-in/checked-in').then((m) => m.CheckedIn),
  },
  {
    path: 'attendance/:offeringId',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/attendance/attendance-stats/attendance-stats').then((m) => m.AttendanceStats),
  },
  {
    path: 'notifications',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () => import('./pages/notifications/notifications').then((m) => m.Notifications),
  },
  {
    path: 'certificate/:id',
    canActivate: [authGuard, securityGateGuard],
    loadComponent: () =>
      import('./pages/certificate/certificate-received/certificate-received').then((m) => m.CertificateReceived),
  },
  { path: '**', redirectTo: 'splash' },
];
