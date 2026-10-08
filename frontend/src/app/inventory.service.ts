import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { Area, Asset, DashboardSummary, InventoryPerson, Loan, Movement, Product, QrAssetDetail, User } from './models';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = '/api';

  constructor(private http: HttpClient) {}

  getCsrf(): Observable<{ headerName: string; token: string }> {
    return this.http.get<{ headerName: string; token: string }>(`${this.apiUrl}/auth/csrf`);
  }

  login(email: string, password: string): Observable<User> {
    return this.getCsrf().pipe(switchMap(() =>
      this.http.post<User>(`${this.apiUrl}/auth/login`, { email, password })));
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/auth/me`);
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/auth/logout`, {});
  }

  getDashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard`);
  }

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${this.apiUrl}/products`);
  }

  createProduct(product: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${this.apiUrl}/products`, product);
  }

  updateProduct(id: number, product: Partial<Product>): Observable<Product> {
    return this.http.put<Product>(`${this.apiUrl}/products/${id}`, product);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/products/${id}`);
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`);
  }

  getPeople(): Observable<InventoryPerson[]> {
    return this.http.get<InventoryPerson[]>(`${this.apiUrl}/people`);
  }

  createUser(user: Partial<User>): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user);
  }

  updateUser(id: number, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${id}`, user);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${id}`);
  }

  getMovements(): Observable<Movement[]> {
    return this.http.get<Movement[]>(`${this.apiUrl}/movements`);
  }

  createMovement(movement: Partial<Movement>): Observable<Movement> {
    return this.http.post<Movement>(`${this.apiUrl}/movements`, movement);
  }

  getAreas(): Observable<Area[]> {
    return this.http.get<Area[]>(`${this.apiUrl}/areas`);
  }

  createArea(area: { name: string; description?: string }): Observable<Area> {
    return this.http.post<Area>(`${this.apiUrl}/areas`, area);
  }

  getAssets(): Observable<Asset[]> {
    return this.http.get<Asset[]>(`${this.apiUrl}/assets`);
  }

  createAsset(asset: object): Observable<Asset> {
    return this.http.post<Asset>(`${this.apiUrl}/assets`, asset);
  }

  assignAsset(id: number, assignment: object): Observable<Asset> {
    return this.http.put<Asset>(`${this.apiUrl}/assets/${id}/assign`, assignment);
  }

  getAssetByQr(token: string): Observable<QrAssetDetail> {
    return this.http.get<QrAssetDetail>(`${this.apiUrl}/qr/${encodeURIComponent(token)}`);
  }

  getLoans(): Observable<Loan[]> {
    return this.http.get<Loan[]>(`${this.apiUrl}/loans`);
  }

  createLoan(loan: object): Observable<Loan> {
    return this.http.post<Loan>(`${this.apiUrl}/loans`, loan);
  }

  returnLoan(id: number, request: object): Observable<Loan> {
    return this.http.post<Loan>(`${this.apiUrl}/loans/${id}/returns`, request);
  }
}
