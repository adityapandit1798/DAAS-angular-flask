import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <h1 class="text-2xl font-semibold mb-4">{{ title }}</h1>
    <div class="text-gray-600">Content coming soon...</div>
  `
})
export class PageComponent {
  title = '';
  constructor(route: ActivatedRoute) {
    this.title = route.snapshot.data['title'] || 'Page';
  }
}


