import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { AppComponent } from './app.component';
import { TelemetryService } from './core/observability/telemetry.service';

describe('AppComponent', () => {
  let telemetry: jasmine.SpyObj<TelemetryService>;

  beforeEach(async () => {
    telemetry = jasmine.createSpyObj<TelemetryService>('TelemetryService', [
      'reportEvent',
      'checkApiHealth',
    ]);

    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [RouterTestingModule],
      providers: [{ provide: TelemetryService, useValue: telemetry }],
    }).compileComponents();
  });

  it('creates the app shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('checks API health once at bootstrap', () => {
    TestBed.createComponent(AppComponent);
    expect(telemetry.checkApiHealth).toHaveBeenCalledTimes(1);
  });

  it('renders the Pulse Health brand and the signed-in patient', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.shell__name')?.textContent).toContain('Pulse Health');
    expect(element.querySelector('[data-testid="patient-name"]')?.textContent).toContain(
      'Jordan Reyes',
    );
  });
});
