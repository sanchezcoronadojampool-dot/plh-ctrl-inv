import { TestBed } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { App } from './app';
import { InventoryService } from './inventory.service';
import { vi } from 'vitest';

describe('App', () => {
  const inventoryService = {
    getCurrentUser: () => of({ id: 1, fullName: 'Administradora', jobTitle: 'Administradora', role: 'ADMIN' as const, email: 'admin@example.com', enabled: true }),
    login: vi.fn(() => of({ id: 1, fullName: 'Administradora', jobTitle: 'Administradora', role: 'ADMIN' as const, email: 'admin@example.com', enabled: true })),
    getDashboard: () => of({ totalProducts: 1, stocksByUnit: { unidad: 12 }, lowStockCount: 0, movementsToday: 0 }),
    getProducts: () => of([{ id: 1, code: 'P-001', name: 'Martillo', category: 'Herramientas', stock: 12, minimumStock: 3, location: 'Almacén', unit: 'pza', trackingType: 'CONSUMABLE' as const }]),
    getUsers: () => of([]),
    getPeople: () => of([]),
    getMovements: () => of([]),
    getAreas: () => of([{ id: 1, name: 'Almacén' }]),
    getAssets: () => of([]),
    getLoans: () => of([]),
    createMovement: vi.fn(() => of({})),
    createAsset: vi.fn(() => throwError(() => ({
      error: { message: 'Registra primero la existencia de compra del producto; no puedes etiquetar más unidades que las existentes.' }
    })))
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [{ provide: InventoryService, useValue: inventoryService }]
    }).compileComponents();
  });

  it('renders the inventory dashboard with API data', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Dashboard');
    expect(compiled.textContent).toContain('12');
    expect(fixture.componentInstance.products[0].name).toBe('Martillo');
  });

  it('shows the login form immediately while the session check is pending', () => {
    vi.spyOn(inventoryService, 'getCurrentUser').mockReturnValue(NEVER);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.checkingSession).toBe(true);
    expect(fixture.nativeElement.querySelector('form.login-form')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
  });

  it('shows the login form after an unauthenticated session check', () => {
    vi.spyOn(inventoryService, 'getCurrentUser').mockReturnValue(throwError(() => ({ status: 401 })));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.checkingSession).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Iniciar sesión');
    expect(fixture.nativeElement.textContent).not.toContain('Verificando sesión');
  });

  it('exits the validating state and opens the app after login succeeds', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.componentInstance.loginEmail = 'admin@example.com';
    fixture.componentInstance.loginPassword = 'valid-password';

    fixture.componentInstance.login();
    fixture.detectChanges();

    expect(fixture.componentInstance.currentUser?.email).toBe('admin@example.com');
    expect(fixture.componentInstance.saving).toBe(false);
    expect(fixture.nativeElement.querySelector('.app-shell')).not.toBeNull();
  });

  it('sets a dedicated print mode for the branded movement report', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);

    fixture.componentInstance.printReport();

    expect(print).toHaveBeenCalledOnce();
    expect(document.body.classList.contains('printing-report')).toBe(true);
    window.dispatchEvent(new Event('afterprint'));
    fixture.detectChanges();
    expect(document.body.classList.contains('printing-report')).toBe(false);
  });

  it('shows a connection message instead of waiting forever when the API is unavailable', () => {
    vi.spyOn(inventoryService, 'getCurrentUser').mockReturnValue(throwError(() => ({ status: 0 })));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.componentInstance.checkingSession).toBe(false);
    expect(fixture.componentInstance.loginError).toContain('No se pudo conectar con la API');
  });

  it('records fractional fuel output with the recipient and purpose', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.products = [{ id: 8, code: 'F-1', name: 'Gasolina', category: 'Combustible', stock: 20, minimumStock: 3, location: 'Tanque', unit: 'galón', trackingType: 'FUEL' }];
    app.users = [{ id: 2, fullName: 'Operador', jobTitle: 'Mantenimiento' }];
    app.movementForm = {
      productId: 8, userId: 2, recipientId: 2, areaId: 1, type: 'SALIDA', quantity: 0.5,
      vehicleEquipment: 'Generador', reason: 'Prueba de planta', movementDate: '2026-01-01'
    };

    app.saveMovement();

    expect(inventoryService.createMovement).toHaveBeenCalledWith(expect.objectContaining({
      productId: 8, recipientId: 2, quantity: 0.5, purpose: 'FUEL_USE', vehicleEquipment: 'Generador'
    }));
  });

  it('opens product registration in a dialog instead of inline on the page', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    fixture.componentInstance.navigate('products');
    fixture.detectChanges();
    fixture.componentInstance.startNewProduct();
    fixture.detectChanges();

    expect(fixture.componentInstance.showProductForm).toBe(true);
  });

  it('shows the insufficient asset stock response in an actionable warning dialog', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.assetForm = {
      productId: 2, assetCode: 'TV-002', serialNumber: '', areaId: 1,
      responsibleId: 1, recordedById: 1, condition: 'GOOD'
    };

    app.saveAsset();

    expect(app.showErrorModal).toBe(true);
    expect(app.isAssetStockWarning).toBe(true);
    expect(app.errorMessage).toContain('no puedes etiquetar más unidades');
  });
});
