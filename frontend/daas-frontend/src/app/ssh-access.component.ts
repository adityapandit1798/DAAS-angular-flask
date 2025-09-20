import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';

@Component({
  selector: 'app-ssh-access',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-container flex flex-col h-full">
      <h1 class="page-title">Container Console</h1>

      <!-- Connection Form Panel -->
      <div class="panel mb-4 flex-shrink-0">
        <div class="panel-title">Connection Details</div>
        <div class="p-4">
          <form #containerForm="ngForm" (ngSubmit)="connect()" class="flex flex-col md:flex-row md:flex-wrap md:items-end gap-4">
            <div class="flex-grow md:flex-grow" style="min-width: 300px;">
                <label for="containerId" class="label">Running Container</label>
                <select id="containerId" name="containerId" [(ngModel)]="containerConsoleDetails.containerId" required class="input w-full" [disabled]="isConnected">
                  <option value="" disabled>Select a container</option>
                  <option *ngFor="let c of runningContainers" [value]="c.id">{{ c.name }} ({{ c.id }})</option>
                </select>
            </div>
            <div class="flex-grow md:flex-grow" style="min-width: 200px;">
                <label for="command" class="label">Command</label>
                <input id="command" name="command" [(ngModel)]="containerConsoleDetails.command" class="input w-full font-mono" placeholder="/bin/sh or /bin/bash" [disabled]="isConnected">
            </div>
            <div class="md:self-end">
              <button *ngIf="!isConnected" type="submit" class="btn btn-success w-full md:w-auto" [disabled]="!containerForm.valid || isConnecting">
                  {{ isConnecting ? 'Connecting...' : 'Connect to Console' }}
                </button>
                <button *ngIf="isConnected" type="button" (click)="disconnect()" class="btn btn-danger w-full md:w-auto">
                  Disconnect
                </button>
            </div>
          </form>
        </div>
      </div>

      <!-- Terminal Panel -->
      <div class="panel flex-grow flex flex-col min-h-0 overflow-hidden">
        <div class="panel-title flex-shrink-0">Terminal</div>
        <div #terminal class="flex-grow bg-black w-full">
          <!-- This is where a library like xterm.js would attach -->
        </div>
      </div>
    </div>
  `,
})
export class SshAccessComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('terminal') private terminalEl!: ElementRef;

  isConnected = false;
  isConnecting = false;

  // Details for the SSH hop are still hardcoded as per the architecture
  // but are not displayed in the UI anymore.
  connectionDetails = { ip: '192.168.192.163', username: 'docker-user' };

  // Details for the container console form
  runningContainers: { id: string, name: string }[] = [];
  containerConsoleDetails = {
    containerId: '',
    command: '/bin/sh',
  };

  private term!: Terminal;
  private fitAddon!: FitAddon;
  private ws: WebSocket | undefined;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchRunningContainers();
  }

  ngAfterViewInit(): void {
    this.term = new Terminal({
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#000000',
        foreground: '#ffffff',
      },
    });

    this.fitAddon = new FitAddon();
    this.term.loadAddon(this.fitAddon);
    this.term.loadAddon(new WebLinksAddon());

    this.term.open(this.terminalEl.nativeElement);
    // We need a slight delay to allow the flexbox layout to stabilize before fitting.
    setTimeout(() => {
      this.fitAddon.fit();
    });
    window.addEventListener('resize', this.onResize);

    this.term.onData(data => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(data);
      }
    });

    this.term.onResize(size => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'resize', cols: size.cols, rows: size.rows }));
      }
    });

    this.term.writeln('Welcome to the Container Console.');
    this.term.writeln('Select a running container and click Connect.');
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.term?.dispose();
    window.removeEventListener('resize', this.onResize);
  }

  private onResize = () => this.fitAddon.fit();

  private fetchRunningContainers(): void {
    // This fetches from the main backend on port 5000 via the proxy
    this.http.get<{ id: string, name: string, state: string }[]>('/api/containers').subscribe({
      next: (containers) => {
        this.runningContainers = containers
          .filter(c => c.state === 'running')
          .map(c => ({ id: c.id, name: c.name }));
      },
      error: (err) => {
        console.error('Failed to fetch running containers:', err);
        this.term.writeln(`\r\n\x1b[31mError fetching running containers: ${err.message}\x1b[0m`);
      }
    });
  }

  disconnect() {
    this.ws?.close();
    this.isConnected = false;
    this.isConnecting = false;
  }

  connect() {
    if (this.isConnecting || this.isConnected) {
      return;
    }

    this.isConnecting = true;
    this.term.reset();
    this.term.writeln('🚀 Initializing console connection...');
    console.log('[SSH_DEBUG] connect() called.');

    // Connect to the separate SSH backend. Avoid hardcoded localhost; derive from window or overrides.
    const wsHost = localStorage.getItem('wsHost') || window.location.hostname;
    const wsPort = localStorage.getItem('wsPort') || '5002';
    const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProto}://${wsHost}:${wsPort}/ws`;
    console.log('[SSH_DEBUG] Computed WebSocket target', { wsHost, wsPort, wsProto, wsUrl });

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[SSH_DEBUG] WebSocket connection opened.');
      this.term.writeln('✅ WebSocket connected. Sending container details...');

      // Send container details to the test_backend
      const lsHost = localStorage.getItem('dockerHost');
      console.log('[SSH_DEBUG] localStorage.dockerHost =', lsHost);
      console.log('[SSH_DEBUG] this.connectionDetails.ip =', this.connectionDetails?.ip);
      const hostIp = lsHost || this.connectionDetails.ip;
      console.log('[SSH_DEBUG] Using hostIp =', hostIp);
      const payload = {
        containerId: this.containerConsoleDetails.containerId,
        command: this.containerConsoleDetails.command,
        hostIp,
        // Also send terminal dimensions
        cols: this.term.cols,
        rows: this.term.rows,
      };
      console.log('[SSH_DEBUG] Init payload →', payload);
      this.ws?.send(JSON.stringify(payload));
    };

    this.ws.onerror = (evt) => {
      console.error('[SSH_DEBUG] WebSocket error:', evt);
      this.term.writeln('❌ WebSocket error. See console for details.');
    };

    this.ws.onclose = (evt) => {
      console.warn('[SSH_DEBUG] WebSocket closed:', evt);
      this.term.writeln('🔌 WebSocket closed.');
      this.isConnecting = false;
      this.isConnected = false;
    };

    this.ws.onmessage = (event) => {
      console.log('[SSH_DEBUG] WebSocket message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        if (data.output) {
          // The first message from the backend means we are fully connected
          if (this.isConnecting) {
            this.isConnecting = false;
            this.isConnected = true;
          }
          this.term.write(data.output);
        } else if (data.error) {
          this.term.writeln(`\r\n\x1b[31mError: ${data.error}\x1b[0m`);
          this.disconnect();
        } else if (data.status) {
          this.term.writeln(`\r\n\x1b[33m${data.status}\x1b[0m`);
        }
      } catch (e) {
        this.term.write(event.data);
      }
    };

    this.ws.onclose = (event) => {
      console.log(`[SSH_DEBUG] WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.term.writeln(`\r\n\x1b[31mConnection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason'}\x1b[0m`);
      this.disconnect();
    };

    this.ws.onerror = (error) => {
      this.term.writeln('\r\n\x1b[31mWebSocket error. See browser console for details.\x1b[0m');
      console.error('WebSocket Error:', error);
      this.disconnect();
    };
  }
}