import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';
import { ToastService, ToastMessage } from './toast.service';

@Component({
  selector: 'app-toasts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 space-y-2 z-50">
      <div *ngFor="let t of toasts" [ngClass]="bgClass(t)" class="text-white px-4 py-3 rounded shadow">
        {{ t.text }}
      </div>
    </div>
  `
})
export class ToastComponent implements OnInit, OnDestroy {
  toasts: ToastMessage[] = [];
  sub?: Subscription;

  constructor(private toast: ToastService) {}

  ngOnInit() {
    this.sub = this.toast.messages$.subscribe(m => {
      this.toasts.push(m);
      timer(3000).subscribe(() => {
        const toastIndex = this.toasts.indexOf(m);
        if (toastIndex > -1) {
          this.toasts.splice(toastIndex, 1);
        }
      });
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  bgClass(t: ToastMessage) {
    if (t.type === 'success') return 'bg-green-600';
    if (t.type === 'error') return 'bg-red-600';
    return 'bg-gray-700';
  }
}
