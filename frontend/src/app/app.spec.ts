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
    createProduct: vi.fn(() => of({})),
    createMovement: vi.fn(() => of({})),
    createPerson: vi.fn(() => of({})),
    createLoan: vi.fn(() => of({})),
    createAsset: vi.fn(() => throwError(() => ({
      error: { message: 'Registra primero la existencia de compra del producto; no puedes etiquetar más unidades que las existentes.' }
    })))
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
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
      productId: 8, userId: 2, areaId: 1, type: 'SALIDA', quantity: 0.5,
      vehicleEquipment: 'Generador', reason: 'Prueba de planta', movementDate: '2026-01-01'
    };
    app.users = [{ id: 2, fullName: 'Operador', jobTitle: 'Mantenimiento' }];
    app.movementRecipientPersonId = 2;

    app.saveMovement();

    expect(inventoryService.createMovement).toHaveBeenCalledWith(expect.objectContaining({
      productId: 8, recipientId: undefined, recipientName: 'Operador', quantity: 0.5,
      purpose: 'FUEL_USE', vehicleEquipment: 'Generador'
    }));
  });

  it('starts a quick delivery with the product selected and keeps the recipient required', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    const product = { id: 9, code: 'P-009', name: 'Guantes', category: 'Seguridad',
      stock: 12, minimumStock: 2, location: 'Almacén', unit: 'par', trackingType: 'CONSUMABLE' as const };
    app.products = [product];
    app.users = [{ id: 5, fullName: 'Trabajador', jobTitle: 'Mantenimiento' }];
    app.currentUser = { id: 1, fullName: 'Administradora', jobTitle: 'Administradora',
      role: 'ADMIN', email: 'admin@example.com' };

    app.startQuickDelivery(product);

    expect(app.quickMovementMode).toBe(true);
    expect(app.movementForm.type).toBe('SALIDA');
    expect(app.movementForm.productId).toBe(product.id);
    expect(app.movementForm.recipientId).toBeUndefined();
    app.movementRecipientPersonId = 5;
    app.saveMovement();

    expect(inventoryService.createMovement).toHaveBeenCalledWith(expect.objectContaining({
      productId: product.id, type: 'SALIDA', recipientId: undefined, recipientName: 'Trabajador', purpose: 'CONSUMPTION'
    }));
    expect(app.movementRecipientPersonId).toBe(0);
  });

  it('does not submit a quick delivery without a selected recipient', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.products = [{ id: 9, code: 'P-009', name: 'Guantes', category: 'Seguridad',
      stock: 12, minimumStock: 2, location: 'Almacén', unit: 'par', trackingType: 'CONSUMABLE' }];
    app.movementForm.userId = 1;
    app.startQuickDelivery(app.products[0]);

    app.saveMovement();

    expect(inventoryService.createMovement).not.toHaveBeenCalled();
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

  it('saves the initial product stock during product registration', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.startNewProduct();
    app.productForm = {
      code: 'P-INITIAL', name: 'Producto inicial', category: 'Herramientas', stock: 12,
      minimumStock: 2, location: 'Almacén', unit: 'pza', trackingType: 'CONSUMABLE'
    };

    app.saveProduct();

    expect(inventoryService.createProduct).toHaveBeenCalledWith(expect.objectContaining({ stock: 12 }));
  });

  it('shows the insufficient asset stock response in an actionable warning dialog', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.assetForm = {
      productId: 2, assetCode: 'TV-002', serialNumber: '', areaId: 1,
      responsiblePersonId: 0, responsibleName: 'Custodio', recordedById: 1, condition: 'GOOD'
    };

    app.saveAsset();

    expect(app.showErrorModal).toBe(true);
    expect(app.isAssetStockWarning).toBe(true);
    expect(app.errorMessage).toContain('no puedes etiquetar más unidades');
  });

  it('generates a product code from category, product, variant and starting number', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.startNewProduct();
    app.productForm.name = 'WALKI TALKI';
    app.productForm.variant = 'VERDE';
    app.productCodeChanged();

    expect(app.productForm.code).toBe('EQU-WAL-VER-001');
  });

  it('issues a loan to a registered worker without requiring an account', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.currentUser = { id: 1, fullName: 'Administradora', jobTitle: 'Administradora',
      role: 'ADMIN', email: 'admin@example.com' };
    app.products = [{ id: 9, code: 'TOO-MAR-GEN-001', name: 'Martillo', category: 'HERRAMIENTAS',
      stock: 5, minimumStock: 0, location: 'Almacén', unit: 'pza', trackingType: 'REUSABLE' }];
    app.users = [{ id: 27, fullName: 'Trabajador sin cuenta', jobTitle: 'Mantenimiento' }];
    app.areas = [{ id: 1, name: 'Almacén' }];
    app.loanProductId = 9;
    app.loanForm = { borrowerType: 'EMPLOYEE', borrowerPersonId: 27, borrowerName: '',
      issuedById: 1, areaId: 1, purpose: 'Mantenimiento', dueAt: '' };

    app.issueLoan();

    expect(inventoryService.createLoan).toHaveBeenCalledWith(expect.objectContaining({
      borrowerType: 'EMPLOYEE', borrowerPersonId: 27, borrowerName: null
    }));
  });

  it('continues loading available catalogs when a separate catalog request fails', () => {
    vi.spyOn(inventoryService, 'getProducts').mockReturnValue(throwError(() => ({
      error: { message: 'Productos no disponibles' }
    })));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    expect(app.areas).toEqual([{ id: 1, name: 'Almacén' }]);
    expect(app.loadErrors.some((message) => message.includes('Productos'))).toBe(true);
  });
});
