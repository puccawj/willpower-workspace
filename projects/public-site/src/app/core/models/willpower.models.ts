export type Branch = 'USA' | 'Canada' | 'Australia';
export type RsvpChoice = 'confirm' | 'maybe' | 'cancel';
export type DonateType = 'money' | 'goods';

export interface InstituteEvent {
  id: number;
  day: string;
  mon: string;
  img: string;
  dateFull: string;
  when: 'upcoming' | 'past';
  branch: Branch;
  title: string;
  blurb: string;
  time: string;
  location: string;
  capacity: number;
  going: number;
  body1: string;
  body2: string;
}

export interface Course {
  level: string;
  format: 'Onsite' | 'Online';
  img: string;
  title: string;
  desc: string;
  sessions: string;
  hours: string;
  pass: string;
  open: string;
}

export interface TeamMember {
  name: string;
  role: string;
  branch: Branch;
  img: string;
}

export interface TimelineEntry {
  year: string;
  title: string;
  desc: string;
}

export interface BranchInfo {
  name: string;
  city: string;
  img: string;
  desc: string;
}
