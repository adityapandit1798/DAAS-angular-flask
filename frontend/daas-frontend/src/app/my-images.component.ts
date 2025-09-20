import { Component, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastService } from './toast.service';

interface ImageRow {
  repository: string;
  tag: string;
  id: string;
  createdAt: string;
  size: string;
}

@Component({
  selector: 'app-my-images',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container">
      <h1 class="page-title">My Images</h1>

      <div class="panel">
        <div class="panel-title">Pull Docker Image</div>
        <form class="grid" style="grid-template-columns: 1fr 220px; gap: 10px; padding: 12px 16px;" (ngSubmit)="onPull()">
          <div>
            <label class="label">Repository</label>
            <input type="text" class="input" placeholder="nginx, redis, mysql" [(ngModel)]="repo" name="repo" required />
          </div>
          <div>
            <label class="label">Tag</label>
            <input type="text" class="input" placeholder="latest" [(ngModel)]="tag" name="tag" />
          </div>
          <div>
            <button class="btn btn-success" [disabled]="pulling">
              <span *ngIf="pulling" class="spinner" aria-hidden="true"></span>
              {{ pulling ? 'Pulling...' : 'Pull Image' }}
            </button>
          </div>
        </form>
        <!-- Pull Progress UI -->
        <div *ngIf="pulling" class="px-4 pb-3">
          <div class="panel-title" style="margin:0; border:0; padding:8px 0;">Pull Progress</div>
          <div class="p-3 rounded-md bg-gray-900/50 space-y-2">
            <div *ngFor="let id of getPullLayerIds()" class="text-sm">
              <div class="flex justify-between items-center mb-1">
                <span class="font-mono text-gray-400 w-20 truncate" [title]="id">{{ id }}</span>
                <span class="text-gray-300 flex-grow text-center">{{ pullProgress[id].status }}</span>
              </div>
              <div *ngIf="pullProgress[id].current && pullProgress[id].total" class="w-full bg-gray-700 rounded-full h-2.5">
                <div class="bg-blue-600 h-2.5 rounded-full transition-all duration-300" [style.width.%]="(pullProgress[id].current! / pullProgress[id].total!) * 100"></div>
              </div>
              <div *ngIf="!pullProgress[id].current && pullProgress[id].progress" class="font-mono text-xs text-gray-500">
                {{ pullProgress[id].progress }}
              </div>
            </div>
            <!-- For general logs -->
            <pre *ngIf="logs.length" class="text-xs text-gray-400 pt-2 border-t border-gray-700 mt-2">{{ logs.join('\n') }}</pre>
          </div>
        </div>
      </div>

      <div class="panel" style="margin-top: 14px;">
        <table class="info-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Tag</th>
              <th>ID</th>
              <th>Created At</th>
              <th>Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let img of rows">
              <td>{{ img.repository }}</td>
              <td>{{ img.tag }}</td>
              <td>{{ img.id }}</td>
              <td>{{ img.createdAt }}</td>
              <td>{{ img.size }}</td>
              <td>
                <button class="btn btn-info" (click)="inspect(img)">Inspect</button>
                <button class="btn btn-danger" (click)="remove(img)" style="margin-left:6px;">Delete</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Inspect modal -->
      <div *ngIf="inspected" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="inspected=null"></div>
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">Inspect: {{ inspected?.RepoTags?.[0] || inspected?.Id }}</div>
            <button class="btn" (click)="inspected=null">✕</button>
          </div>
          <div class="modal-body">
            <div class="info-grid" style="display:grid; grid-template-columns: 220px 1fr;">
              <div class="label">Architecture</div><div>{{ inspected?.Architecture }}</div>
              <div class="label">OS</div><div>{{ inspected?.Os }}</div>
              <div class="label">Created</div><div>{{ inspected?.Created }}</div>
              <div class="label">Size</div><div>{{ inspected?.Size }}</div>
              <div class="label">Tags</div><div>{{ inspected?.RepoTags?.join(', ') }}</div>
              <div class="label">Digest</div><div>{{ inspected?.RepoDigests?.[0] }}</div>
              <div class="label">Entrypoint</div><div>{{ inspected?.Config?.Entrypoint?.join(' ') }}</div>
              <div class="label">Cmd</div><div>{{ inspected?.Config?.Cmd?.join(' ') }}</div>
              <div class="label">Exposed Ports</div><div>{{ inspected?.Config?.ExposedPorts ? (objectKeys(inspected?.Config?.ExposedPorts).join(', ')) : '—' }}</div>
            </div>
            <div style="margin-top:10px;">
              <div class="panel-title" style="border:0; padding:0 0 6px 0;">Raw JSON</div>
              <pre style="max-height:320px; overflow:auto; background:#0b1220; color:#e5e7eb; padding:12px; border-radius:6px;">{{ inspected | json }}</pre>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn" (click)="inspected=null">Close</button>
          </div>
        </div>
      </div>

      <!-- Confirm delete modal -->
      <div *ngIf="confirmTarget" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="confirmTarget=null"></div>
        <div class="modal-card" style="max-width:480px;">
          <div class="modal-header">
            <div class="modal-title">Delete image?</div>
            <button class="btn" (click)="confirmTarget=null">✕</button>
          </div>
          <div class="modal-body">
            Are you sure you want to delete
            <strong>{{ confirmTarget.repository }}:{{ confirmTarget.tag }}</strong> ({{ confirmTarget.id }})?
          </div>
          <div class="modal-footer">
            <button class="btn" (click)="confirmTarget=null">Cancel</button>
            <button class="btn btn-danger" (click)="confirmDelete()" style="margin-left:8px;">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class MyImagesComponent {
  repo = '';
  tag = 'latest';
  rows: ImageRow[] = [];
  pulling = false;
  logs: string[] = [];
  // New properties for progress bars
  pullProgress: { [id: string]: { status: string; progress?: string; current?: number; total?: number } } = {};
  pullLayerOrder: string[] = [];
  inspected: any = null;
  confirmTarget: ImageRow | null = null;
  private eventSource: EventSource | null = null;

  constructor(private http: HttpClient, private router: Router, private toast: ToastService, private zone: NgZone) {
    this.refresh();
  }

  refresh() {
    console.log('[MyImages] refresh → /api/my-images');
    this.http.get<any>('/api/my-images').subscribe({
      next: (res) => {
        console.log('[MyImages] images response', res);
        if (res?.error && String(res.error).includes('Not connected')) {
          this.handleNotConnected();
          return;
        }
        this.rows = res?.images || [];
      },
      error: (err) => {
        console.error('[MyImages] images error', err);
        const msg = err?.error?.error || err?.message || '';
        if (msg.includes('Not connected')) this.handleNotConnected();
      }
    });
  }

  onPull() {
    if (!this.repo) return;
    this.pulling = true;
    this.logs = [];
    this.pullProgress = {}; // Reset progress on new pull
    this.pullLayerOrder = []; // Reset
    
    // Clear any existing connection
    if (this.eventSource) {
      this.eventSource.close();
    }

    const url = `/api/pull-image?repository=${encodeURIComponent(this.repo)}&tag=${encodeURIComponent(this.tag || 'latest')}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      this.zone.run(() => {
        console.log('SSE connection opened.');
      });
    };

    this.eventSource.onmessage = (ev) => {
      this.zone.run(() => {
        try {
          console.log('Raw SSE data received:', ev.data); // Debug line
          
          // Handle the case where data contains escaped newlines
          let cleanData = ev.data;
          
          // If data contains escaped newlines, unescape them
          if (cleanData.includes('\\n')) {
            cleanData = cleanData.replace(/\\n/g, '\n');
          }
          
          // Check if this is a batch of messages (buffered)
          // Look for multiple JSON objects separated by newlines
          const lines = cleanData.split('\n');
          
          // Filter out empty lines and non-JSON lines with proper typing
          const jsonLines: string[] = lines.filter((line: string) => line.trim().startsWith('{'));
          
          console.log('Found', jsonLines.length, 'JSON lines');
          
          // If we have multiple JSON objects, process them sequentially with delays
          if (jsonLines.length > 1) {
            console.log('Detected buffered batch, processing sequentially...');
            this.processBufferedMessages(jsonLines, 0);
          } else {
            // Single message case - process normally
            this.processSingleMessage(cleanData);
          }
          
        } catch (e) {
          console.warn('Error processing SSE message', { data: ev.data, error: e });
        }
      });
    };

    this.eventSource.onerror = (e) => {
      this.zone.run(() => {
        console.error('SSE connection error occurred:', e);
        this.logs.push('Error: Connection to the server was lost.');
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }
        this.pulling = false;
        this.refresh();
      });
    };
  }

  processSingleMessage(rawData: string) {
    try {
      // Handle the case where we might have multiple JSON objects in one line
      // This happens when they're all batched together
      const cleaned = rawData.trim();
      if (cleaned.startsWith('{')) {
        const data = JSON.parse(cleaned);
        // Inline the handleMessage logic here instead of calling non-existent function
        if (data.status) {
          // For messages with progress details (like downloading layers)
          if (data.progressDetail && data.progressDetail.total !== undefined) {
            // Create a unique key for this progress update
            const key = data.id || data.status + Date.now() + Math.random(); // Unique key
            
            if (!this.pullProgress[key]) {
              this.pullLayerOrder.push(key);
              this.pullProgress[key] = { 
                status: data.status,
                current: data.progressDetail.current,
                total: data.progressDetail.total
              };
            } else {
              // Update existing
              this.pullProgress[key].status = data.status;
              this.pullProgress[key].current = data.progressDetail.current;
              this.pullProgress[key].total = data.progressDetail.total;
            }
            
            // Also add to logs for visibility
            if (data.progress) {
              this.logs.push(`${data.status}: ${data.progress}`);
            } else {
              this.logs.push(data.status);
            }
          } 
          // For simple status messages
          else if (!data.id) {
            this.logs.push(data.status);
          }
          // For messages with id but no progress detail
          else if (data.id && !data.progressDetail) {
            // Just add to logs for now
            this.logs.push(data.status);
          }
        }
      }
    } catch (e) {
      // If that fails, try to split by \n\n to handle batched JSON
      const parts = rawData.split('\n\n');
      for (const part of parts) {
        const trimmedPart = part.trim();
        if (trimmedPart.startsWith('{')) {
          try {
            const data = JSON.parse(trimmedPart);
            // Inline the handleMessage logic here instead of calling non-existent function
            if (data.status) {
              // For messages with progress details (like downloading layers)
              if (data.progressDetail && data.progressDetail.total !== undefined) {
                // Create a unique key for this progress update
                const key = data.id || data.status + Date.now() + Math.random(); // Unique key
                
                if (!this.pullProgress[key]) {
                  this.pullLayerOrder.push(key);
                  this.pullProgress[key] = { 
                    status: data.status,
                    current: data.progressDetail.current,
                    total: data.progressDetail.total
                  };
                } else {
                  // Update existing
                  this.pullProgress[key].status = data.status;
                  this.pullProgress[key].current = data.progressDetail.current;
                  this.pullProgress[key].total = data.progressDetail.total;
                }
                
                // Also add to logs for visibility
                if (data.progress) {
                  this.logs.push(`${data.status}: ${data.progress}`);
                } else {
                  this.logs.push(data.status);
                }
              } 
              // For simple status messages
              else if (!data.id) {
                this.logs.push(data.status);
              }
              // For messages with id but no progress detail
              else if (data.id && !data.progressDetail) {
                // Just add to logs for now
                this.logs.push(data.status);
              }
            }
          } catch (parseError) {
            console.warn('Could not parse batched message:', { part, error: parseError });
          }
        }
      }
    }
  }

processBufferedMessages(messages: string[], index: number) {
  if (index >= messages.length) {
    // If we get through all messages and haven't found a 'completed' status, close gracefully.
    if (this.eventSource) {
      this.eventSource.onerror = null;
      this.eventSource.close();
      this.eventSource = null;
      this.pulling = false;
      this.refresh();
    }
    return;
  }

  // Safety check - if connection is already closed, stop processing
  if (!this.eventSource || this.eventSource.readyState === EventSource.CLOSED) {
    return;
  }

  const message = messages[index].trim();
  if (message.startsWith('{')) {
    try {
      const data = JSON.parse(message);
      
      // Check if this is the final "completed" message
      if (data.status === 'completed') {
        this.logs.push('Pull completed successfully.');
        this.pulling = false;

        // Cleanly close the event source to prevent onerror firing
        if (this.eventSource) {
          this.eventSource.onerror = null; // Ignore any subsequent errors
          this.eventSource.close();
          this.eventSource = null;
        }

        // Small delay to ensure UI updates before refresh
        setTimeout(() => {
          this.refresh();
        }, 100);
        return; // Stop processing immediately
      }

      // Handle error case
      if (data.error) {
        this.logs.push('Error: ' + data.error);
        this.pullProgress = {};
        this.pullLayerOrder = [];
        this.pulling = false;
        setTimeout(() => {
          this.refresh();
        }, 100);
        return; // Stop processing immediately
      }

      // Handle regular Docker API messages
      if (data.status) {
        // For messages with progress details (like downloading layers)
        if (data.progressDetail && data.progressDetail.total !== undefined) {
          // Create a unique key for this progress update
          const key = data.id || data.status + Date.now() + Math.random(); // Unique key
          
          if (!this.pullProgress[key]) {
            this.pullLayerOrder.push(key);
            this.pullProgress[key] = { 
              status: data.status,
              current: data.progressDetail.current,
              total: data.progressDetail.total
            };
          } else {
            // Update existing
            this.pullProgress[key].status = data.status;
            this.pullProgress[key].current = data.progressDetail.current;
            this.pullProgress[key].total = data.progressDetail.total;
          }
          
          // Also add to logs for visibility
          if (data.progress) {
            this.logs.push(`${data.status}: ${data.progress}`);
          } else {
            this.logs.push(data.status);
          }
        } 
        // For simple status messages
        else if (!data.id) {
          this.logs.push(data.status);
        }
        // For messages with id but no progress detail
        else if (data.id && !data.progressDetail) {
          // Just add to logs for now
          this.logs.push(data.status);
        }
      }
    } catch (parseError) {
      console.warn('Could not parse buffered message:', { message, error: parseError });
    }
  }

  // Process next message after a small delay
  setTimeout(() => {
    this.processBufferedMessages(messages, index + 1);
  }, 10); // Very small delay
}

  inspect(img: ImageRow) {
    const ref = img.repository + ':' + img.tag;
    console.log('[MyImages] inspect', ref);
    this.http.get('/api/inspect-image', { params: { image: ref } }).subscribe({
      next: (res) => {
        this.inspected = res;
      },
      error: (err) => {
        const msg = err?.error?.error || err.message;
        if (String(msg).includes('Not connected')) return this.handleNotConnected();
        alert('Inspect failed: ' + msg);
      }
    });
  }

  remove(img: ImageRow) {
    this.confirmTarget = img;
  }

  confirmDelete() {
    if (!this.confirmTarget) return;
    const id = this.confirmTarget.id.replace('sha256:', '');
    this.http.post('/api/delete-image', null, { params: { id } }).subscribe({
      next: () => { this.confirmTarget = null; this.refresh(); },
      error: (err) => {
        this.confirmTarget = null;
        const msg = err?.error?.error || err.message;
        if (String(msg).includes('Not connected')) return this.handleNotConnected();
        alert('Delete failed: ' + msg);
      }
    });
  }

  private handleNotConnected() {
    try {
      localStorage.removeItem('dockerHostConnected');
      localStorage.removeItem('dockerHost');
      localStorage.removeItem('connectionMode');
    } catch {}
    this.toast.info('Session expired. Please reconnect.');
    this.router.navigateByUrl('/');
  }

  getPullLayerIds(): string[] {
    return this.pullLayerOrder;
  }

  objectKeys(obj: any): string[] { return obj ? Object.keys(obj) : []; }
}