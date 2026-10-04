import { describe, it, expect } from 'vitest';
import {
  computeTargetInterval,
  intervalsOverlap,
  checkBusConflict,
  checkDriverConflict,
  checkConductorConflict
} from './scheduleConflicts';
import type { Trip, Bus, StaffMember } from '../types';

describe('scheduleConflicts', () => {
  const mockBus: Bus = {
    id: 101,
    registration: 'CLX-201',
    model: 'Volvo 9700',
    capacity: 40,
    type: 'Luxury AC',
    features: 'Wi-Fi',
    status: 'AVAILABLE'
  };

  const mockDriver: StaffMember = {
    id: 201,
    name: 'Binuri Herath',
    email: 'binuri@citylink.com',
    phone: '0712345678',
    role: 'DRIVER',
    status: 'ACTIVE',
    available: true,
    licenseNumber: 'B-74746467',
    duties: []
  };

  const mockConductor: StaffMember = {
    id: 301,
    name: 'Kasun Silva',
    email: 'kasun@citylink.com',
    phone: '+94771234569',
    role: 'CONDUCTOR',
    status: 'ACTIVE',
    available: true,
    licenseNumber: 'LK-CND-2003',
    duties: []
  };

  const overlappingTrip: Trip = {
    id: 42,
    routeId: 1,
    origin: 'Colombo',
    destination: 'Kandy',
    routeName: 'Hill Country Express',
    distanceKm: 115,
    bus: mockBus,
    driver: { id: 201, name: 'Binuri Herath' },
    conductor: { id: 301, name: 'Kasun Silva' },
    departure: '2026-10-02T08:00:00',
    arrival: '2026-10-02T10:45:00',
    durationMinutes: 165,
    fare: 1850,
    status: 'PUBLISHED',
    availableSeats: 40,
    delayMinutes: 0,
    gpsAvailable: false,
    driverAcknowledged: false,
    conductorAcknowledged: false,
    stops: []
  };

  it('correctly calculates target intervals and overlaps', () => {
    const window = computeTargetInterval('2026-10-02', '08:30', 120);
    expect(window).not.toBeNull();
    if (window) {
      expect(window.start.getHours()).toBe(8);
      expect(window.start.getMinutes()).toBe(30);
      expect(window.end.getHours()).toBe(10);
      expect(window.end.getMinutes()).toBe(30);
    }

    const startA = new Date(2026, 9, 2, 8, 0, 0);
    const endA = new Date(2026, 9, 2, 10, 45, 0);
    const startB = new Date(2026, 9, 2, 9, 0, 0);
    const endB = new Date(2026, 9, 2, 11, 0, 0);
    expect(intervalsOverlap(startA, endA, startB, endB)).toBe(true);

    const nonOverlapStart = new Date(2026, 9, 2, 11, 0, 0);
    const nonOverlapEnd = new Date(2026, 9, 2, 13, 0, 0);
    expect(intervalsOverlap(startA, endA, nonOverlapStart, nonOverlapEnd)).toBe(false);
  });

  it('detects bus conflict when overlapping an existing assigned journey', () => {
    const targetWindow = computeTargetInterval('2026-10-02', '08:00', 165);
    const conflict = checkBusConflict(mockBus, targetWindow, [overlappingTrip]);
    expect(conflict).not.toBeNull();
    expect(conflict?.tripId).toBe(42);
    expect(conflict?.reason).toContain('Coach CLX-201 is already assigned to Trip #42');
    expect(conflict?.reason).toContain('cannot be in two places at the same time');
  });

  it('detects driver conflict when overlapping an existing assigned journey', () => {
    const targetWindow = computeTargetInterval('2026-10-02', '08:00', 165);
    const conflict = checkDriverConflict(mockDriver, targetWindow, [overlappingTrip]);
    expect(conflict).not.toBeNull();
    expect(conflict?.tripId).toBe(42);
    expect(conflict?.reason).toContain('Driver Binuri Herath is already assigned to Trip #42');
    expect(conflict?.reason).toContain('cannot be in two places at the same time');
  });

  it('detects conductor conflict when overlapping an existing assigned journey', () => {
    const targetWindow = computeTargetInterval('2026-10-02', '08:00', 165);
    const conflict = checkConductorConflict(mockConductor, targetWindow, [overlappingTrip]);
    expect(conflict).not.toBeNull();
    expect(conflict?.tripId).toBe(42);
    expect(conflict?.reason).toContain('Conductor Kasun Silva is already assigned to Trip #42');
    expect(conflict?.reason).toContain('cannot be in two places at the same time');
  });

  it('ignores cancelled trips when checking conflicts', () => {
    const cancelledTrip = { ...overlappingTrip, status: 'CANCELLED' };
    const targetWindow = computeTargetInterval('2026-10-02', '08:00', 165);
    expect(checkBusConflict(mockBus, targetWindow, [cancelledTrip])).toBeNull();
    expect(checkDriverConflict(mockDriver, targetWindow, [cancelledTrip])).toBeNull();
    expect(checkConductorConflict(mockConductor, targetWindow, [cancelledTrip])).toBeNull();
  });

  it('ignores arrived and completed trips so bus, driver, and conductor are free for other trips', () => {
    const arrivedTrip = { ...overlappingTrip, status: 'ARRIVED' };
    const completedTrip = { ...overlappingTrip, status: 'COMPLETED' };
    const targetWindow = computeTargetInterval('2026-10-02', '08:00', 165);

    expect(checkBusConflict(mockBus, targetWindow, [arrivedTrip])).toBeNull();
    expect(checkDriverConflict(mockDriver, targetWindow, [arrivedTrip])).toBeNull();
    expect(checkConductorConflict(mockConductor, targetWindow, [arrivedTrip])).toBeNull();

    expect(checkBusConflict(mockBus, targetWindow, [completedTrip])).toBeNull();
    expect(checkDriverConflict(mockDriver, targetWindow, [completedTrip])).toBeNull();
    expect(checkConductorConflict(mockConductor, targetWindow, [completedTrip])).toBeNull();
  });

  it('returns no conflict for a different non-overlapping time slot', () => {
    const futureWindow = computeTargetInterval('2026-10-02', '14:00', 120);
    expect(checkBusConflict(mockBus, futureWindow, [overlappingTrip])).toBeNull();
    expect(checkDriverConflict(mockDriver, futureWindow, [overlappingTrip])).toBeNull();
    expect(checkConductorConflict(mockConductor, futureWindow, [overlappingTrip])).toBeNull();
  });
});
