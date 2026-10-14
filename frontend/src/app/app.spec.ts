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
    getAssetByQr: vi.fn(() => of({
      asset: { id: 4, qrToken: 'abc-123', assetCode: 'RAD-001', productId: 1, productName: 'Radio',
        productCode: 'EQ-RAD-001', areaId: 1, areaName: 'Almacén', condition: 'GOOD' as const, status: 'ON_LOAN' as const },
      history: []
    })),
    createProduct: vi.fn(() => of({})),
    createMovement: vi.fn(() => of({})),
    createPerson: vi.fn(() => of({})),
    createLoan: vi.fn(() => of({})),
    returnLoan: vi.fn(() => of({})),
    bulkCreateProducts: vi.fn(() => of([])),
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

  it('opens the scanned QR detail right after signing in', () => {
    vi.spyOn(inventoryService, 'getCurrentUser').mockReturnValue(throwError(() => ({ status: 401 })));
    window.history.pushState({}, '', '/qr/abc-123');
    try {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();
      const app = fixture.componentInstance;
      expect(app.currentUser).toBeNull();

      app.loginEmail = 'admin@example.com';
      app.loginPassword = 'valid-password';
      app.login();
      fixture.detectChanges();

      expect(app.currentUser?.email).toBe('admin@example.com');
      expect(app.activeSection).toBe('assets');
      expect(app.selectedQrDetail?.asset.assetCode).toBe('RAD-001');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('RAD-001');
    } finally {
      window.history.pushState({}, '', '/');
    }
  });

  it('renders the selected QR labels as a printable sheet that cleans up afterwards', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.selectedAsset = { id: 4, qrToken: 'abc-123', assetCode: 'RAD-001', productId: 1,
      productName: 'Radio', productCode: 'EQ-RAD-001', condition: 'GOOD', status: 'ON_LOAN' };

    await app.printQr();

    expect(app.qrPrintLabels).toHaveLength(1);
    expect(app.qrPrintLabels[0].dataUrl).toContain('data:image/png');
    expect(document.body.classList.contains('printing-qr')).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 120));
    expect(print).toHaveBeenCalledOnce();

    window.dispatchEvent(new Event('afterprint'));
    fixture.detectChanges();
    expect(app.qrPrintLabels).toHaveLength(0);
    expect(document.body.classList.contains('printing-qr')).toBe(false);
  });

  it('issues a loan by typing only the recipient name and adding articles to the list', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.currentUser = { id: 1, fullName: 'Administradora', jobTitle: 'Administradora',
      role: 'ADMIN', email: 'admin@example.com' };
    app.products = [{ id: 9, code: 'TOO-MAR-GEN-001', name: 'Martillo', category: 'HERRAMIENTAS',
      stock: 5, minimumStock: 0, location: 'Almacén', unit: 'pza', trackingType: 'REUSABLE' }];
    app.users = [{ id: 27, fullName: 'Trabajador sin cuenta', jobTitle: 'Mantenimiento' }];
    app.areas = [{ id: 1, name: 'Almacén' }];
    app.startLoan();
    app.loanRecipientQuery = 'trabajador sin cuenta';
    app.loanProductId = 9;

    app.addLoanLine();
    expect(app.loanLines).toHaveLength(1);
    expect(app.loanLines[0]).toEqual({ productId: 9, quantity: 1, assetIds: [] });

    app.issueLoan();

    expect(inventoryService.createLoan).toHaveBeenCalledWith(expect.objectContaining({
      borrowerType: 'EMPLOYEE', borrowerPersonId: 27, borrowerName: null, areaId: 1,
      items: [expect.objectContaining({ productId: 9, quantity: 1 })]
    }));
    expect(app.showLoanForm).toBe(false);
    expect(app.loanLines).toHaveLength(0);
  });

  it('treats an unknown recipient name as an owner without blocking the loan', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.currentUser = { id: 1, fullName: 'Administradora', jobTitle: 'Administradora',
      role: 'ADMIN', email: 'admin@example.com' };
    app.products = [{ id: 9, code: 'TOO-MAR-GEN-001', name: 'Martillo', category: 'HERRAMIENTAS',
      stock: 5, minimumStock: 0, location: 'Almacén', unit: 'pza', trackingType: 'REUSABLE' }];
    app.areas = [{ id: 1, name: 'Almacén' }];
    app.startLoan();
    app.loanRecipientQuery = 'Propietaria de la casa 12';
    app.loanProductId = 9;
    app.addLoanLine();

    expect(app.recipientPreview).toContain('propietario');
    app.issueLoan();

    expect(inventoryService.createLoan).toHaveBeenCalledWith(expect.objectContaining({
      borrowerType: 'OWNER', borrowerPersonId: null, borrowerName: 'Propietaria de la casa 12'
    }));
  });

  it('returns every pending line of a loan in a single request', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;
    app.currentUser = { id: 1, fullName: 'Administradora', jobTitle: 'Administradora',
      role: 'ADMIN', email: 'admin@example.com' };
    app.areas = [{ id: 1, name: 'Almacén' }, { id: 2, name: 'Taller' }];
    const loan = {
      id: 7, loanNumber: 'PLH-TEST01', borrowerId: undefined, borrowerType: 'EMPLOYEE' as const,
      borrowerName: 'Operario', issuedById: 1, issuedByName: 'Administradora',
      areaId: 2, areaName: 'Taller', purpose: 'Mantenimiento', issuedAt: '2026-10-01',
      status: 'OPEN' as const,
      items: [
        { id: 11, productId: 9, productName: 'Martillo', productCode: 'TOO-001', quantity: 3,
          returnedQuantity: 1, outstandingQuantity: 2, conditionOut: 'GOOD' as const, assets: [] },
        { id: 12, productId: 10, productName: 'Radio', productCode: 'ACT-001', quantity: 1,
          returnedQuantity: 0, outstandingQuantity: 1, conditionOut: 'GOOD' as const,
          assets: [{ id: 9, qrToken: 'tok', assetCode: 'RAD-009', productId: 10, productName: 'Radio',
            productCode: 'ACT-001', condition: 'GOOD' as const, status: 'ON_LOAN' as const }] }
      ]
    };
    app.loans = [loan];

    expect(app.hasPendingLines(loan)).toBe(true);
    app.startReturnAll(loan);
    expect(app.returnAllAreaId).toBe(2);
    app.saveReturnAll();

    expect(inventoryService.returnLoan).toHaveBeenCalledWith(7, expect.objectContaining({
      areaId: 2,
      items: [
        { loanLineId: 11, quantity: 2, condition: 'GOOD', assetIds: [] },
        { loanLineId: 12, quantity: 1, condition: 'GOOD', assetIds: [9] }
      ]
    }));
    expect(app.showReturnAll).toBe(false);
  });

  it('previews bulk import rows from an Excel file before sending them', async () => {
    const XLSX = await import('xlsx');
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Código', 'Nombre', 'Categoría', 'Variante', 'Stock', 'Stock mínimo', 'Unidad', 'Ubicación', 'Tipo de seguimiento'],
      ['', 'Taladro percutor', 'HERRAMIENTAS', '', 2, 1, 'pza', 'Almacén', 'Reutilizable'],
      ['', '', 'LIMPIEZA', '', 4, 0, 'pza', 'Bodega', 'Consumible'],
      ['P-001', 'Duplicado', 'LIMPIEZA', '', 1, 0, 'pza', 'Bodega', 'Consumible']
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const app = fixture.componentInstance;

    await app.importFileChanged({
      target: { files: [new File([buffer], 'productos.xlsx')], value: '' }
    } as unknown as Event);

    expect(app.importRows).toHaveLength(3);
    expect(app.importRows[0].status).toBe('ready');
    expect(app.importRows[0].trackingType).toBe('REUSABLE');
    expect(app.importRows[0].code).toBe('HER-TAL-GEN-001');
    expect(app.importRows[1].status).toBe('error');
    expect(app.importRows[1].message).toContain('nombre');
    expect(app.importRows[2].status).toBe('skip');
    expect(app.importReadyRows).toHaveLength(1);
  });
});
