import { Trip, Bus, StaffMember } from '../types';

export interface ConflictDetails {
  tripId: number;
  routeName: string;
  departure: string;
  arrival: string;
  timeWindow: string;
  resourceType: 'Coach' | 'Driver' | 'Conductor';
  resourceName: string;
  reason: string;
}

/**
 * Robust local date-time parser for ISO-like strings ("YYYY-MM-DDTHH:mm:ss")
 * Prevents UTC timezone skew issues.
 */
export function parseDateTime(dtStr: string | any): Date {
  if (!dtStr) return new Date();
  if (dtStr instanceof Date) return dtStr;
  const str = String(dtStr).trim();
  const clean = str.replace('Z', '').split('.')[0];
  const sep = clean.includes('T') ? 'T' : (clean.includes(' ') ? ' ' : '');
  if (sep) {
    const parts = clean.split(sep);
    if (parts.length === 2) {
      const [y, m, d] = parts[0].split('-').map(Number);
      const [hr, min, sec] = parts[1].split(':').map(Number);
      if (y && m && d) {
        return new Date(y, m - 1, d, hr || 0, min || 0, sec || 0);
      }
    }
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Format a Date to "hh:mm A" (e.g., "08:00 AM")
 */
export function formatTimeAmPm(date: Date): string {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  const hrStr = hours < 10 ? '0' + hours : hours;
  return `${hrStr}:${minStr} ${ampm}`;
}

/**
 * Format date to short "MM/DD" (e.g. "10/02")
 */
export function formatDateShort(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}/${d}`;
}

/**
 * Format window like "08:00 AM - 10:45 AM"
 */
export function formatTripWindow(start: Date, end: Date): string {
  return `${formatTimeAmPm(start)} - ${formatTimeAmPm(end)}`;
}

/**
 * Compute the target window [targetStart, targetEnd] from date string (YYYY-MM-DD),
 * time string (HH:mm), and duration in minutes.
 */
export function computeTargetInterval(
  dateStr: string,
  timeStr: string,
  durationMinutes: number = 120
): { start: Date; end: Date } | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hr, min] = timeStr.split(':').map(Number);
  if (!y || !m || !d || hr === undefined || min === undefined || isNaN(hr) || isNaN(min)) return null;

  const start = new Date(y, m - 1, d, hr, min, 0);
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60000);
  return { start, end };
}

/**
 * Check if two time intervals [startA, endA] and [startB, endB] overlap.
 * Backend definition: departure < :end and arrival > :start
 */
export function intervalsOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}

/**
 * Check if a trip or duty has concluded or been cancelled (ARRIVED, COMPLETED, CANCELLED).
 * Once a journey arrives or is cancelled, its coach, driver, and conductor are freed up
 * and available for other assignments.
 */
export function isTripReleased(status?: string | null): boolean {
  if (!status) return false;
  const s = String(status).toUpperCase().trim();
  return s === 'ARRIVED' || s === 'COMPLETED' || s === 'CANCELLED';
}

/**
 * Check if a bus has a conflict with any overlapping trip in the given window.
 */
export function checkBusConflict(
  bus: Bus,
  window: { start: Date; end: Date } | null,
  allTrips: Trip[],
  excludeTripId?: number
): ConflictDetails | null {
  if (!window || !bus) return null;

  for (const t of allTrips) {
    if (isTripReleased(t.status) || (excludeTripId && t.id === excludeTripId)) continue;
    if (!t.bus) continue;

    const isMatch = t.bus.id === bus.id || (
      t.bus.registration && bus.registration &&
      t.bus.registration.trim().toLowerCase() === bus.registration.trim().toLowerCase()
    );

    if (isMatch) {
      const tStart = parseDateTime(t.departure);
      const tEnd = t.arrival
        ? parseDateTime(t.arrival)
        : new Date(tStart.getTime() + (t.durationMinutes || 120) * 60000);

      if (intervalsOverlap(window.start, window.end, tStart, tEnd)) {
        const timeWindow = `${formatDateShort(tStart)} ${formatTripWindow(tStart, tEnd)}`;
        const routeName = t.routeName || (t.origin && t.destination ? `${t.origin} ➔ ${t.destination}` : 'Assigned Route');
        return {
          tripId: t.id,
          routeName,
          departure: t.departure,
          arrival: t.arrival,
          timeWindow,
          resourceType: 'Coach',
          resourceName: bus.registration,
          reason: `Coach ${bus.registration} is already assigned to Trip #${t.id} (${routeName}, ${timeWindow}). A bus cannot be in two places at the same time.`
        };
      }
    }
  }

  return null;
}

/**
 * Check if a driver has a conflict with any overlapping trip or duty in the given window.
 */
