import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';

interface NetRow { Id: string; Name: string; Driver: string; Scope: string; Created: string; Internal: boolean; }

@Component({
  selector: 'app-networks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1 class="page-title">Networks</h1>

      <div class="panel">
        <div class="panel-title">Create Network</div>
        <form class="grid" style="grid-template-columns: 1fr 220px auto; gap: 10px; padding: 12px 16px;" (ngSubmit)="create()">
          <input class="input" placeholder="Network Name" [(ngModel)]="name" name="Name" required />
          <select class="input" [(ngModel)]="driver" name="Driver">
            <option value="bridge">Bridge</option>
          </select>
          <button class="btn btn-success" [disabled]="creating">
            {{ creating ? 'Creating...' : 'Create Network' }}
          </button>
        </form>
      </div>

      <div class="panel" style="margin-top:14px;">
        <div class="panel-title">All Networks</div>
        <table class="info-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Driver</th>
              <th>Scope</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let n of rows">
              <td>{{ n.Name }}</td>
              <td>{{ n.Driver }}</td>
              <td>{{ n.Scope }}</td>
              <td>{{ n.Created | date:'dd/MM/yyyy, HH:mm:ss' }}</td>
              <td>
                <span *ngIf="isBuiltin(n)">Built-in</span>
                <button *ngIf="!isBuiltin(n)" class="btn btn-danger" (click)="confirmTarget=n">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Confirm delete modal -->
      <div *ngIf="confirmTarget" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="confirmTarget=null"></div>
        <div class="modal-card" style="max-width:460px;">
          <div class="modal-header">
            <div class="modal-title">Delete network?</div>
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
export class NetworksComponent {
  name = '';
  driver = 'bridge';
  creating = false;
  rows: NetRow[] = [];
  confirmTarget: NetRow | null = null;

  constructor(private http: HttpClient) { this.refresh(); }

  refresh() {
    this.http.get<any>('/api/networks').subscribe(res => { this.rows = res || []; });
  }

  create() {
    if (!this.name) return;
    this.creating = true;
    this.http.post('/api/networks', { Name: this.name, Driver: this.driver }).pipe(
      finalize(() => this.creating = false)
    ).subscribe({
      next: () => { this.name = ''; this.refresh(); },
      error: (err) => { console.error('[Networks] create error', err); }
    });
  }

  remove() {
    if (!this.confirmTarget) return;
    const id = this.confirmTarget.Id;
    this.http.delete('/api/networks/' + id).subscribe({
      next: () => { this.confirmTarget = null; this.refresh(); },
      error: () => { this.confirmTarget = null; }
    });
  }

  isBuiltin(n: NetRow) { return ['bridge', 'host', 'none'].includes(n.Name); }
}
