import { Injectable, signal } from '@angular/core';
import {
  AdminEvent,
  AdminUser,
  Attendee,
  BranchInfo,
  CertStudent,
  CertTemplate,
  ClassSession,
  Course,
  Donation,
  Enrollment,
  Offering,
  TeamMember,
} from '../models/admin.models';

@Injectable({ providedIn: 'root' })
export class AdminDataService {
  readonly events = signal<AdminEvent[]>([
    { id: 1, title: 'Morning Meditation Retreat', branch: 'USA', location: 'Main Hall, Los Angeles', dateFull: 'Mon, Jul 14, 2026 · 8:00 AM', dateShort: 'Jul 14', capacity: 60, going: 41, maybe: 9, cancel: 4, waitlist: 0, status: 'Published' },
    { id: 2, title: 'Dhamma Talk & Community Meal', branch: 'Canada', location: 'Community Room, Toronto', dateFull: 'Tue, Jul 22, 2026 · 6:30 PM', dateShort: 'Jul 22', capacity: 80, going: 52, maybe: 14, cancel: 6, waitlist: 0, status: 'Published' },
    { id: 3, title: 'Foundations of Willpower', branch: 'Australia', location: 'Lecture Hall, Sydney', dateFull: 'Sun, Aug 3, 2026 · 10:00 AM', dateShort: 'Aug 3', capacity: 100, going: 37, maybe: 22, cancel: 3, waitlist: 0, status: 'Scheduled' },
    { id: 4, title: 'Weekend Silent Retreat', branch: 'USA', location: 'Retreat Grounds, California', dateFull: 'Mon, Aug 17, 2026 · All day', dateShort: 'Aug 17', capacity: 40, going: 40, maybe: 2, cancel: 1, waitlist: 6, status: 'Published' },
    { id: 5, title: 'Youth Mindfulness Evening', branch: 'Canada', location: 'Community Room, Toronto', dateFull: 'Fri, Aug 29, 2026 · 5:00 PM', dateShort: 'Aug 29', capacity: 50, going: 18, maybe: 5, cancel: 2, waitlist: 0, status: 'Draft' },
    { id: 6, title: 'Founders’ Day Ceremony', branch: 'Australia', location: 'Lecture Hall, Sydney', dateFull: 'Fri, Jun 20, 2026 · 9:00 AM', dateShort: 'Jun 20', capacity: 120, going: 118, maybe: 0, cancel: 2, waitlist: 0, status: 'Closed' },
  ]);

  readonly attendees = signal<Attendee[]>([
    { id: 'p1', name: 'Somchai Pattana', rsvp: 'confirm' },
    { id: 'p2', name: 'Linda Wu', rsvp: 'confirm' },
    { id: 'p3', name: 'Marcus Green', rsvp: 'confirm' },
    { id: 'p4', name: 'Priya Raman', rsvp: 'maybe' },
    { id: 'p5', name: 'David Chen', rsvp: 'confirm' },
    { id: 'p6', name: 'Anong Suksri', rsvp: 'confirm' },
    { id: 'p7', name: 'Kevin O’Brien', rsvp: 'maybe' },
    { id: 'p8', name: 'Grace Tan', rsvp: 'cancel' },
  ]);

  readonly checkin = signal<Record<string, boolean>>({ p1: true, p2: true, p3: false, p4: true, p5: false, p6: true, p7: false, p8: false });

  readonly donations = signal<Donation[]>([
    { id: 'd1', donor: 'Somchai Pattana', anon: false, type: 'Money', amount: '$250.00', branch: 'USA', event: 'Morning Meditation Retreat', certNo: 'WPI-US-2026-0182' },
    { id: 'd2', donor: 'Anonymous', anon: true, type: 'Money', amount: '$100.00', branch: 'Canada', event: 'Dhamma Talk & Community Meal', certNo: null },
    { id: 'd3', donor: 'Grace Tan', anon: false, type: 'Goods', amount: '10 kg rice', branch: 'Australia', event: 'Founders’ Day Ceremony', certNo: 'WPI-AU-2026-0044' },
    { id: 'd4', donor: 'Marcus Green', anon: false, type: 'Money', amount: '$500.00', branch: 'USA', event: 'Weekend Silent Retreat', certNo: null },
    { id: 'd5', donor: 'Linda Wu', anon: false, type: 'Goods', amount: '20 blankets', branch: 'Canada', event: '—', certNo: null },
    { id: 'd6', donor: 'Anonymous', anon: true, type: 'Money', amount: '$1,000.00', branch: 'USA', event: '—', certNo: 'WPI-US-2026-0183' },
    { id: 'd7', donor: 'Priya Raman', anon: false, type: 'Money', amount: '$75.00', branch: 'Australia', event: 'Foundations of Willpower', certNo: null },
    { id: 'd8', donor: 'David Chen', anon: false, type: 'Goods', amount: 'Cooking oil, 5 cases', branch: 'Canada', event: '—', certNo: null },
  ]);

