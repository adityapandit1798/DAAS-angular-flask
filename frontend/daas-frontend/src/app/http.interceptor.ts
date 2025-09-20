import { HttpEvent, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';
import { catchError, throwError, tap } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const toast = inject(ToastService);
  console.debug('[HTTP] →', req.method, req.urlWithParams, { headers: req.headers, body: req.body });
  return next(req).pipe(
    tap({
      next: (event: HttpEvent<any>) => {
        // Successful events include sent, response, etc.
        // Avoid noisy logs for very frequent events if desired
        console.debug('[HTTP] ← OK', req.method, req.urlWithParams);
      }
    }),
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
