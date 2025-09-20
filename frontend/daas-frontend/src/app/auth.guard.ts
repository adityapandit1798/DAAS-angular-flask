import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { ToastService } from './toast.service';

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  const toast = inject(ToastService);
  const connected = localStorage.getItem('dockerHostConnected') === 'true';
  toast.info(`[AuthGuard] Checking auth. Connected: ${connected}`);
  if (!connected) {
    toast.error('[AuthGuard] Not connected. Redirecting.');
    router.navigateByUrl('/');
    return false;
  }
  return true;
};


