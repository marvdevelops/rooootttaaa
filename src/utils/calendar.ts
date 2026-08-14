import * as Calendar from 'expo-calendar';
import { Alert, Platform } from 'react-native';

async function getDefaultCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar.id;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.accessLevel === Calendar.CalendarAccessLevel.OWNER) ?? calendars[0];
  return writable?.id ?? null;
}

export async function addGroupRunToCalendar(params: {
  title: string;
  notes: string;
  startDate: Date;
  durationMinutes?: number;
  location?: string;
}) {
  const { title, notes, startDate, durationMinutes = 60, location } = params;

  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Calendar access needed', 'Enable calendar access in Settings to add this event.');
      return;
    }

    const calendarId = await getDefaultCalendarId();
    if (!calendarId) {
      Alert.alert('Error', 'No calendar available to add this event to.');
      return;
    }
    const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
    await Calendar.createEventAsync(calendarId, {
      title,
      notes,
      startDate,
      endDate,
      location,
    });
    Alert.alert('Added', 'Event added to your calendar.');
  } catch (e) {
    Alert.alert('Error', e instanceof Error ? e.message : 'Failed to add to calendar.');
  }
}
