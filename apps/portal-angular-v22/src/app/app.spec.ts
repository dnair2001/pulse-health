import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { App } from './app';
import { provideTelemetryStub } from './testing/telemetry-stub';

describe('App', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideTelemetryStub()],
    });
  });

  it('renders the portal shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.shell__name')?.textContent).toContain('Pulse Health');
    expect(element.querySelector('.shell__link')?.textContent).toContain('Providers');
    expect(element.querySelector('[data-testid="patient-name"]')?.textContent).toContain(
      'Jordan Reyes',
    );
  });
});