  readonly donationStatus = signal<Record<string, 'pending' | 'received' | 'verified' | 'rejected'>>({
    d1: 'verified', d2: 'pending', d3: 'verified', d4: 'received', d5: 'pending', d6: 'verified', d7: 'received', d8: 'pending',
  });

  readonly donationCert = signal<Record<string, boolean>>({ d1: true, d3: false, d6: true });

  readonly users = signal<AdminUser[]>([
    { id: 'u1', name: 'Somchai Pattana', role: 'Student', branch: 'USA', email: 'somchai.p@mail.com' },
    { id: 'u2', name: 'Ajahn Suriya', role: 'Instructor', branch: 'USA', email: 'suriya@willpower.org' },
    { id: 'u3', name: 'Grace Tan', role: 'Student', branch: 'Australia', email: 'grace.tan@mail.com' },
    { id: 'u4', name: 'Dr. Mala Chen', role: 'Instructor', branch: 'Canada', email: 'mala.chen@willpower.org' },
    { id: 'u5', name: 'Priya Nair', role: 'Admin', branch: 'USA', email: 'priya.n@willpower.org' },
    { id: 'u6', name: 'Kevin O’Brien', role: 'Student', branch: 'Canada', email: 'kevin.ob@mail.com' },
    { id: 'u7', name: 'David Okafor', role: 'Instructor', branch: 'Canada', email: 'david.o@willpower.org' },
    { id: 'u8', name: 'Linda Wu', role: 'Student', branch: 'USA', email: 'linda.wu@mail.com' },
  ]);

  readonly userStatus = signal<Record<string, 'active' | 'suspended' | 'pending'>>({
    u1: 'active', u2: 'active', u3: 'suspended', u4: 'active', u5: 'active', u6: 'pending', u7: 'active', u8: 'suspended',
  });

  readonly branches = signal<BranchInfo[]>([
    { key: 'usa', name: 'United States', city: 'Los Angeles', adminCount: 3, userCount: 412, eventCount: 18 },
    { key: 'canada', name: 'Canada', city: 'Toronto', adminCount: 2, userCount: 268, eventCount: 12 },
    { key: 'australia', name: 'Australia', city: 'Sydney', adminCount: 1, userCount: 154, eventCount: 7 },
  ]);

  readonly branchStatus = signal<Record<string, boolean>>({ usa: true, canada: true, australia: true });

  readonly courses = signal<Course[]>([
    { title: 'Introduction to Meditation', category: 'Foundations', sessions: 8, hours: 16, pass: '80%', status: 'Active' },
    { title: 'The Path of Willpower', category: 'Intermediate', sessions: 12, hours: 30, pass: '80%', status: 'Active' },
    { title: 'Contemplative Study Circle', category: 'Online', sessions: 10, hours: 20, pass: '75%', status: 'Active' },
    { title: 'Teachers in Training', category: 'Advanced', sessions: 16, hours: 48, pass: '90%', status: 'Active' },
  ]);

  readonly offerings = signal<Offering[]>([
    { course: 'The Path of Willpower', branch: 'USA', instructor: 'Ajahn Suriya', dates: 'Jun 3 – Aug 19', capacity: 24, enrolled: 22, mode: 'Onsite', status: 'Ongoing' },
    { course: 'The Path of Willpower', branch: 'Canada', instructor: 'Dr. Mala Chen', dates: 'Jun 10 – Aug 26', capacity: 20, enrolled: 18, mode: 'Onsite', status: 'Ongoing' },
    { course: 'Introduction to Meditation', branch: 'Australia', instructor: 'Ven. Ananda', dates: 'Jul 1 – Jul 29', capacity: 30, enrolled: 30, mode: 'Onsite', status: 'Scheduled' },
    { course: 'Contemplative Study Circle', branch: 'USA', instructor: 'Priya Nair', dates: 'May 5 – Jul 14', capacity: 40, enrolled: 33, mode: 'Online', status: 'Completed' },
    { course: 'Teachers in Training', branch: 'USA', instructor: 'Ajahn Suriya', dates: 'Sep 1 – Dec 15', capacity: 12, enrolled: 5, mode: 'Onsite', status: 'Draft' },
  ]);

