import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatusBadgeComponent } from './status-badge.component';

describe('StatusBadgeComponent', () => {
  let fixture: ComponentFixture<StatusBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StatusBadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StatusBadgeComponent);
  });

  it('renders a label and modifier class per status', () => {
    for (const [status, label] of [
      ['scheduled', 'Scheduled'],
      ['completed', 'Completed'],
      ['cancelled', 'Cancelled'],
    ] as const) {
      fixture.componentInstance.status = status;
      fixture.detectChanges();

      const badge = (fixture.nativeElement as HTMLElement).querySelector('span');
      expect(badge?.textContent?.trim()).toBe(label);
      expect(badge?.className).toBe(`badge badge--${status}`);
    }
  });
});
