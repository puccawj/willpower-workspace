import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { EventList } from './pages/events/event-list/event-list';
import { EventNeeds } from './pages/events/event-needs/event-needs';
import { EventPhotos } from './pages/events/event-photos/event-photos';
import { EventFeedback } from './pages/events/event-feedback/event-feedback';
import { Rsvp } from './pages/events/rsvp/rsvp';
import { RsvpOverview } from './pages/events/rsvp-overview/rsvp-overview';
import { Donations } from './pages/donations/donations';
import { Users } from './pages/users/users';
import { StudentApplications } from './pages/student-applications/student-applications';
import { Branches } from './pages/branches/branches';
import { Courses } from './pages/courses/courses';
import { CourseNeeds } from './pages/courses/course-needs/course-needs';
import { CoursePhotos } from './pages/courses/course-photos/course-photos';
import { CourseFeedback } from './pages/courses/course-feedback/course-feedback';
import { Enrollment } from './pages/enrollment/enrollment';
import { Certificates } from './pages/certificates/certificates';
import { CertificateRegistry } from './pages/certificate-registry/certificate-registry';
import { Templates } from './pages/templates/templates';
import { Team } from './pages/team/team';
import { Reports } from './pages/reports/reports';
import { Broadcast } from './pages/broadcast/broadcast';
import { AboutContentPage } from './pages/site-content/about-content/about-content';
import { PrivacyPolicyContentPage } from './pages/site-content/privacy-policy-content/privacy-policy-content';
import { HomeBanners } from './pages/site-content/home-banners/home-banners';
import { HomeHero } from './pages/site-content/home-hero/home-hero';
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
        path: 'broadcast',
        component: Broadcast,
        canActivate: [roleAccessGuard],
        data: { title: 'Broadcast', subtitle: 'Send announcements as in-app notifications', allow: ['superadmin', 'admin'] },
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
        path: 'events/:id/photos',
        component: EventPhotos,
        canActivate: [roleAccessGuard],
        data: { title: 'Event Photos', subtitle: 'Atmosphere photos for this event', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'events/:id/feedback',
        component: EventFeedback,
        canActivate: [roleAccessGuard],
        data: { title: 'Event Feedback', subtitle: 'Member star ratings and private notes for this event', allow: ['superadmin', 'admin'] },
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
        path: 'student-applications',
        component: StudentApplications,
        canActivate: [roleAccessGuard],
        data: { title: 'Student Applications', subtitle: 'Review "become a student" requests', allow: ['superadmin', 'admin'] },
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
        data: { title: 'Manage Branch', subtitle: 'Institute locations and their status', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'courses',
        component: Courses,
        canActivate: [roleAccessGuard],
        data: { title: 'Manage Course', subtitle: 'Subject templates — title, syllabus, sessions, prerequisites', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'courses/:id',
        loadComponent: () => import('./pages/course-overview/course-overview').then((m) => m.CourseOverview),
        canActivate: [roleAccessGuard],
        data: { title: 'Course Overview', subtitle: 'Course template details and every offering scheduled from it', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'courses/:id/offerings/:offeringId',
        loadComponent: () => import('./pages/offering-workspace/offering-workspace').then((m) => m.OfferingWorkspace),
        canActivate: [roleAccessGuard],
        data: { title: 'Offering Workspace', subtitle: 'Overview, sessions, and donation needs for this offering', allow: ['superadmin', 'admin', 'instructor'] },
      },
      {
        path: 'courses/:id/needs',
        component: CourseNeeds,
        canActivate: [roleAccessGuard],
        data: { title: 'Donation Needs', subtitle: 'Wishlist items for this course', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'courses/:id/photos',
        component: CoursePhotos,
        canActivate: [roleAccessGuard],
        data: { title: 'Course Photos', subtitle: 'Atmosphere photos for this course', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'courses/:id/feedback',
        component: CourseFeedback,
        canActivate: [roleAccessGuard],
        data: { title: 'Course Feedback', subtitle: 'Member star ratings and private notes across this course\'s offerings', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'schedule',
        loadComponent: () => import('./pages/all-offerings/all-offerings').then((m) => m.AllOfferings),
        canActivate: [roleAccessGuard],
        data: { title: 'All Offerings', subtitle: 'Every class offering across every course — sorted by course', allow: ['superadmin', 'admin', 'instructor'] },
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
        path: 'certificate-registry',
        component: CertificateRegistry,
        canActivate: [roleAccessGuard],
        data: { title: 'Certificate Registry', subtitle: 'Every certificate number issued, to whom, and its status', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'templates',
        component: Templates,
        canActivate: [roleAccessGuard],
        data: { title: 'Certificate Templates', subtitle: 'Upload backgrounds and design the layout', allow: ['superadmin'] },
      },
      {
        path: 'home-hero',
        component: HomeHero,
        canActivate: [roleAccessGuard],
        data: { title: 'Home Hero', subtitle: 'Edit the tagline, heading, description, and stats row on the public-site Home page', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'home-banners',
        component: HomeBanners,
        canActivate: [roleAccessGuard],
        data: { title: 'Home Banners', subtitle: 'Carousel images shown at the top of the public-site Home page', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'about-content',
        component: AboutContentPage,
        canActivate: [roleAccessGuard],
        data: { title: 'About Page', subtitle: 'Edit hero text, banner carousel, and the "Our journey" timeline', allow: ['superadmin', 'admin'] },
      },
      {
        path: 'privacy-policy-content',
        component: PrivacyPolicyContentPage,
        canActivate: [roleAccessGuard],
        data: { title: 'Privacy Policy', subtitle: 'Edit the Privacy Policy shown on the public website', allow: ['superadmin', 'admin'] },
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
