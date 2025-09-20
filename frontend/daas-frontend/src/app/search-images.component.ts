import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { marked } from 'marked';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-search-images',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-page">
      <h1 class="search-title">Search Docker Images</h1>

      <form class="search-bar" (ngSubmit)="search()">
        <input [(ngModel)]="query" name="q" type="text" class="search-input" placeholder="Enter image name (e.g., nginx, redis)" />
        <button class="search-button" [disabled]="loading || !query">
          <span class="search-icon">🔍</span> Search
        </button>
      </form>

      <div class="popular-block">
        <div class="popular-title">Popular Images</div>
        <div class="chips">
          <button class="chip" type="button" (click)="query='nginx'">nginx</button>
          <button class="chip" type="button" (click)="query='redis'">redis</button>
          <button class="chip" type="button" (click)="query='mysql'">mysql</button>
          <button class="chip" type="button" (click)="query='postgres'">postgres</button>
          <button class="chip" type="button" (click)="query='ubuntu'">ubuntu</button>
          <button class="chip" type="button" (click)="query='alpine'">alpine</button>
        </div>
      </div>

      <div class="hint" *ngIf="!query">Search for an image to view its details</div>

      <div *ngIf="loading" class="results-hint">Searching "{{ query }}"...</div>
      <div *ngIf="error" class="results-hint" style="color:#b91c1c">{{ error }}</div>
      <div *ngIf="result" class="results">
        <div class="panel">
          <div class="panel-title">{{ result.full_name || (result.namespace + '/' + result.name) }}</div>
          <div class="info-table-wrap">
            <table class="info-table">
              <tbody>
                <tr><th>Description</th><td>{{ result.description || '—' }}</td></tr>
                <tr><th>Pulls</th><td>{{ result.pull_count }}</td></tr>
                <tr><th>Stars</th><td>{{ result.star_count }}</td></tr>
                <tr><th>Last Updated</th><td>{{ result.last_updated }}</td></tr>
                <tr><th>Official</th><td>{{ result.is_official ? 'Yes' : 'No' }}</td></tr>
                <tr *ngIf="result.hub_url"><th>Docker Hub</th><td><a [href]="result.hub_url" target="_blank" rel="noopener">Open on Docker Hub</a></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div *ngIf="result.full_description" class="panel" style="margin-top:12px;">
          <div class="panel-title">Readme</div>
          <div class="markdown p-4" [innerHTML]="readmeHtml"></div>
        </div>
      </div>
    </div>
  <style>
    .markdown h1 { @apply text-2xl font-bold my-4; }
    .markdown h2 { @apply text-xl font-bold my-3; }
    .markdown h3 { @apply text-lg font-bold my-2; }
    .markdown p { @apply my-4; }
    .markdown ul { @apply list-disc list-inside my-4; }
    .markdown ol { @apply list-decimal list-inside my-4; }
    .markdown li { @apply ml-4; }
    .markdown pre { @apply bg-gray-800 text-white p-4 rounded-md my-4 overflow-x-auto; }
    .markdown code { @apply bg-gray-200 text-gray-800 px-1 rounded-md; }
    .markdown pre code { @apply bg-transparent text-white p-0; }
    .markdown blockquote { @apply border-l-4 border-gray-400 pl-4 my-4 italic; }
    .markdown a { @apply text-blue-600 hover:underline; }
  </style>
  `,
})
export class SearchImagesComponent {
  query = '';
  loading = false;
  error = '';
  result: any = null;
  readmeHtml: SafeHtml | null = null;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {}

  search() {
    if (!this.query) return;
    this.loading = true;
    this.error = '';
    this.result = null;
    this.http.get(`/api/images/${encodeURIComponent(this.query)}`).subscribe({
      next: (data) => {
        this.result = data;
        this.updateReadme(this.result.full_description);
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.error || 'Failed to fetch image details';
        this.loading = false;
      }
    });
  }

  private async updateReadme(md: string | undefined) {
    if (!md) {
      this.readmeHtml = null;
      return;
    }
    // Use Promise.resolve in case `marked.parse` is synchronous.
    const rawHtml = await Promise.resolve(marked.parse(md));
    // As the original comment notes, for a production app, you should sanitize this HTML.
    // Using DOMPurify is a good choice. For this example, we'll trust the content from Docker Hub.
    this.readmeHtml = this.sanitizer.bypassSecurityTrustHtml(rawHtml);
  }
}
