import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
  template: `
  <div class="flex min-h-screen bg-gray-100">
    <aside class="bg-gray-800 text-gray-300 w-64 shrink-0 hidden md:block">
      <div class="flex items-center justify-center px-6 py-4 text-2xl font-bold text-white">
        <i class="bi bi-box-seam me-3"></i>
        <span>DaaS</span>
      </div>
      <nav class="px-4 space-y-2">
        <a routerLink="/dashboard" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
          <i class="bi bi-grid-1x2-fill me-3"></i>
          <span>Dashboard</span>
        </a>
        <a routerLink="/dashboard/search-images" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-search me-3"></i>
          <span>Search Images</span>
        </a>
        <a routerLink="/dashboard/images" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-images me-3"></i>
          <span>My Images</span>
        </a>
        <a routerLink="/dashboard/containers" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-hdd-stack-fill me-3"></i>
          <span>Containers</span>
        </a>
        <a routerLink="/dashboard/networks" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-diagram-3-fill me-3"></i>
          <span>Networks</span>
        </a>
        <a routerLink="/dashboard/volumes" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-database-fill me-3"></i>
          <span>Volumes</span>
        </a>
        <a routerLink="/dashboard/logs" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-card-text me-3"></i>
          <span>Logs</span>
        </a>
        <a routerLink="/dashboard/ssh-access" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-terminal-fill me-3"></i>
          <span>SSH Access</span>
        </a>
        
        <a routerLink="/dashboard/container-stats" routerLinkActive="active-link" class="nav-link">
          <i class="bi bi-bar-chart-line-fill me-3"></i>
          <span>Container Stats</span>
        </a>
      </nav>
    </aside>

    <div class="flex-1 flex flex-col">
      <header class="flex items-center justify-between px-6 py-3 bg-white border-b">
        <div class="md:hidden">
          <button id="menuBtn" class="p-2 border rounded" (click)="open = !open">
            <i class="bi bi-list"></i>
          </button>
        </div>
        <div class="hidden md:block">
          <h1 class="text-xl font-semibold text-gray-700">Dashboard</h1>
        </div>
        <div class="flex items-center">
          <span class="me-3 text-gray-600">Welcome, User!</span>
          <i class="bi bi-person-circle text-2xl text-gray-600"></i>
        </div>
      </header>

      <div class="md:hidden" *ngIf="open">
        <nav class="px-2 py-2 bg-gray-800 text-gray-300 space-y-1">
          <a routerLink="/dashboard" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}" class="nav-link">
            <i class="bi bi-grid-1x2-fill me-3"></i>
            <span>Dashboard</span>
          </a>
          <a routerLink="/dashboard/search-images" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-search me-3"></i>
            <span>Search Images</span>
          </a>
          <a routerLink="/dashboard/images" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-images me-3"></i>
            <span>My Images</span>
          </a>
          <a routerLink="/dashboard/containers" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-hdd-stack-fill me-3"></i>
            <span>Containers</span>
          </a>
          <a routerLink="/dashboard/networks" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-diagram-3-fill me-3"></i>
            <span>Networks</span>
          </a>
          <a routerLink="/dashboard/volumes" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-database-fill me-3"></i>
            <span>Volumes</span>
          </a>
          <a routerLink="/dashboard/logs" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-card-text me-3"></i>
            <span>Logs</span>
          </a>
          <a routerLink="/dashboard/ssh-access" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-terminal-fill me-3"></i>
            <span>SSH Access</span>
          </a>
          <a routerLink="/dashboard/container-stats" routerLinkActive="active-link" class="nav-link">
            <i class="bi bi-bar-chart-line-fill me-3"></i>
            <span>Container Stats</span>
          </a>
          
        </nav>
      </div>

      <main class="p-6 flex-1">
        <router-outlet></router-outlet>
      </main>
    </div>
  </div>
  <style>
    .nav-link {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      transition: background-color 0.2s;
    }
    .nav-link:hover {
      background-color: #374151; /* gray-700 */
    }
    .active-link {
      background-color: #1e40af; /* blue-800 */
      color: white;
    }
  </style>
  `,
})
export class DashboardComponent {
  open = false;
}
