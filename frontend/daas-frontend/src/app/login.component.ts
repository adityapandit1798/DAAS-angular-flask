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

  // Drag-and-drop state
  caCertContent: string = '';
  clientCertContent: string = '';
  clientKeyContent: string = '';

  caCertName: string = '';
  clientCertName: string = '';
  clientKeyName: string = '';

  constructor(
    private authService: AuthService,
    private router: Router,
    private toast: ToastService
  ) {}

  onSubmit(form: NgForm) {
    if (this.isLoading || !form.valid) return;

    this.isLoading = true;
    const data: ConnectionData = {
      ...(form.value as any),
      caCert: this.caCertContent,
      clientCert: this.clientCertContent,
      clientKey: this.clientKeyContent,
    } as ConnectionData;

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

  // --- Drag & Drop / File Input handlers ---
  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  async onDrop(kind: 'caCert' | 'clientCert' | 'clientKey', event: DragEvent) {
    event.preventDefault();
    if (!event.dataTransfer || event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    const text = await file.text();
    this.assignFile(kind, file.name, text);
  }

  async onFileSelected(kind: 'caCert' | 'clientCert' | 'clientKey', event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const text = await file.text();
    this.assignFile(kind, file.name, text);
    // Clear the input so selecting the same file again still fires change
    input.value = '';
  }

  private assignFile(kind: 'caCert' | 'clientCert' | 'clientKey', name: string, content: string) {
    if (kind === 'caCert') { this.caCertName = name; this.caCertContent = content; }
    if (kind === 'clientCert') { this.clientCertName = name; this.clientCertContent = content; }
    if (kind === 'clientKey') { this.clientKeyName = name; this.clientKeyContent = content; }
  }

  isFormValid(): boolean {
    // hostIp is validated by the form; ensure files were provided
    return !!(this.caCertContent && this.clientCertContent && this.clientKeyContent);
  }
}