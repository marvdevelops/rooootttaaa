export type RecurrenceFrequency = 'weekly' | 'biweekly' | 'monthly';

export interface RecurringSeries {
  id: string;
  hostId: string;
  routeId: string;
  clubId: string | null;
  title: string;
  description: string;
  frequency: RecurrenceFrequency;
  startTime: string;
  seriesStartDate: string;
  seriesEndDate: string | null;
  isActive: boolean;
}
