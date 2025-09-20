import { Routes } from '@angular/router';
import { LoginComponent } from './login.component';
import { DashboardComponent } from './dashboard.component';
import { authGuard } from './auth.guard';
import { PageComponent } from './pages/page.component';
import { DashboardHomeComponent } from './dashboard-home.component';
import { SearchImagesComponent } from './search-images.component';
import { MyImagesComponent } from './my-images.component';
import { NetworksComponent } from './networks.component';
import { ContainersComponent } from './containers.component';
import { VolumesComponent } from './volumes.component';
import { SshAccessComponent } from './ssh-access.component';
import { LogsComponent } from './logs.component';
import { ContainerStatsComponent } from './container-stats.component';

export const routes: Routes = [
  { path: '', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardHomeComponent },
      { path: 'search-images', component: SearchImagesComponent },
      { path: 'images', component: MyImagesComponent },
      { path: 'containers', component: ContainersComponent },
      { path: 'networks', component: NetworksComponent },
      { path: 'volumes', component: VolumesComponent },
      { path: 'logs', component: LogsComponent },
      { path: 'ssh-access', component: SshAccessComponent },
      { path: 'container-stats', component: ContainerStatsComponent },
    ]
  },
  { path: '**', redirectTo: '' }
];
