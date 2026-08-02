import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export type NotificationVariant = 'success' | 'error' | 'info';

export interface Notification {
  variant: NotificationVariant;
  text: string;
}

/** Carries one-off banners across route changes, e.g. after scheduling succeeds. */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly notification = new BehaviorSubject<Notification | null>(null);

  get notification$(): Observable<Notification | null> {
    return this.notification.asObservable();
  }

  success(text: string): void {
    this.notification.next({ variant: 'success', text });
  }

  error(text: string): void {
    this.notification.next({ variant: 'error', text });
  }

  clear(): void {
    this.notification.next(null);
  }
}
