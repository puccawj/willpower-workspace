import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { EventList } from './pages/events/event-list/event-list';
import { EventNeeds } from './pages/events/event-needs/event-needs';
import { Rsvp } from './pages/events/rsvp/rsvp';
import { RsvpOverview } from './pages/events/rsvp-overview/rsvp-overview';
import { Donations } from './pages/donations/donations';
import { Users } from './pages/users/users';
import { Branches } from './pages/branches/branches';
import { Courses } from './pages/courses/courses';
import { CourseNeeds } from './pages/courses/course-needs/course-needs';
import { Schedule } from './pages/schedule/schedule';
import { Enrollment } from './pages/enrollment/enrollment';
import { Certificates } from './pages/certificates/certificates';
import { Templates } from './pages/templates/templates';
import { Team } from './pages/team/team';
import { Reports } from './pages/reports/reports';
import { roleAccessGuard } from './core/guards/role-access.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: 'login', component: Login },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: Dashboard,
        canActivate: [roleAccessGuard],
        data: { title: 'Dashboard', subtitle: 'Overview of institute activity', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'events',
        component: EventList,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage Events', subtitle: 'Create, publish, and track event participation', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'rsvp/:id',
        component: Rsvp,
        canActivate: [roleAccessGuard],
        data: { title: 'RSVP & Attendance', subtitle: '', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'events/:id/needs',
        component: EventNeeds,
        canActivate: [roleAccessGuard],
        data: { title: 'Donation Needs', subtitle: 'Wishlist items for this event', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'rsvp',
        component: RsvpOverview,
        canActivate: [roleAccessGuard],
        data: { title: 'RSVP & Attendance', subtitle: 'Dashboard of RSVP and attendance across events', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'donations',
        component: Donations,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage Donation', subtitle: 'Review, verify, and issue anumodana certificates', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'users',
        component: Users,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage User', subtitle: 'All members across roles and branches', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'branches',
        component: Branches,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage Branch', subtitle: 'Institute locations and their status', allow: ['superadmin'] },
      },
      {
        path: 'courses',
        component: Courses,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage Course', subtitle: 'Subject templates and passing criteria', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'courses/:id/needs',
        component: CourseNeeds,
        canActivate: [roleAccessGuard],
        data: { title: 'Donation Needs', subtitle: 'Wishlist items for this course', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'schedule',
        component: Schedule,
        canActivate: [roleAccessGuard],
        data: { title: 'Class Schedule', subtitle: 'Course offerings and session calendar', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'enrollment',
        component: Enrollment,
        canActivate: [roleAccessGuard],
        data: { title: 'Enrollment & Attendance', subtitle: 'Session-by-session check-in and cumulative %', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'certificates',
        component: Certificates,
        canActivate: [roleAccessGuard],
        data: { title: 'Certificate Management', subtitle: 'Issue certificates to students who met the criteria', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'templates',
        component: Templates,
        canActivate: [roleAccessGuard],
        data: { title: 'Certificate Templates', subtitle: 'Upload backgrounds and design the layout', allow: ['superadmin'] },
      },
      {
        path: 'team',
        component: Team,
        canActivate: [roleAccessGuard],
        data: { title: 'Team Management', subtitle: "Manage who appears on the public Team page", allow: ['superadmin', 'admin'] },
      },
      {
        path: 'reports',
        component: Reports,
        canActivate: [roleAccessGuard],
        data: { title: 'Reports', subtitle: 'Export summaries by branch and time period', allow: ['superadmin', 'admin'] },
      },
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
];
