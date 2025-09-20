import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container flex flex-col h-full">
      <h1 class="page-title">Container Logs</h1>

      <!-- Controls Panel -->
      <div class="panel mb-4 flex-shrink-0">
        <div class="p-4">
          <form #logForm="ngForm" (ngSubmit)="toggleLogStream()" class="flex flex-col md:flex-row md:items-end gap-4">
            <div class="flex-grow" style="min-width: 300px;">
              <label for="containerId" class="label">Container</label>
              <select id="containerId" name="containerId" [(ngModel)]="selectedContainerId" required class="input w-full" [disabled]="isStreaming">
                <option value="" disabled>Select a container to view logs</option>
                <option *ngFor="let c of allContainers" [value]="c.id">{{ c.name }} ({{ c.id }})</option>
              </select>
            </div>
            <div class="md:self-end">
              <button *ngIf="!isStreaming" type="submit" class="btn btn-primary w-full md:w-auto" [disabled]="!logForm.valid">
                Stream Logs
              </button>
              <button *ngIf="isStreaming" type="button" (click)="stopStreaming()" class="btn btn-danger w-full md:w-auto">
                Stop Streaming
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Log Display Panel -->
      <div class="panel flex-grow flex flex-col min-h-0 overflow-hidden">
        <div class="panel-title flex-shrink-0">Logs</div>
        <div #logContainer class="flex-grow bg-black text-white font-mono text-sm p-4 overflow-y-auto">
          <pre class="whitespace-pre-wrap">{{ logs || 'Select a container and click "Fetch Logs" to see output.' }}</pre>
        </div>
      </div>
    </div>
  `,
})
export class LogsComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('logContainer') private logContainer!: ElementRef;

  allContainers: { id: string, name: string }[] = [];
  selectedContainerId: string = '';
  logs: string = '';
  isStreaming = false;
  private eventSource: EventSource | null = null;
  private shouldScroll = true;

  constructor(private http: HttpClient, private zone: NgZone) {}

  ngOnInit(): void {
    this.fetchAllContainers();
  }

  ngOnDestroy(): void {
    this.stopStreaming();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private fetchAllContainers(): void {
    this.http.get<{ id: string, name: string }[]>('/api/containers').subscribe({
      next: (containers) => { this.allContainers = containers; },
      error: (err) => {
        console.error('Failed to fetch containers:', err);
        this.logs = `Error fetching containers: ${err.message}`;
      }
    });
  }

  private scrollToBottom(): void {
    try {
      this.logContainer.nativeElement.scrollTop = this.logContainer.nativeElement.scrollHeight;
    } catch (err) {}
  }

  toggleLogStream(): void {
    if (this.isStreaming) {
      this.stopStreaming();
    } else {
      this.fetchLogs();
    }
  }

  fetchLogs(): void {
    if (!this.selectedContainerId) return;

    this.stopStreaming(); // Ensure any previous stream is closed
    this.logs = 'Starting log stream...\n';
    this.isStreaming = true;

    const url = `/api/logs?container=${this.selectedContainerId}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      // Run the update inside Angular's zone to trigger change detection
      this.zone.run(() => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) {
            this.logs += `\n--- ERROR: ${data.error} ---\n`;
            this.stopStreaming();
          } else if (data.line) {
            this.logs += data.line + '\n';
            this.shouldScroll = true; // Trigger scroll on next check
          }
        } catch (e) {
          this.logs += `\n--- ERROR: Failed to parse log event ---\n`;
          this.stopStreaming();
        }
      });
    };

    this.eventSource.onerror = (error) => {
      this.zone.run(() => {
        this.logs += '\n--- Log stream disconnected. ---\n';
        this.stopStreaming();
      });
    };
  }

  stopStreaming(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isStreaming = false;
  }
}