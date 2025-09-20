import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { catchError, throwError } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((err: any) => {
      console.error('[Interceptor] HTTP Error:', err);
      try {
        const message = err?.error?.error || err?.message || '';
        console.log('[Interceptor] Error message:', message);
        if (typeof message === 'string' && message.includes('Not connected')) {
          console.log('[Interceptor] "Not connected" error detected. Redirecting to login.');
          try {
            localStorage.removeItem('dockerHostConnected');
            localStorage.removeItem('dockerHost');
            localStorage.removeItem('connectionMode');
          } catch {}
          toast.info('Session ended. Please reconnect to a Docker host.');
          router.navigateByUrl('/');
        }
      } catch (e) {
        console.error('[Interceptor] Error within catchError block:', e);
      }
      return throwError(() => err);
    })
  );
};
