import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

interface VolRow { Name: string; Driver: string; Mountpoint: string; Scope: string; CreatedAt: string; }

@Component({
  selector: 'app-volumes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1 class="page-title">Volumes</h1>

      <div class="panel">
        <div class="panel-title">Create Volume</div>
        <form class="grid" style="grid-template-columns: 1fr auto; gap: 10px; padding: 12px 16px;" (ngSubmit)="create()">
          <input class="input" placeholder="Volume Name" [(ngModel)]="name" name="Name" required />
          <button class="btn btn-success" [disabled]="creating">{{ creating ? 'Creating...' : 'Create Volume' }}</button>
        </form>
      </div>

      <div class="panel" style="margin-top:14px;">
        <div class="panel-title">All Volumes</div>
        <table class="info-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Driver</th>
              <th>Mount Point</th>
              <th>Scope</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let v of rows">
              <td>{{ v.Name }}</td>
              <td>{{ v.Driver }}</td>
              <td>{{ v.Mountpoint }}</td>
              <td>{{ v.Scope }}</td>
              <td>{{ v.CreatedAt }}</td>
              <td><button class="btn btn-danger" (click)="askDelete(v)">Delete</button></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button class="btn" style="margin-top:12px;" (click)="prune()">Prune Unused Volumes</button>

      <!-- Confirm delete modal -->
      <div *ngIf="confirmTarget" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="confirmTarget=null"></div>
        <div class="modal-card" style="max-width:460px;">
          <div class="modal-header">
            <div class="modal-title">Delete volume?</div>
            <button class="btn" (click)="confirmTarget=null">✕</button>
          </div>
          <div class="modal-body">Are you sure you want to delete <strong>{{ confirmTarget.Name }}</strong>?</div>
          <div class="modal-footer">
            <button class="btn" (click)="confirmTarget=null">Cancel</button>
            <button class="btn btn-danger" (click)="remove()" style="margin-left:8px;">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VolumesComponent {
  name = '';
  creating = false;
  rows: VolRow[] = [];
  confirmTarget: VolRow | null = null;

  constructor(private http: HttpClient) { this.refresh(); }

  refresh() {
    console.log('[Volumes] GET /api/volumes');
    this.http.get<VolRow[]>('/api/volumes').subscribe({
      next: (res) => { console.log('[Volumes] list response', res); this.rows = res || []; },
      error: (err) => { console.error('[Volumes] list error', err); }
    });
  }

  create() {
    if (!this.name) return;
    this.creating = true;
    console.log('[Volumes] POST /api/volumes', this.name);
    this.http.post('/api/volumes', { Name: this.name }).pipe(
      finalize(() => this.creating = false)
    ).subscribe({
      next: (res) => { console.log('[Volumes] create ok', res); this.name = ''; this.refresh(); },
      error: (err) => { console.error('[Volumes] create error', err); }
    });
  }

  askDelete(v: VolRow) { this.confirmTarget = v; }
  remove() {
    if (!this.confirmTarget) return;
    const name = this.confirmTarget.Name;
    console.log('[Volumes] DELETE /api/volumes/' + name);
    this.http.delete('/api/volumes/' + name).subscribe({
      next: (res) => { console.log('[Volumes] delete ok', res); this.confirmTarget = null; this.refresh(); },
      error: (err) => { console.error('[Volumes] delete error', err); this.confirmTarget = null; }
    });
  }

  prune() {
    console.log('[Volumes] POST /api/volumes/prune');
    this.http.post('/api/volumes/prune', {}).subscribe({
      next: (res) => { console.log('[Volumes] prune ok', res); this.refresh(); },
      error: (err) => { console.error('[Volumes] prune error', err); }
    });
  }
}
