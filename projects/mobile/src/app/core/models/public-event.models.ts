export interface PublicEvent {
  id: string;
  img: string;
  day: string;
  mon: string;
  dateFull: string;
  when: 'upcoming' | 'live' | 'past';
  branchId: string;
  branch: string;
  rsvpCutoffAt: string | null;
  title: string;
  blurb: string;
  time: string;
  location: string;
  capacity: number;
  going: number;
  body1: string;
  body2: string;
}
