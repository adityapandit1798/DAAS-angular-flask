import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="page-container">
    <h1 class="page-title">Dashboard</h1>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="stat-card">
        <div class="stat-title">Total Images</div>
        <div class="stat-value">2</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Running Containers</div>
        <div class="stat-value">1</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Stopped Containers</div>
        <div class="stat-value">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Networks</div>
        <div class="stat-value">3</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Volumes</div>
        <div class="stat-value">0</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Memory Usage</div>
        <div class="stat-value">30.0% <span class="stat-sub">591MB / 1972MB</span></div>
      </div>
    </div>

    <div class="panel mt-6">
      <div class="panel-title">System Information</div>
      <div class="info-table-wrapper">
        <table class="info-table">
          <tbody>
            <tr><th>Docker Version</th><td>28.3.3</td></tr>
            <tr><th>Host OS</th><td>Alpine Linux v3.22</td></tr>
            <tr><th>Uptime</th><td>Unknown</td></tr>
            <tr><th>CPU Cores</th><td>1</td></tr>
            <tr><th>Docker Root Dir</th><td>/var/lib/docker</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <style>
    .stat-card {
      @apply bg-white p-6 rounded-lg shadow;
    }
    .stat-title {
      @apply text-sm font-medium text-gray-500;
    }
    .stat-value {
      @apply mt-1 text-3xl font-semibold text-gray-900;
    }
    .stat-sub {
      @apply text-sm font-medium text-gray-500;
    }
    .info-table-wrapper {
      @apply overflow-x-auto;
    }
    @media (max-width: 640px) {
      .info-table tr {
        @apply border-b border-gray-200;
      }
      .info-table th, .info-table td {
        @apply block w-full text-left;
      }
      .info-table th {
        @apply font-bold bg-gray-50 p-2;
      }
      .info-table td {
        @apply p-2;
      }
    }
  </style>
  `
})
export class DashboardHomeComponent {}


