import { google } from "googleapis";
import { getCalendarAuthedClient } from "./tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addDays,
  format,
  parseISO,
  isAfter,
  isBefore,
  setHours,
  setMinutes,
} from "date-fns";

interface WorkingHours {
  start: string; // "09:00"
  end: string; // "18:00"
  days: number[]; // ISO weekdays: 1=Mon, 7=Sun
}

interface TimeSlot {
  start: string; // ISO datetime
  end: string; // ISO datetime
}

export interface AvailabilityResult {
  date: string; // YYYY-MM-DD
  availableSlots: TimeSlot[];
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  start: "09:00",
  end: "18:00",
  days: [1, 2, 3, 4, 5, 6],
};

async function getWorkingHours(agentId: string): Promise<WorkingHours> {
  const supabase = createAdminClient() as any;
  const { data: agent } = await supabase
    .from("agents")
    .select("calendar_working_hours")
    .eq("id", agentId)
    .single();

  if (agent?.calendar_working_hours) {
    return {
      ...DEFAULT_WORKING_HOURS,
      ...(agent.calendar_working_hours as Partial<WorkingHours>),
    };
  }
  return DEFAULT_WORKING_HOURS;
}

async function getBusyTimes(
  agentId: string,
  timeMin: string,
  timeMax: string
): Promise<TimeSlot[]> {
  const auth = await getCalendarAuthedClient(agentId);
  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: "primary" }],
    },
  });

  const busy = res.data.calendars?.primary?.busy ?? [];
  return busy
    .filter(
      (b): b is { start: string; end: string } => !!b.start && !!b.end
    )
    .map((b) => ({ start: b.start!, end: b.end! }));
}

/**
 * Compute available time slots for an agent over a date range.
 * Subtracts busy times from working hours, returns slots of the given duration.
 */
export async function getAvailability(
  agentId: string,
  startDate: string,
  endDate: string,
  slotDurationMinutes: number = 30
): Promise<AvailabilityResult[]> {
  const workingHours = await getWorkingHours(agentId);
  const [startH, startM] = workingHours.start.split(":").map(Number);
  const [endH, endM] = workingHours.end.split(":").map(Number);

  const timeMin = new Date(`${startDate}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDate}T23:59:59`).toISOString();

  const busyTimes = await getBusyTimes(agentId, timeMin, timeMax);
  const results: AvailabilityResult[] = [];

  let current = parseISO(startDate);
  const end = parseISO(endDate);

  while (!isAfter(current, end)) {
    // Convert JS getDay (0=Sun) to ISO weekday (1=Mon, 7=Sun)
    const jsDay = current.getDay();
    const dayOfWeek = jsDay === 0 ? 7 : jsDay;

    if (workingHours.days.includes(dayOfWeek)) {
      const dayStart = setMinutes(setHours(current, startH), startM);
      const dayEnd = setMinutes(setHours(current, endH), endM);
      const dateStr = format(current, "yyyy-MM-dd");

      // Get busy intervals overlapping this day
      const dayBusy = busyTimes.filter((b) => {
        const bStart = parseISO(b.start);
        const bEnd = parseISO(b.end);
        return isBefore(bStart, dayEnd) && isAfter(bEnd, dayStart);
      });

      // Generate slots and filter out busy ones
      const slots: TimeSlot[] = [];
      let slotStart = dayStart;

      while (isBefore(slotStart, dayEnd)) {
        const slotEnd = new Date(
          slotStart.getTime() + slotDurationMinutes * 60 * 1000
        );
        if (isAfter(slotEnd, dayEnd)) break;

        const isAvailable = !dayBusy.some((b) => {
          const bStart = parseISO(b.start);
          const bEnd = parseISO(b.end);
          return isBefore(slotStart, bEnd) && isAfter(slotEnd, bStart);
        });

        if (isAvailable) {
          slots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
          });
        }

        slotStart = slotEnd;
      }

      results.push({ date: dateStr, availableSlots: slots });
    }

    current = addDays(current, 1);
  }

  return results;
}
