import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http'; // Import HttpClient
import { FormsModule } from '@angular/forms'; // Import FormsModule for ngModel

interface ContainerListItem {
  id: string;
  name: string;
}

@Component({
  selector: 'app-container-stats',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule], // Add FormsModule
  template: `
    <div class="container mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-3xl font-bold text-gray-800">
          Container Stats
        </h2>
        <a routerLink="/dashboard/containers" class="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded transition duration-300 ease-in-out">
          Back to Containers
        </a>
      </div>

      <div class="mb-6">
        <label for="container-select" class="block text-gray-700 text-sm font-bold mb-2">Select Container:</label>
        <select id="container-select"
                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                [(ngModel)]="selectedContainerId"
                (change)="onContainerSelect($event)">
          <option [value]="null" disabled>-- Select a Container --</option>
          <option *ngFor="let container of availableContainers" [value]="container.id">{{ container.name }} ({{ container.id }})</option>
        </select>
      </div>

      <div *ngIf="error" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
        <strong class="font-bold">Error:</strong>
        <span class="block sm:inline">{{ error }}</span>
      </div>

      <!-- Display for single container stats -->
      <div *ngIf="selectedContainerId" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- CPU Usage -->
        <div class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-blue-500">
          <h3 class="text-xl font-semibold text-gray-700 mb-4">CPU Usage</h3>
          <div class="relative pt-1">
            <div class="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-blue-200">
              <div [style.width.%]="cpuPercent" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"></div>
            </div>
          </div>
          <p class="text-3xl font-bold text-gray-800 text-center">{{ cpuPercent | number:'1.2-2' }}%</p>
        </div>

        <!-- Memory Usage -->
        <div class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-green-500">
          <h3 class="text-xl font-semibold text-gray-700 mb-4">Memory Usage</h3>
          <div class="relative pt-1">
            <div class="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-green-200">
              <div [style.width.%]="memPercent" class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500 transition-all duration-500 ease-out"></div>
            </div>
          </div>
          <div class="text-center">
            <p class="text-3xl font-bold text-gray-800">{{ memPercent | number:'1.2-2' }}%</p>
            <p class="text-sm text-gray-500">({{ memUsage | number:'1.0-0' }} MB / {{ memLimit | number:'1.0-0' }} MB)</p>
          </div>
        </div>

        <!-- Network I/O -->
        <div class="bg-white rounded-xl shadow-lg p-6 border-t-4 border-purple-500">
          <h3 class="text-xl font-semibold text-gray-700 mb-4">Network I/O</h3>
          <div class="flex justify-around text-center">
            <div>
              <p class="text-sm text-gray-500">Received</p>
              <p class="text-2xl font-bold text-gray-800">{{ networkRx | number:'1.2-2' }} <span class="text-base font-normal">MB</span></p>
            </div>
            <div>
              <p class="text-sm text-gray-500">Transmitted</p>
              <p class="text-2xl font-bold text-gray-800">{{ networkTx | number:'1.2-2' }} <span class="text-base font-normal">MB</span></p>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="!selectedContainerId && availableContainers.length === 0 && !error" class="text-center py-8 text-gray-500">
        <p>Loading containers...</p>
      </div>
      <div *ngIf="!selectedContainerId && availableContainers.length > 0 && !error" class="text-center py-8 text-gray-500">
        <p>Please select a container from the dropdown above to view its stats.</p>
      </div>
    </div>
  `,
})
export class ContainerStatsComponent implements OnInit, OnDestroy {
  selectedContainerId: string | null = null;
  availableContainers: ContainerListItem[] = [];
  private eventSource: EventSource | null = null;

  // For single container stats
  cpuPercent: number = 0;
  memUsage: number = 0;
  memLimit: number = 0;
  memPercent: number = 0;
  networkRx: number = 0;
  networkTx: number = 0;

  error: string | null = null;

  constructor(private route: ActivatedRoute, private cdr: ChangeDetectorRef, private http: HttpClient) {} // Inject HttpClient

  ngOnInit(): void {
    console.log('[ContainerStats] ngOnInit');
    this.fetchAvailableContainers(); // Fetch list of containers first

    // Check if a container ID was passed in the route (e.g., from Containers list)
    const routeContainerId = this.route.snapshot.paramMap.get('id');
    if (routeContainerId) {
      this.selectedContainerId = routeContainerId;
      console.log('[ContainerStats] Initial Container ID from route:', this.selectedContainerId);
      this.connectToStatsStream(this.selectedContainerId);
    } else {
      console.log('[ContainerStats] No initial Container ID from route. User will select from dropdown.');
    }
  }

  ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null; // Clear eventSource
    }
  }

  fetchAvailableContainers(): void {
    this.http.get<any[]>('/api/containers').subscribe({
      next: (data) => {
        this.availableContainers = data.map(c => ({ id: c.id, name: c.name }));
        // If no container was pre-selected from route, and there are containers, select the first one
        if (!this.selectedContainerId && this.availableContainers.length > 0) {
          this.selectedContainerId = this.availableContainers[0].id;
          this.connectToStatsStream(this.selectedContainerId);
        }
      },
      error: (err) => {
        const errorMessage = err.error?.details || err.message || 'Failed to fetch containers list.';
        this.error = errorMessage;
        console.error('Error fetching available containers:', err);
      }
    });
  }

  onContainerSelect(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const containerId = selectElement.value;
    console.log('[ContainerStats] Container selected:', containerId);
    if (containerId) {
      this.selectedContainerId = containerId;
      this.connectToStatsStream(this.selectedContainerId);
    } else {
      this.selectedContainerId = null;
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      // Clear displayed stats when no container is selected
      this.cpuPercent = 0;
      this.memUsage = 0;
      this.memLimit = 0;
      this.memPercent = 0;
      this.networkRx = 0;
      this.networkTx = 0;
      this.error = null;
    }
  }

  private connectToStatsStream(containerId: string): void {
    if (this.eventSource) {
      this.eventSource.close(); // Close existing connection
    }
    console.log('[ContainerStats] Connecting to stats stream for container:', containerId);
    this.error = null; // Clear previous errors

    this.eventSource = new EventSource(`/api/containers/${containerId}/stats`);

    this.eventSource.onopen = (event) => {
      console.log('[ContainerStats] EventSource connection opened successfully.');
      this.error = null; // Clear previous errors on a successful connection
      this.cdr.detectChanges();
    };

    this.eventSource.onmessage = (event) => {
      const stats = JSON.parse(event.data);
      
      if (stats.error) {
        console.error('Stats stream error:', stats.error);
        this.error = stats.error;
        this.eventSource?.close();
        this.cdr.detectChanges();
        return;
      }

      this.cpuPercent = stats.cpu_percent || 0;
      this.memUsage = stats.memory_mb?.usage || 0;
      this.memLimit = stats.memory_mb?.limit || 0;
      this.memPercent = stats.memory_mb?.percent || 0;
      
      let totalRx = 0;
      let totalTx = 0;
      if (stats.network) {
        Object.values(stats.network).forEach((net: any) => {
          totalRx += net.rx || 0;
          totalTx += net.tx || 0;
        });
      }
      this.networkRx = totalRx / (1024 * 1024); // Convert to MB
      this.networkTx = totalTx / (1024 * 1024); // Convert to MB

      this.error = null;
      this.cdr.detectChanges();
    };

    this.eventSource.onerror = (error) => {
      console.error('EventSource failed:', error);
      this.error = 'Failed to connect to the stats stream. Ensure the backend is running and the container is active.';
      this.eventSource?.close();
      this.cdr.detectChanges();
    };
  }
}