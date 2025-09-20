import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { AuthService, ConnectionData } from './services/auth.service';
import { finalize } from 'rxjs';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./app.component.css']
})
export class LoginComponent {
  isLoading = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  onSubmit(form: NgForm) {
    if (this.isLoading || !form.valid) return;

    this.isLoading = true;
    const data: ConnectionData = form.value;

    this.authService.connect(data).pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: (response) => {
        this.toast.success('Successfully connected to Docker host');
        console.log('[LoginComponent] Setting dockerHostConnected to true in localStorage.');
        localStorage.setItem('dockerHostConnected', 'true');
        localStorage.setItem('dockerHost', response.data.host);
        localStorage.setItem('connectionMode', response.data.mode);
        this.router.navigateByUrl('/dashboard');
      },
      error: (err) => {
        const errorMessage = err.error?.error || err.message || 'Unknown error';
        this.toast.error('Connection failed: ' + errorMessage);
        console.error('API Error:', err);
      }
    });
  }
}