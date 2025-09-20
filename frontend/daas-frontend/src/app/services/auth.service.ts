import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConnectionData {
  hostIp: string;
  tlsMode?: string;
  caCert: string;
  clientCert: string;
  clientKey: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/connect';

  constructor(private http: HttpClient) {}

  connect(data: ConnectionData): Observable<any> {
    return this.http.post(this.apiUrl, data);
  }
}