import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ToastService } from './toast.service';
import { finalize } from 'rxjs';

// A simple interface to represent a container's data
interface Container {
  id: string;
  name: string;
  image: string;
  status: string;
  created: string;
  ports: string;
  // More flexible state to handle all Docker states
  state: 'running' | 'exited' | 'paused' | 'created' | 'restarting' | 'dead' | string;
}

@Component({
  selector: 'app-containers',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], // HttpClient is provided globally
  template: `
    <div class="page-container">
      <!-- Header -->
      <div class="flex justify-between items-center mb-6">
        <div class="flex items-center gap-4">
          <h1 class="page-title">Containers</h1>
          <button (click)="fetchContainers()" class="btn btn-secondary btn-sm" [disabled]="isLoading" title="Refresh list">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" [class.animate-spin]="isLoading" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V4a1 1 0 011-1zm12 1a1 1 0 011 1v5a1 1 0 11-2 0V9.101a7.002 7.002 0 01-11.601-2.566 1 1 0 111.885-.666A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v2a1 1 0 01-1 1z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
        <button (click)="openCreateModal()" class="btn btn-primary flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          Create Container
        </button>
      </div>

      <!-- Containers Table -->
      <div class="panel">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left text-gray-400">
            <thead class="text-xs text-gray-400 uppercase bg-gray-900">
              <tr>
                <th scope="col" class="px-6 py-3">Name</th>
                <th scope="col" class="px-6 py-3">Image</th>
                <th scope="col" class="px-6 py-3">Status</th>
                <th scope="col" class="px-6 py-3">Created</th>
                <th scope="col" class="px-6 py-3">Port Mapping</th>
                <th scope="col" class="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-gray-800 divide-y divide-gray-700">
              <!-- Loading State -->
              <tr *ngIf="isLoading">
                <td colspan="6" class="text-center py-8 text-gray-400">
                  <div class="flex justify-center items-center gap-2">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-100"></div>
                    <span>Loading containers...</span>
                  </div>
                </td>
              </tr>
              <!-- Error State -->
              <tr *ngIf="!isLoading && error">
                <td colspan="6" class="text-center py-8 text-red-400">
                  <p><strong>Error:</strong> {{ error }}</p>
                </td>
              </tr>
              <!-- Empty State -->
              <tr *ngIf="!isLoading && !error && containers.length === 0">
                <td colspan="6" class="text-center py-8 text-gray-500">
                  No containers found.
                </td>
              </tr>
              <tr *ngFor="let container of containers" class="hover:bg-gray-700/50 transition-colors duration-150">
                <td class="px-6 py-4 font-medium text-white whitespace-nowrap">
                  {{ container.name }}
                </td>
                <td class="px-6 py-4">{{ container.image }}</td>
                <td class="px-6 py-4">
                  <div class="flex items-center">
                    <div class="h-2.5 w-2.5 rounded-full mr-2" 
                         [ngClass]="{
                           'bg-green-500': container.state === 'running',
                           'bg-red-500': container.state === 'exited' || container.state === 'dead',
                           'bg-yellow-500': container.state === 'paused',
                           'bg-blue-500': container.state === 'restarting',
                           'bg-gray-500': !['running', 'exited', 'dead', 'paused', 'restarting'].includes(container.state)
                         }"></div>
                    {{ container.status }}
                  </div>
                </td>
                <td class="px-6 py-4">{{ container.created | date:'medium' }}</td>
                <td class="px-6 py-4 font-mono">{{ container.ports || 'N/A' }}</td>
                <td class="px-6 py-4 text-right">
                  <!-- Spinner when processing -->
                  <div *ngIf="isProcessing(container)" class="flex justify-end items-center pr-2">
                    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-100"></div>
                  </div>

                  <!-- Action buttons -->
                  <div *ngIf="!isProcessing(container)" class="flex justify-end items-center gap-2">
                    <button *ngIf="container.state !== 'running'" (click)="startContainer(container)" class="btn btn-xs btn-success" title="Start">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" /></svg>
                    </button>
                    <button *ngIf="container.state === 'running'" (click)="stopContainer(container)" class="btn btn-xs btn-warning" title="Stop">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clip-rule="evenodd" /></svg>
                    </button>
                    <a *ngIf="container.state === 'running'" [routerLink]="['/dashboard/container-stats', container.id]" class="btn btn-xs btn-info" title="Stats">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                        <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                      </svg>
                    </a>
                    <a [routerLink]="['/dashboard/logs']" [queryParams]="{ container: container.id }" class="btn btn-xs btn-secondary" title="Logs">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path fill-rule="evenodd" d="M3 4a2 2 0 012-2h10a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2-1a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V4a1 1 0 00-1-1H5z" clip-rule="evenodd"></path>
                            <path d="M6 7a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"></path>
                        </svg>
                    </a>
                    <button (click)="askToDelete(container)" class="btn btn-xs btn-danger" title="Delete">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Confirm delete modal -->
      <div *ngIf="confirmDeleteTarget" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="confirmDeleteTarget=null"></div>
        <div class="modal-card" style="max-width:460px;">
          <div class="modal-header">
            <div class="modal-title">Delete Container?</div>
            <button class="btn" (click)="confirmDeleteTarget=null">✕</button>
          </div>
          <div class="modal-body">
              <p>Are you sure you want to delete container <strong>{{ confirmDeleteTarget.name }}</strong> ({{ confirmDeleteTarget.id }})?</p>
              <p class="text-yellow-400 mt-2">This action is irreversible and will forcefully remove the container.</p>
          </div>
          <div class="modal-footer">
            <button class="btn" (click)="confirmDeleteTarget=null">Cancel</button>
            <button class="btn btn-danger" (click)="confirmDelete()" style="margin-left:8px;">Delete</button>
          </div>
        </div>
      </div>

      <!-- Create Container Modal -->
      <div *ngIf="isCreateModalOpen" class="modal" role="dialog" aria-modal="true">
        <div class="modal-backdrop" (click)="closeCreateModal()"></div>
        <div class="modal-card bg-gray-800 border border-gray-700" style="max-width: 800px;">
          <form #createForm="ngForm" (ngSubmit)="submitCreateContainer()">
            <div class="modal-header border-gray-700">
              <div class="modal-title text-white">Create New Container</div>
              <button type="button" class="btn text-gray-400 hover:bg-gray-700" (click)="closeCreateModal()">✕</button>
            </div>
            <div class="modal-body text-gray-300" style="max-height: 70vh; overflow-y: auto;">
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <!-- Container Name -->
                <div class="md:col-span-2">
                  <label class="label text-gray-400">Container Name</label>
                  <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="createData.name" name="name" placeholder="e.g., my-web-server">
                </div>

                <!-- Image -->
                <div>
                  <label class="label text-gray-400">Image</label>
                  <select class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="createData.image" name="image" required>
                    <option value="" disabled>Select an image</option>
                    <option *ngFor="let img of availableImages" [value]="img.name">{{ img.name }}</option>
                  </select>
                </div>

                <!-- Command -->
                <div>
                  <label class="label text-gray-400">Command (optional)</label>
                  <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="createData.command" name="command" placeholder="e.g., sh, /bin/bash">
                </div>
              </div>

              <!-- Port Mappings -->
              <fieldset class="mt-6 border-t border-gray-700 pt-4">
                <legend class="text-lg font-medium text-gray-200 mb-2">Port Mappings</legend>
                <div *ngFor="let port of createData.ports; let i = index" class="grid grid-cols-2 gap-4 mb-2 items-center">
                  <input type="number" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="port.hostPort" [name]="'hostPort' + i" placeholder="Host Port">
                  <div class="flex items-center gap-2">
                    <input type="number" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="port.containerPort" [name]="'containerPort' + i" placeholder="Container Port">
                    <button type="button" (click)="removeListItem(createData.ports, i)" class="btn btn-danger btn-sm">✕</button>
                  </div>
                </div>
                <button type="button" (click)="addListItem(createData.ports, { hostPort: '', containerPort: '' })" class="btn btn-secondary btn-sm mt-2">Add Port Mapping</button>
              </fieldset>

              <!-- Volume Mounts -->
              <fieldset class="mt-6 border-t border-gray-700 pt-4">
                <legend class="text-lg font-medium text-gray-200 mb-2">Volume Mounts</legend>
                <div *ngFor="let vol of createData.volumes; let i = index" class="grid grid-cols-2 gap-4 mb-2 items-center">
                  <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="vol.hostPath" [name]="'hostPath' + i" placeholder="Host Path or Volume Name">
                  <div class="flex items-center gap-2">
                    <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="vol.containerPath" [name]="'containerPath' + i" placeholder="Container Path">
                    <button type="button" (click)="removeListItem(createData.volumes, i)" class="btn btn-danger btn-sm">✕</button>
                  </div>
                </div>
                <button type="button" (click)="addListItem(createData.volumes, { hostPath: '', containerPath: '' })" class="btn btn-secondary btn-sm mt-2">Add Volume Mount</button>
              </fieldset>

              <!-- Environment Variables -->
              <fieldset class="mt-6 border-t border-gray-700 pt-4">
                <legend class="text-lg font-medium text-gray-200 mb-2">Environment Variables</legend>
                <div *ngFor="let env of createData.env; let i = index" class="grid grid-cols-2 gap-4 mb-2 items-center">
                  <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="env.key" [name]="'envKey' + i" placeholder="KEY">
                  <div class="flex items-center gap-2">
                    <input type="text" class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="env.value" [name]="'envValue' + i" placeholder="value">
                    <button type="button" (click)="removeListItem(createData.env, i)" class="btn btn-danger btn-sm">✕</button>
                  </div>
                </div>
                <button type="button" (click)="addListItem(createData.env, { key: '', value: '' })" class="btn btn-secondary btn-sm mt-2">Add Variable</button>
              </fieldset>

              <!-- Network & Restart Policy -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mt-6 border-t border-gray-700 pt-4">
                <div>
                  <label class="label text-gray-400">Network</label>
                  <select class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="createData.network" name="network">
                    <option value="">Default (bridge)</option>
                    <option *ngFor="let net of availableNetworks" [value]="net.name">{{ net.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="label text-gray-400">Restart Policy</label>
                  <select class="input bg-gray-900 border-gray-600 text-white" [(ngModel)]="createData.restartPolicy" name="restartPolicy">
                    <option value="no">Never</option>
                    <option value="on-failure">On Failure</option>
                    <option value="unless-stopped">Unless Stopped</option>
                    <option value="always">Always</option>
                  </select>
                </div>
              </div>

            </div>
            <div class="modal-footer border-gray-700">
              <button type="button" class="btn btn-secondary" (click)="closeCreateModal()">Cancel</button>
              <button type="submit" class="btn btn-primary" style="margin-left:8px;" [disabled]="!createForm.form.valid || isCreating">
                {{ isCreating ? 'Creating...' : 'Create' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class ContainersComponent implements OnInit {
  containers: Container[] = [];
  isLoading = false;
  error: string | null = null;
  processingContainers = new Set<string>();
  confirmDeleteTarget: Container | null = null;
  isCreateModalOpen = false;
  isCreating = false;

  // Data for dropdowns
  availableImages: { name: string }[] = [];
  availableNetworks: { name: string }[] = [];

  // Form model for creation
  createData = this.getInitialCreateData();

  constructor(private http: HttpClient, private toast: ToastService) {}

  ngOnInit(): void {
    this.fetchContainers();
  }

  fetchContainers(): void {
    this.isLoading = true;
    this.error = null;
    this.http.get<Container[]>('/api/containers').subscribe({
      next: (data) => {
        this.containers = data;
        this.isLoading = false;
      },
      error: (err) => {
        const errorMessage = err.error?.details || err.message || 'Failed to fetch containers.';
        this.error = errorMessage;
        this.toast.error(errorMessage);
        this.isLoading = false;
      }
    });
  }

  isProcessing(container: Container): boolean {
    return this.processingContainers.has(container.id);
  }

  // --- Create Container Logic ---

  private getInitialCreateData() {
    return {
      name: '',
      image: '',
      command: '',
      network: '',
      restartPolicy: 'no',
      env: [{ key: '', value: '' }],
      ports: [{ hostPort: '', containerPort: '' }],
      volumes: [{ hostPath: '', containerPath: '' }],
      labels: [{ key: '', value: '' }],
    };
  }

  openCreateModal() {
    this.isCreateModalOpen = true;
    // Fetch images if not already fetched
    if (this.availableImages.length === 0) {
      this.http.get<{ images: any[] }>('/api/my-images').subscribe(res => {
        this.availableImages = (res.images || [])
          .map(img => ({ name: `${img.repository}:${img.tag}` }))
          .filter(img => img.name !== '<none>:<none>');
      });
    }
    // Fetch networks if not already fetched
    if (this.availableNetworks.length === 0) {
      this.http.get<any[]>('/api/networks').subscribe(res => {
        this.availableNetworks = (res || []).map(net => ({ name: net.Name }));
      });
    }
  }

  closeCreateModal() {
    this.isCreateModalOpen = false;
    this.createData = this.getInitialCreateData();
  }

  addListItem(list: any[], item: any) { list.push(item); }
  removeListItem(list: any[], index: number) { list.splice(index, 1); }
  
  startContainer(container: Container) {
    this.processingContainers.add(container.id);
    this.http.post<{ message: string }>(`/api/containers/${container.id}/start`, {})
      .pipe(finalize(() => this.processingContainers.delete(container.id)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.fetchContainers();
        },
        error: (err) => {
          const errorMessage = err.error?.error || 'Failed to start container.';
          this.toast.error(errorMessage);
        }
      });
  }

  stopContainer(container: Container) {
    this.processingContainers.add(container.id);
    this.http.post<{ message: string }>(`/api/containers/${container.id}/stop`, {})
      .pipe(finalize(() => this.processingContainers.delete(container.id)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.fetchContainers();
        },
        error: (err) => {
          const errorMessage = err.error?.error || 'Failed to stop container.';
          this.toast.error(errorMessage);
        }
      });
  }

  askToDelete(container: Container) {
    this.confirmDeleteTarget = container;
  }

  confirmDelete() {
    if (!this.confirmDeleteTarget) {
      return;
    }
    const containerToDelete = this.confirmDeleteTarget;
    this.confirmDeleteTarget = null; // Close modal immediately

    this.processingContainers.add(containerToDelete.id);
    this.http.delete<{ message: string }>(`/api/containers/${containerToDelete.id}`)
      .pipe(finalize(() => this.processingContainers.delete(containerToDelete.id)))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          // Remove from list locally for faster UI feedback before refreshing
          this.containers = this.containers.filter(c => c.id !== containerToDelete.id);
        },
        error: (err) => {
          const errorMessage = err.error?.error || 'Failed to delete container.';
          this.toast.error(errorMessage);
        }
      });
  }

  submitCreateContainer() {
    this.isCreating = true;
    const payload = { ...this.createData };
    // Filter out empty placeholder items from arrays
    payload.env = payload.env.filter(e => e.key);
    payload.ports = payload.ports.filter(p => p.containerPort);
    payload.volumes = payload.volumes.filter(v => v.hostPath && v.containerPath);
    payload.labels = payload.labels.filter(l => l.key);

    this.http.post<{ message: string, id: string }>('/api/containers/create', payload)
      .pipe(finalize(() => this.isCreating = false))
      .subscribe({
        next: (res) => {
          this.toast.success(res.message);
          this.closeCreateModal();
          this.fetchContainers(); // Refresh the list
        },
        error: (err) => {
          const errorMessage = err.error?.details || err.error?.error || 'Failed to create container.';
          this.toast.error(errorMessage);
          // Do not close modal on error, so the user can correct the form
        }
      });
  }
}