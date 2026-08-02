import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Appointment } from '../../../core/models';
import { AppointmentsService } from './appointments.service';

const APPOINTMENT: Appointment = {
  id: 'apt_001',
  providerId: 'prv_001',
  provider: {
    id: 'prv_001',
    name: 'Dr. Alice Nguyen',
    specialty: 'Primary Care',
    locationName: 'Pulse Health Downtown',
  },
  slotId: 'slt_001',
  startsAt: '2099-01-05T09:00:00Z',
  endsAt: '2099-01-05T09:30:00Z',
  status: 'scheduled',
  visitType: 'in_person',
  reason: 'Annual physical',
  cancellable: true,
  createdAt: '2099-01-01T00:00:00Z',
  updatedAt: '2099-01-01T00:00:00Z',
};

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AppointmentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests appointments with scope and repeated filter params', () => {
    service
      .list({ scope: 'upcoming', status: ['scheduled'], visitType: ['video', 'phone'] })
      .subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/appointments');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('scope')).toBe('upcoming');
    expect(request.request.params.getAll('status')).toEqual(['scheduled']);
    expect(request.request.params.getAll('visitType')).toEqual(['video', 'phone']);
    request.flush([APPOINTMENT]);
  });

  it('omits filter params that are not set', () => {
    service.list({ scope: 'past' }).subscribe();

    const request = httpMock.expectOne((candidate) => candidate.url === '/api/appointments');
    expect(request.request.params.has('status')).toBeFalse();
    expect(request.request.params.has('visitType')).toBeFalse();
    expect(request.request.params.has('providerId')).toBeFalse();
    request.flush([]);
  });

  it('fetches a single appointment', () => {
    service.getById('apt_001').subscribe((appointment) => expect(appointment).toEqual(APPOINTMENT));

    const request = httpMock.expectOne('/api/appointments/apt_001');
    expect(request.request.method).toBe('GET');
    request.flush(APPOINTMENT);
  });

  it('posts a new appointment', () => {
    const body = {
      providerId: 'prv_001',
      slotId: 'slt_001',
      visitType: 'in_person' as const,
      reason: 'Annual physical',
    };

    service.schedule(body).subscribe();

    const request = httpMock.expectOne('/api/appointments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(APPOINTMENT);
  });

  it('patches an appointment to reschedule it', () => {
    service.reschedule('apt_001', { slotId: 'slt_999' }).subscribe();

    const request = httpMock.expectOne('/api/appointments/apt_001');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ slotId: 'slt_999' });
    request.flush({ ...APPOINTMENT, slotId: 'slt_999' });
  });

  it('posts to the cancel endpoint', () => {
    service.cancel('apt_001').subscribe();

    const request = httpMock.expectOne('/api/appointments/apt_001/cancel');
    expect(request.request.method).toBe('POST');
    request.flush({ ...APPOINTMENT, status: 'cancelled', cancellable: false });
  });
});