export function checkDriverConflict(
  driver: StaffMember,
  window: { start: Date; end: Date } | null,
  allTrips: Trip[],
  excludeTripId?: number
): ConflictDetails | null {
  if (!window || !driver) return null;

  // 1. Check trips
  for (const t of allTrips) {
    if (isTripReleased(t.status) || (excludeTripId && t.id === excludeTripId)) continue;
    if (!t.driver) continue;

    const isMatch = t.driver.id === driver.id || (
      t.driver.name && driver.name &&
      t.driver.name.trim().toLowerCase() === driver.name.trim().toLowerCase()
    );

    if (isMatch) {
      const tStart = parseDateTime(t.departure);
      const tEnd = t.arrival
        ? parseDateTime(t.arrival)
        : new Date(tStart.getTime() + (t.durationMinutes || 120) * 60000);

      if (intervalsOverlap(window.start, window.end, tStart, tEnd)) {
        const timeWindow = `${formatDateShort(tStart)} ${formatTripWindow(tStart, tEnd)}`;
        const routeName = t.routeName || (t.origin && t.destination ? `${t.origin} ➔ ${t.destination}` : 'Assigned Route');
        return {
          tripId: t.id,
          routeName,
          departure: t.departure,
          arrival: t.arrival,
          timeWindow,
          resourceType: 'Driver',
          resourceName: driver.name,
          reason: `Driver ${driver.name} is already assigned to Trip #${t.id} (${routeName}, ${timeWindow}). A driver cannot be in two places at the same time.`
        };
      }
    }
  }

  // 2. Check embedded duties on staff
  if (driver.duties && Array.isArray(driver.duties)) {
    for (const d of driver.duties) {
      if (isTripReleased(d.status) || (excludeTripId && d.id === excludeTripId)) continue;
      const dStart = parseDateTime(d.departure);
      const dEnd = d.arrival ? parseDateTime(d.arrival) : new Date(dStart.getTime() + 120 * 60000);
      if (intervalsOverlap(window.start, window.end, dStart, dEnd)) {
        const timeWindow = `${formatDateShort(dStart)} ${formatTripWindow(dStart, dEnd)}`;
        return {
          tripId: d.id,
          routeName: d.route || 'Assigned Duty',
          departure: d.departure,
          arrival: d.arrival,
          timeWindow,
          resourceType: 'Driver',
          resourceName: driver.name,
          reason: `Driver ${driver.name} is already assigned to Trip #${d.id} (${d.route || 'Assigned Duty'}, ${timeWindow}). A driver cannot be in two places at the same time.`
        };
      }
    }
  }

  return null;
}

/**
 * Check if a conductor has a conflict with any overlapping trip or duty in the given window.
 */
export function checkConductorConflict(
  conductor: StaffMember,
  window: { start: Date; end: Date } | null,
  allTrips: Trip[],
  excludeTripId?: number
): ConflictDetails | null {
  if (!window || !conductor) return null;

  // 1. Check trips
  for (const t of allTrips) {
    if (isTripReleased(t.status) || (excludeTripId && t.id === excludeTripId)) continue;
    if (!t.conductor) continue;

    const isMatch = t.conductor.id === conductor.id || (
      t.conductor.name && conductor.name &&
      t.conductor.name.trim().toLowerCase() === conductor.name.trim().toLowerCase()
    );

    if (isMatch) {
      const tStart = parseDateTime(t.departure);
      const tEnd = t.arrival
        ? parseDateTime(t.arrival)
        : new Date(tStart.getTime() + (t.durationMinutes || 120) * 60000);

      if (intervalsOverlap(window.start, window.end, tStart, tEnd)) {
        const timeWindow = `${formatDateShort(tStart)} ${formatTripWindow(tStart, tEnd)}`;
        const routeName = t.routeName || (t.origin && t.destination ? `${t.origin} ➔ ${t.destination}` : 'Assigned Route');
        return {
          tripId: t.id,
          routeName,
          departure: t.departure,
          arrival: t.arrival,
          timeWindow,
          resourceType: 'Conductor',
          resourceName: conductor.name,
          reason: `Conductor ${conductor.name} is already assigned to Trip #${t.id} (${routeName}, ${timeWindow}). A conductor cannot be in two places at the same time.`
        };
      }
    }
  }

  // 2. Check embedded duties on staff
  if (conductor.duties && Array.isArray(conductor.duties)) {
    for (const d of conductor.duties) {
      if (isTripReleased(d.status) || (excludeTripId && d.id === excludeTripId)) continue;
      const dStart = parseDateTime(d.departure);
      const dEnd = d.arrival ? parseDateTime(d.arrival) : new Date(dStart.getTime() + 120 * 60000);
      if (intervalsOverlap(window.start, window.end, dStart, dEnd)) {
        const timeWindow = `${formatDateShort(dStart)} ${formatTripWindow(dStart, dEnd)}`;
        return {
          tripId: d.id,
          routeName: d.route || 'Assigned Duty',
          departure: d.departure,
          arrival: d.arrival,
          timeWindow,
          resourceType: 'Conductor',
          resourceName: conductor.name,
          reason: `Conductor ${conductor.name} is already assigned to Trip #${d.id} (${d.route || 'Assigned Duty'}, ${timeWindow}). A conductor cannot be in two places at the same time.`
        };
      }
    }
  }

  return null;
}