  readonly sessions = signal<ClassSession[]>([
    { day: '01', mon: 'JUN', topic: 'Breath & posture fundamentals', time: '7:00–9:00 PM', location: 'Main Hall', status: 'done' },
    { day: '08', mon: 'JUN', topic: 'Working with distraction', time: '7:00–9:00 PM', location: 'Main Hall', status: 'done' },
    { day: '15', mon: 'JUN', topic: 'Cultivating steady attention', time: '7:00–9:00 PM', location: 'Main Hall', status: 'done' },
    { day: '15', mon: 'JUL', topic: 'Willpower in daily life', time: '7:00–9:00 PM', location: 'Main Hall', status: 'today' },
    { day: '22', mon: 'JUL', topic: 'Working with resistance', time: '7:00–9:00 PM', location: 'Main Hall', status: 'upcoming' },
  ]);

  readonly enrollments = signal<Enrollment[]>([
    { id: 's1', name: 'Somchai Pattana', enrolledDate: 'Jun 3, 2026', pct: 92 },
    { id: 's2', name: 'Linda Wu', enrolledDate: 'Jun 3, 2026', pct: 88 },
    { id: 's3', name: 'Marcus Green', enrolledDate: 'Jun 4, 2026', pct: 65 },
    { id: 's4', name: 'Priya Raman', enrolledDate: 'Jun 5, 2026', pct: 100 },
    { id: 's5', name: 'David Chen', enrolledDate: 'Jun 5, 2026', pct: 50 },
    { id: 's6', name: 'Anong Suksri', enrolledDate: 'Jun 6, 2026', pct: 83 },
    { id: 's7', name: 'Kevin O’Brien', enrolledDate: 'Jun 8, 2026', pct: 75 },
    { id: 's8', name: 'Grace Tan', enrolledDate: 'Jun 9, 2026', pct: 42 },
  ]);

  readonly sessionAttendance = signal<Record<string, boolean>>({ s1: true, s2: true, s3: false, s4: true, s5: false, s6: true, s7: true, s8: false });

  readonly certStudents = signal<CertStudent[]>([
    { id: 'c1', name: 'Somchai Pattana', pct: 92, certNo: 'WPI-US-CERT-0512' },
    { id: 'c2', name: 'Linda Wu', pct: 88, certNo: '—' },
    { id: 'c3', name: 'Priya Raman', pct: 100, certNo: 'WPI-US-CERT-0513' },
    { id: 'c4', name: 'Anong Suksri', pct: 83, certNo: '—' },
    { id: 'c5', name: 'Kevin O’Brien', pct: 75, certNo: '—' },
    { id: 'c6', name: 'Marcus Green', pct: 65, certNo: '—' },
    { id: 'c7', name: 'David Chen', pct: 50, certNo: '—' },
    { id: 'c8', name: 'Grace Tan', pct: 42, certNo: '—' },
  ]);

  readonly certIssued = signal<Record<string, boolean>>({ c1: true, c2: false, c3: true, c4: false, c5: false, c6: false, c7: false, c8: false });

  readonly templates = signal<CertTemplate[]>([
    { id: 't1', name: '2026 Certificate — Classic Gold', type: 'Certificate', year: '2026', bg: 'linear-gradient(135deg,#c6a24a,#8a5a2e)', sampleNo: 'WPI-US-CERT-0512' },
    { id: 't2', name: '2026 Anumodana — Money', type: 'Donation (Money)', year: '2026', bg: 'linear-gradient(135deg,#b85a3c,#5a2c1a)', sampleNo: 'WPI-US-2026-0183' },
    { id: 't3', name: '2025 Certificate — Sage', type: 'Certificate', year: '2025', bg: 'linear-gradient(135deg,#95975a,#3c3c24)', sampleNo: 'WPI-US-CERT-0311' },
  ]);

  readonly templateStatus = signal<Record<string, boolean>>({ t1: true, t2: true, t3: false });

  readonly team = signal<TeamMember[]>([
    { name: 'Ajahn Suriya', role: 'Director & Senior Teacher', branch: 'USA', shown: 'Yes' },
    { name: 'Dr. Mala Chen', role: 'Head of Curriculum', branch: 'Canada', shown: 'Yes' },
    { name: 'Ven. Ananda', role: 'Resident Teacher', branch: 'Australia', shown: 'Yes' },
    { name: 'Priya Nair', role: 'Instructor', branch: 'USA', shown: 'Yes' },
    { name: 'David Okafor', role: 'Instructor', branch: 'Canada', shown: 'Yes' },
    { name: 'Sarah Whitfield', role: 'Community Coordinator', branch: 'Australia', shown: 'No' },
  ]);
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter((w) => w[0] !== '’')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

const AVATAR_COLORS = ['#a94b2c', '#b98a32', '#7c9068', '#8a5a2e', '#5a6b8a', '#9c6a8a'];

export function avatarColorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
