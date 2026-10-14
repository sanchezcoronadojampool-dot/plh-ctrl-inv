import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, TimeoutError, catchError, finalize, forkJoin, of, timeout } from 'rxjs';
import QRCode from 'qrcode';
import { Area, Asset, DashboardSummary, ImportPreviewRow, InventoryPerson, ItemCondition, Loan, LoanLine, LoanLineDraft, Movement, Product, QrAssetDetail, QrPrintLabel, TrackingType, User } from './models';
import { InventoryService } from './inventory.service';

type Section = 'dashboard' | 'products' | 'movements' | 'assets' | 'loans' | 'people' | 'users' | 'reports';
type ProductSortKey = 'code' | 'name' | 'category' | 'stock';
const CONDITIONS: ItemCondition[] = ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'OUT_OF_SERVICE'];
const GALLON_UNITS = ['galón', 'galones', 'gal', 'gallon', 'gallons'];

interface LoanRecipient {
  borrowerType: 'EMPLOYEE' | 'OWNER';
  borrowerPersonId: number | null;
  borrowerName: string | null;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html'
})
export class App implements OnInit {
  readonly Math = Math;
  private readonly basePath = App.resolveBasePath();
  private loginAttempted = false;
  activeSection: Section = 'dashboard';
  products: Product[] = [];
  users: InventoryPerson[] = [];
  accountUsers: User[] = [];
  movements: Movement[] = [];
  areas: Area[] = [];
  assets: Asset[] = [];
  loans: Loan[] = [];
  loadErrors: string[] = [];
  currentUser: User | null = null;
  checkingSession = true;
  loginEmail = '';
  loginPassword = '';
  loginError = '';
  dashboard: DashboardSummary = { totalProducts: 0, stocksByUnit: {}, lowStockCount: 0, movementsToday: 0 };
  loading = false;
  saving = false;
  errorMessage = '';
  showErrorModal = false;
  successMessage = '';
  editingProductId: number | null = null;
  editingUserId: number | null = null;
  selectedProduct: Product | null = null;
  selectedIds = new Set<number>();
  productSearch = '';
  categoryFilter = '';
  sortKey: ProductSortKey = 'name';
  sortAscending = true;
  page = 1;
  readonly pageSize = 6;
  reportStart = '';
  reportEnd = '';
  reportCategory = '';
  reportGeneratedAt = '';
  selectedAsset: Asset | null = null;
  assetToAssign: Asset | null = null;
  selectedAssetQr = '';
  selectedAssetIds = new Set<number>();
  qrPrintLabels: QrPrintLabel[] = [];
  selectedQrDetail: QrAssetDetail | null = null;
  selectedLoan: Loan | null = null;
  assetSearch = '';
  loanProductId = 0;
  loanRecipientQuery = '';
  loanLines: LoanLineDraft[] = [];
  loanLineError = '';
  readonly loanPurposeSuggestions = ['Mantenimiento', 'Poda y jardín', 'Limpieza', 'Obra / reparación', 'Evento'];
  movementRecipientPersonId = 0;
  productInitialNumber = 1;
  loanQuantity = 1;
  loanAssetIds = new Set<number>();
  returnLine: LoanLine | null = null;
  returnQuantity = 1;
  returnAssetIds = new Set<number>();
  returnCondition: ItemCondition = 'GOOD';
  showProductForm = false;
  showMovementForm = false;
  quickMovementMode = false;
  showImportForm = false;
  importParsing = false;
  importFileName = '';
  importSummary = '';
  importRows: ImportPreviewRow[] = [];
  showReturnAll = false;
  returnAllLoan: Loan | null = null;
  returnAllCondition: ItemCondition = 'GOOD';
  returnAllAreaId = 0;
  productsReportGeneratedAt = '';
  showUserForm = false;
  showPersonForm = false;
  showAreaForm = false;
  showAssetForm = false;
  showLoanForm = false;
  readonly conditions = CONDITIONS;
  areaForm = { name: '', description: '' };
  assetForm = { productId: 0, assetCode: '', serialNumber: '', areaId: 0, responsiblePersonId: 0, responsibleName: '', recordedById: 0, condition: 'GOOD' as ItemCondition };
  assignmentForm = { areaId: 0, responsiblePersonId: 0, responsibleName: '', issuedById: 0, condition: 'GOOD' as ItemCondition, reason: '' };
  loanForm = { borrowerType: 'EMPLOYEE' as 'EMPLOYEE' | 'OWNER', borrowerPersonId: 0, borrowerName: '', issuedById: 0, areaId: 0, purpose: '', dueAt: '' };
  returnForm = { receivedById: 0, returnedById: 0, areaId: 0 };
  personForm = { fullName: '', jobTitle: '' };

  productForm: Product = this.emptyProduct();
  userForm: User = { fullName: '', jobTitle: '', role: 'INVENTORY_MANAGER', email: '', password: '' };
  movementForm: Movement = {
    productId: 0,
    userId: 0,
    type: 'ENTRADA',
    quantity: 1,
    reason: '',
    purpose: 'PURCHASE',
    movementDate: this.today()
  };

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  /**
   * Raíz de la app. Si el documento se cargó directo en /qr/<token> (escaneo del código),
   * el directorio de baseURI sería /qr/ y todas las rutas profundas dejarían de coincidir;
   * por eso se descarta ese segmento y se prefiere la etiqueta <base> cuando existe.
   */
  private static resolveBasePath(): string {
    let path: string;
    const baseHref = document.querySelector('base')?.getAttribute('href');
    try {
      path = baseHref
        ? new URL(baseHref, document.baseURI).pathname
        : new URL('.', document.baseURI).pathname;
    } catch {
      path = '/';
    }
    if (path.endsWith('/qr/')) path = path.slice(0, -4);
    return path.endsWith('/') ? path : `${path}/`;
  }

  ngOnInit(): void {
    this.inventoryService.getCurrentUser()
      .pipe(timeout({ first: 10_000 }), finalize(() => {
        this.checkingSession = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (user) => {
          if (this.loginAttempted) return;
          this.currentUser = user;
          this.changeDetector.markForCheck();
          this.loadAll();
          this.syncQrRoute();
        },
        error: (error: unknown) => {
          if (this.currentUser || this.loginAttempted) return;
          this.currentUser = null;
          this.loginError = error instanceof TimeoutError
            ? 'La API no respondió al verificar la sesión. Comprueba que el backend esté iniciado y vuelve a cargar.'
            : this.isUnauthorized(error)
              ? ''
              : 'No se pudo conectar con la API. Comprueba el backend y la configuración del proxy, y vuelve a cargar.';
          this.changeDetector.markForCheck();
        }
      });
  }

  get isAdministrator(): boolean {
    return this.currentUser?.role === 'ADMIN';
  }

  get canManageInventory(): boolean {
    return this.currentUser?.role === 'ADMIN' || this.currentUser?.role === 'INVENTORY_MANAGER';
  }

  get stockSummary(): string {
    return Object.entries(this.dashboard.stocksByUnit)
      .map(([unit, quantity]) => `${quantity} ${unit}`)
      .join(' · ') || 'Sin existencias';
  }

  login(): void {
    this.loginAttempted = true;
    this.loginError = '';
    this.saving = true;
    this.inventoryService.login(this.loginEmail, this.loginPassword)
      .pipe(timeout({ first: 30_000 }), finalize(() => {
        this.saving = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (user) => {
          this.currentUser = user;
          this.loginPassword = '';
          this.changeDetector.markForCheck();
          this.loadAll();
          // Al escanear un QR sin sesión, la ruta /qr/<token> sigue en la URL:
          // al terminar el login se carga la ficha del activo en lugar de quedar en blanco.
          this.syncQrRoute();
        },
        error: (error: unknown) => {
          this.loginError = this.errorText(error, 'Correo o contraseña inválidos.');
          this.changeDetector.markForCheck();
        }
      });
  }

  logout(): void {
    this.inventoryService.logout().subscribe({
      next: () => {
        this.currentUser = null;
        this.products = [];
        this.users = [];
        this.accountUsers = [];
        this.movements = [];
        this.assets = [];
        this.loans = [];
        this.areas = [];
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        if (this.isUnauthorized(error)) this.expireSession();
        else {
          this.errorMessage = this.errorText(error, 'No se pudo cerrar la sesión de forma segura.');
          this.showErrorModal = true;
          this.changeDetector.markForCheck();
        }
      }
    });
  }

  @HostListener('window:popstate')
  onPopState(): void {
    this.syncQrRoute();
  }

  @HostListener('window:afterprint')
  clearPrintMode(): void {
    if (document.body.classList.contains('printing-qr')) this.qrPrintLabels = [];
    document.body.classList.remove('printing-report', 'printing-qr', 'printing-products');
    this.changeDetector.markForCheck();
  }

  get sectionTitle(): string {
    const titles: Record<Section, string> = {
      dashboard: 'Dashboard',
      products: 'Productos',
      movements: 'Entradas y salidas',
      assets: 'Activos, áreas y códigos QR',
      loans: 'Préstamos y devoluciones',
      people: 'Personal',
      users: 'Usuarios y permisos',
      reports: 'Reportes'
    };
    return titles[this.activeSection];
  }

  get categories(): string[] {
    return [...new Set(this.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
  }

  get productCategoryOptions(): string[] {
    return [...new Set(['EQUIPO', 'HERRAMIENTAS', 'LIMPIEZA', 'SEGURIDAD', 'OFICINA', 'COMBUSTIBLE', 'ACTIVOS',
      ...this.categories, this.productForm.category].filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
  }

  productCodeChanged(): void {
    if (!this.editingProductId) this.updateGeneratedProductCode();
  }

  get lowStockProducts(): Product[] {
    return this.products.filter((product) => product.trackingType !== 'ASSET' && product.stock <= product.minimumStock);
  }

  get assetProducts(): Product[] {
    return this.products.filter((product) => product.trackingType === 'ASSET');
  }

  get loanProducts(): Product[] {
    return this.products.filter((product) => product.trackingType === 'ASSET' || product.trackingType === 'REUSABLE');
  }

  get movementProducts(): Product[] {
    return this.products.filter((product) => this.movementForm.type === 'ENTRADA'
      || (product.trackingType !== 'ASSET' && product.trackingType !== 'REUSABLE'));
  }

  get selectedMovementProduct(): Product | undefined {
    return this.products.find((product) => product.id === Number(this.movementForm.productId));
  }

  movementTypeChanged(): void {
    if (!this.movementProducts.some((product) => product.id === Number(this.movementForm.productId))) {
      this.movementForm.productId = this.movementProducts[0]?.id ?? 0;
    }
  }

  movementRecipientChanged(id: number): void {
    const person = this.users.find((candidate) => candidate.id === Number(id));
    this.movementForm.recipientName = person?.fullName ?? '';
  }

  assetPersonChanged(id: number): void {
    this.assetForm.responsibleName = this.users.find((person) => person.id === Number(id))?.fullName ?? '';
  }

  assignmentPersonChanged(id: number): void {
    this.assignmentForm.responsibleName = this.users.find((person) => person.id === Number(id))?.fullName ?? '';
  }

  get filteredAssets(): Asset[] {
    const query = this.assetSearch.trim().toLocaleLowerCase();
    return this.assets.filter((asset) => !query || `${asset.assetCode} ${asset.productName} ${asset.serialNumber ?? ''} ${asset.areaName ?? ''} ${asset.responsibleName ?? ''}`.toLocaleLowerCase().includes(query));
  }

  get selectedLoanProduct(): Product | undefined {
    return this.products.find((product) => product.id === Number(this.loanProductId));
  }

  get availableLoanAssets(): Asset[] {
    return this.assets.filter((asset) => asset.productId === Number(this.loanProductId) && asset.status !== 'ON_LOAN' && asset.status !== 'RETIRED');
  }

  get selectedReturnAssets(): Asset[] {
    return this.returnLine?.assets.filter((asset) => asset.status === 'ON_LOAN') ?? [];
  }

  get filteredProducts(): Product[] {
    const query = this.productSearch.trim().toLocaleLowerCase();
    return this.products
      .filter((product) => !this.categoryFilter || product.category === this.categoryFilter)
      .filter((product) => !query || `${product.code} ${product.name} ${product.category}`.toLocaleLowerCase().includes(query))
      .sort((left, right) => {
        const first = left[this.sortKey];
        const second = right[this.sortKey];
        const comparison = typeof first === 'number' && typeof second === 'number'
          ? first - second
          : String(first).localeCompare(String(second), undefined, { sensitivity: 'base' });
        return this.sortAscending ? comparison : -comparison;
      });
  }

  get pagedProducts(): Product[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredProducts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredProducts.length / this.pageSize));
  }

  get allVisibleSelected(): boolean {
    return this.pagedProducts.length > 0 && this.pagedProducts.every((product) => this.selectedIds.has(product.id!));
  }

  get filteredMovements(): Movement[] {
    return this.movements.filter((movement) => {
      const category = this.categoryForMovement(movement);
      return (!this.reportStart || movement.movementDate! >= this.reportStart)
        && (!this.reportEnd || movement.movementDate! <= this.reportEnd)
        && (!this.reportCategory || category === this.reportCategory);
    });
  }

  navigate(section: Section): void {
    this.activeSection = section;
    this.clearMessages();
  }

  loadAll(): void {
    this.loading = true;
    this.errorMessage = '';
    this.loadErrors = [];
    forkJoin({
      dashboard: this.loadResource('Dashboard', this.inventoryService.getDashboard(), this.dashboard),
      products: this.loadResource('Productos', this.inventoryService.getProducts(), this.products),
      people: this.loadResource('Personal', this.inventoryService.getPeople(), this.users),
      accounts: this.isAdministrator
        ? this.loadResource('Cuentas', this.inventoryService.getUsers(), this.accountUsers)
        : of([] as User[]),
      movements: this.loadResource('Movimientos', this.inventoryService.getMovements(), this.movements),
      areas: this.loadResource('Áreas', this.inventoryService.getAreas(), this.areas),
      assets: this.loadResource('Activos', this.inventoryService.getAssets(), this.assets),
      loans: this.loadResource('Préstamos', this.inventoryService.getLoans(), this.loans)
    }).pipe(timeout({ first: 30_000 }), finalize(() => {
      this.loading = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: ({ dashboard, products, people, accounts, movements, areas, assets, loans }) => {
        this.dashboard = dashboard;
        this.products = products;
        this.users = people;
        this.accountUsers = accounts;
        this.movements = movements;
        this.areas = areas;
        this.assets = assets;
        this.loans = loans;
        if (!this.movementForm.productId && products.length) this.movementForm.productId = products[0].id!;
        if (this.currentUser?.id) {
          this.movementForm.userId = this.currentUser.id;
          this.assetForm.recordedById = this.currentUser.id;
          this.assignmentForm.issuedById = this.currentUser.id;
          this.loanForm.issuedById = this.currentUser.id;
          this.returnForm.receivedById = this.currentUser.id;
        }
        if (!this.showLoanForm && !this.loanForm.borrowerPersonId && people.length) this.loanForm.borrowerPersonId = people[0].id;
        if (!this.assetForm.responsiblePersonId && people.length) this.assetForm.responsiblePersonId = people[0].id;
        if (!this.assetForm.areaId && areas.length) this.assetForm.areaId = areas[0].id;
        if (!this.loanForm.areaId && areas.length) this.loanForm.areaId = areas[0].id;
        if (!this.returnForm.areaId && areas.length) this.returnForm.areaId = areas[0].id;
        if (!this.movementForm.areaId && areas.length) this.movementForm.areaId = areas[0].id;
        if (!this.loanProductId && this.loanProducts.length) this.loanProductId = this.loanProducts[0].id!;
        this.page = Math.min(this.page, this.totalPages);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        if (this.isUnauthorized(error)) this.expireSession();
        else {
          this.errorMessage = this.errorText(error, 'No se pudo cargar la información. Verifica que la API y PostgreSQL estén disponibles.');
          this.showErrorModal = true;
        }
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
  }

  private loadResource<T>(label: string, request: Observable<T>, previousValue: T): Observable<T> {
    return request.pipe(catchError((error: unknown) => {
      if (this.isUnauthorized(error)) {
        this.expireSession();
      } else {
        this.loadErrors.push(`${label}: ${this.errorText(error, 'No se pudo cargar este catálogo.')}`);
      }
      return of(previousValue);
    }));
  }

  sortBy(key: ProductSortKey): void {
    if (this.sortKey === key) this.sortAscending = !this.sortAscending;
    else {
      this.sortKey = key;
      this.sortAscending = true;
    }
  }

  sortIndicator(key: ProductSortKey): string {
    return this.sortKey === key ? (this.sortAscending ? '↑' : '↓') : '↕';
  }

  toggleSelection(id: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.selectedIds.add(id);
    else this.selectedIds.delete(id);
  }

  toggleAllVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    for (const product of this.pagedProducts) {
      if (checked) this.selectedIds.add(product.id!);
      else this.selectedIds.delete(product.id!);
    }
  }

  startNewProduct(): void {
    this.editingProductId = null;
    this.productForm = this.emptyProduct();
    this.productInitialNumber = 1;
    this.productForm.category = 'EQUIPO';
    this.updateGeneratedProductCode();
    this.showProductForm = true;
  }

  startQuickDelivery(product?: Product): void {
    const deliverableProducts = this.products.filter((item) =>
      item.trackingType !== 'ASSET' && item.trackingType !== 'REUSABLE'
    );
    this.quickMovementMode = true;
    this.movementForm = {
      ...this.movementForm,
      productId: product && deliverableProducts.some((item) => item.id === product.id) ? product.id! : 0,
      userId: this.currentUser?.id ?? 0,
      type: 'SALIDA',
      quantity: 1,
      reason: '',
      recipientId: undefined,
      recipientName: '',
      purpose: undefined,
      vehicleEquipment: '',
      movementDate: this.today()
    };
    this.movementRecipientPersonId = 0;
    this.showMovementForm = true;
  }

  startMovement(): void {
    this.quickMovementMode = false;
    this.movementForm.type = 'ENTRADA';
    this.movementTypeChanged();
    this.showMovementForm = true;
  }

  closeMovementForm(): void {
    this.showMovementForm = false;
    this.quickMovementMode = false;
  }

  editProduct(product: Product): void {
    this.editingProductId = product.id!;
    this.productForm = { ...product };
    this.activeSection = 'products';
    this.showProductForm = true;
  }

  showProductDetails(product: Product): void {
    this.selectedProduct = product;
  }

  deleteProduct(product: Product): void {
    if (!window.confirm(`¿Eliminar el producto ${product.name}? Se conservará el historial de movimientos.`)) return;
    this.runMutation(this.inventoryService.deleteProduct(product.id!), 'Producto eliminado.');
  }

  saveProduct(): void {
    if (!this.productForm.code.trim() || !this.productForm.name.trim() || !this.productForm.category.trim()
        || (!this.editingProductId && this.productForm.stock !== undefined
          && (!Number.isInteger(this.productForm.stock) || this.productForm.stock < 1 || this.productForm.stock > 50))) return;
    this.saving = true;
    const wasEditing = this.editingProductId !== null;
    const request = this.editingProductId
      ? this.inventoryService.updateProduct(this.editingProductId, this.productForm)
      : this.inventoryService.createProduct(this.productForm);
    request.pipe(timeout({ first: 30_000 }), finalize(() => {
      this.saving = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: () => {
        this.showProductForm = false;
        this.editingProductId = null;
        this.productForm = this.emptyProduct();
        this.finishMutation(wasEditing ? 'Producto actualizado.' : 'Producto creado.');
      },
      error: (error: unknown) => this.handleMutationError(error)
    });
  }

  editUser(user: User): void {
    this.editingUserId = user.id!;
    this.userForm = { ...user, password: '' };
    this.showUserForm = true;
  }

  resetUserForm(): void {
    this.editingUserId = null;
    this.userForm = { fullName: '', jobTitle: '', role: 'INVENTORY_MANAGER', email: '', password: '', enabled: true };
  }

  saveUser(): void {
    const request = this.editingUserId
      ? this.inventoryService.updateUser(this.editingUserId, this.userForm)
      : this.inventoryService.createUser(this.userForm);
    this.runMutation(request, this.editingUserId ? 'Usuario actualizado.' : 'Usuario creado.', () => {
      this.resetUserForm();
      this.showUserForm = false;
    });
  }

  savePerson(): void {
    const fullName = this.personForm.fullName.trim();
    const jobTitle = this.personForm.jobTitle.trim();
    if (!fullName || !jobTitle) return;
    this.runMutation(this.inventoryService.createPerson({ fullName, jobTitle }), 'Trabajador registrado.', (person) => {
      if (this.loanForm.borrowerType === 'EMPLOYEE') this.loanForm.borrowerPersonId = person.id;
      this.assetForm.responsiblePersonId = person.id;
      this.assetForm.responsibleName = person.fullName;
      this.assignmentForm.responsiblePersonId = person.id;
      this.assignmentForm.responsibleName = person.fullName;
      this.movementRecipientPersonId = person.id;
      this.movementForm.recipientName = person.fullName;
      this.personForm = { fullName: '', jobTitle: '' };
      this.showPersonForm = false;
    });
  }

  deleteUser(user: User): void {
    if (!window.confirm(`¿Desactivar el acceso de ${user.fullName}? Su historial se conservará.`)) return;
    this.runMutation(this.inventoryService.deleteUser(user.id!), 'Acceso de usuario desactivado.');
  }

  saveMovement(): void {
    if (!this.movementForm.productId || !this.movementForm.userId || !this.movementForm.quantity
        || this.movementForm.quantity <= 0
        || (this.movementForm.type === 'SALIDA'
          && !this.movementRecipientPersonId && !this.movementForm.recipientName?.trim())) return;
    const product = this.products.find((item) => item.id === Number(this.movementForm.productId));
    const purpose = this.movementForm.type === 'ENTRADA' ? 'PURCHASE'
      : product?.trackingType === 'FUEL' ? 'FUEL_USE' : 'CONSUMPTION';
    const recipient = this.users.find((person) => person.id === Number(this.movementRecipientPersonId));
    this.runMutation(this.inventoryService.createMovement({
      ...this.movementForm,
      recipientId: undefined,
      recipientName: recipient?.fullName ?? this.movementForm.recipientName?.trim(),
      purpose
    }), 'Movimiento registrado.', () => {
      this.showMovementForm = false;
      this.quickMovementMode = false;
      this.movementForm = {
        productId: 0,
        userId: this.currentUser?.id ?? 0,
        type: 'ENTRADA',
        quantity: 1,
        reason: '',
        recipientId: this.movementForm.recipientId,
        areaId: this.movementForm.areaId,
        vehicleEquipment: '',
        movementDate: this.today()
      };
      this.movementRecipientPersonId = 0;
    });
  }

  saveArea(): void {
    if (!this.areaForm.name.trim()) return;
    this.runMutation(this.inventoryService.createArea(this.areaForm), 'Área creada.', () => {
      this.areaForm = { name: '', description: '' };
      this.showAreaForm = false;
    });
  }

  saveAsset(): void {
    const person = this.users.find((candidate) => candidate.id === Number(this.assetForm.responsiblePersonId));
    const responsibleName = person?.fullName ?? this.assetForm.responsibleName.trim();
    if (!this.assetForm.productId || !this.assetForm.areaId || !responsibleName || !this.assetForm.recordedById) return;
    this.runMutation(this.inventoryService.createAsset({
      ...this.assetForm,
      responsibleId: undefined,
      responsibleName
    }), 'Activo registrado y asignado.', () => {
      this.assetForm.assetCode = '';
      this.assetForm.serialNumber = '';
      this.assetForm.responsibleName = '';
      this.showAssetForm = false;
    });
  }

  startAssignAsset(asset: Asset): void {
    this.assetToAssign = asset;
    this.assignmentForm = {
      areaId: asset.areaId ?? this.areas[0]?.id ?? 0,
      responsiblePersonId: this.users.find((person) => person.fullName === asset.responsibleName)?.id ?? 0,
      responsibleName: asset.responsibleName ?? '',
      issuedById: this.currentUser?.id ?? 0,
      condition: asset.condition,
      reason: ''
    };
  }

  saveAssignment(): void {
    if (!this.assetToAssign) return;
    const person = this.users.find((candidate) => candidate.id === Number(this.assignmentForm.responsiblePersonId));
    const responsibleName = person?.fullName ?? this.assignmentForm.responsibleName.trim();
    if (!responsibleName) return;
    this.runMutation(this.inventoryService.assignAsset(this.assetToAssign.id, {
      ...this.assignmentForm,
      responsibleId: undefined,
      responsibleName
    }), 'Asignación del activo actualizada.', () => this.assetToAssign = null);
  }

  toggleLoanAsset(id: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.loanAssetIds.add(id);
    else this.loanAssetIds.delete(id);
  }

  startLoan(): void {
    this.loanRecipientQuery = '';
    this.loanLines = [];
    this.loanLineError = '';
    this.loanForm.borrowerType = 'EMPLOYEE';
    this.loanForm.borrowerPersonId = 0;
    this.loanForm.borrowerName = '';
    this.loanForm.purpose = '';
    this.loanForm.dueAt = '';
    this.loanQuantity = 1;
    this.loanAssetIds.clear();
    if (!this.loanForm.areaId && this.areas.length) this.loanForm.areaId = this.areas[0].id;
    if (!this.loanProductId && this.loanProducts.length) this.loanProductId = this.loanProducts[0].id!;
    this.showLoanForm = true;
  }

  resolveLoanRecipient(): LoanRecipient | null {
    const query = this.loanRecipientQuery.trim();
    if (query) {
      const normalized = this.normalizePersonName(query);
      const person = this.users.find((candidate) => this.normalizePersonName(candidate.fullName) === normalized);
      if (person) return { borrowerType: 'EMPLOYEE', borrowerPersonId: person.id, borrowerName: null };
      return { borrowerType: 'OWNER', borrowerPersonId: null, borrowerName: query };
    }
    if (this.loanForm.borrowerType === 'EMPLOYEE' && this.loanForm.borrowerPersonId) {
      return { borrowerType: 'EMPLOYEE', borrowerPersonId: this.loanForm.borrowerPersonId, borrowerName: null };
    }
    if (this.loanForm.borrowerType === 'OWNER' && this.loanForm.borrowerName.trim()) {
      return { borrowerType: 'OWNER', borrowerPersonId: null, borrowerName: this.loanForm.borrowerName.trim() };
    }
    return null;
  }

  get recipientPreview(): string {
    const recipient = this.resolveLoanRecipient();
    if (!recipient) return '';
    if (recipient.borrowerType === 'EMPLOYEE') {
      const person = this.users.find((candidate) => candidate.id === recipient.borrowerPersonId);
      return `Se registra como trabajador: ${person?.fullName ?? ''} · ${person?.jobTitle ?? ''}`;
    }
    return `Se registra como propietario o invitado: ${recipient.borrowerName}`;
  }

  private normalizePersonName(value: string): string {
    return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleUpperCase();
  }

  loanProductFor(productId: number): Product | undefined {
    return this.products.find((product) => product.id === productId);
  }

  onLoanProductChanged(): void {
    this.loanAssetIds.clear();
    this.loanQuantity = 1;
    this.loanLineError = '';
    if (this.selectedLoanProduct?.trackingType === 'ASSET' && this.availableLoanAssets.length === 1) {
      this.loanAssetIds.add(this.availableLoanAssets[0].id);
    }
  }

  selectAllAvailableLoanAssets(): void {
    for (const asset of this.availableLoanAssets) this.loanAssetIds.add(asset.id);
  }

  addLoanLine(): void {
    const product = this.selectedLoanProduct;
    if (!product || !product.id) {
      this.loanLineError = 'Selecciona un artículo para agregarlo a la lista.';
      return;
    }
    if (this.loanLines.some((line) => line.productId === product.id)) {
      this.loanLineError = `${product.name} ya está en la lista; elimínalo para cambiar la cantidad.`;
      return;
    }
    const serialized = product.trackingType === 'ASSET';
    const assetIds = serialized ? [...this.loanAssetIds] : [];
    const quantity = serialized ? assetIds.length : Number(this.loanQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.loanLineError = serialized
        ? 'Selecciona al menos una unidad disponible.'
        : 'Indica una cantidad mayor que cero.';
      return;
    }
    if (!serialized && quantity > product.stock) {
      this.loanLineError = `Solo hay ${product.stock} ${product.unit} disponibles de ${product.name}.`;
      return;
    }
    this.loanLines.push({ productId: product.id, quantity, assetIds });
    this.loanLineError = '';
    this.loanQuantity = 1;
    this.loanAssetIds.clear();
    const next = this.loanProducts.find((candidate) => !this.loanLines.some((line) => line.productId === candidate.id));
    this.loanProductId = next?.id ?? product.id;
  }

  removeLoanLine(index: number): void {
    this.loanLines.splice(index, 1);
    this.loanLineError = '';
  }

  issueLoan(): void {
    const recipient = this.resolveLoanRecipient();
    const items = this.buildLoanItems();
    if (!recipient || !items.length || !this.loanForm.issuedById || !this.loanForm.areaId) return;
    this.runMutation(this.inventoryService.createLoan({
      ...this.loanForm,
      borrowerType: recipient.borrowerType,
      borrowerPersonId: recipient.borrowerPersonId,
      borrowerName: recipient.borrowerName,
      dueAt: this.loanForm.dueAt || null,
      items
    }), 'Préstamo registrado.', () => this.resetLoanDraft());
  }

  private buildLoanItems(): Array<{ productId?: number; quantity: number; conditionOut: ItemCondition; assetIds: number[] }> {
    if (this.loanLines.length) {
      return this.loanLines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        conditionOut: 'GOOD' as ItemCondition,
        assetIds: [...line.assetIds]
      }));
    }
    // Compatibilidad con el flujo de un solo producto.
    const product = this.selectedLoanProduct;
    if (!product || !this.loanProductId) return [];
    const serialized = product.trackingType === 'ASSET';
    const quantity = serialized ? this.loanAssetIds.size : Number(this.loanQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) return [];
    return [{ productId: product.id, quantity, conditionOut: 'GOOD' as ItemCondition, assetIds: serialized ? [...this.loanAssetIds] : [] }];
  }

  private resetLoanDraft(): void {
    this.showLoanForm = false;
    this.loanRecipientQuery = '';
    this.loanLines = [];
    this.loanLineError = '';
    this.loanQuantity = 1;
    this.loanAssetIds.clear();
    this.loanForm.borrowerType = 'EMPLOYEE';
    this.loanForm.borrowerPersonId = 0;
    this.loanForm.borrowerName = '';
    this.loanForm.purpose = '';
    this.loanForm.dueAt = '';
  }

  startReturn(loan: Loan, line: LoanLine): void {
    this.selectedLoan = loan;
    this.returnLine = line;
    const serialized = line.assets.length > 0;
    this.returnQuantity = line.outstandingQuantity;
    this.returnAssetIds = new Set(serialized
      ? line.assets.filter((asset) => asset.status === 'ON_LOAN').map((asset) => asset.id)
      : []);
    this.returnCondition = 'GOOD';
    this.returnForm = {
      receivedById: this.currentUser?.id ?? 0,
      returnedById: loan.borrowerId ?? 0,
      areaId: loan.areaId || this.areas[0]?.id || 0
    };
  }

  toggleReturnAsset(id: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.returnAssetIds.add(id);
    else this.returnAssetIds.delete(id);
  }

  saveReturn(): void {
    if (!this.selectedLoan || !this.returnLine) return;
    const serialized = this.returnLine.assets.length > 0;
    const quantity = serialized ? this.returnAssetIds.size : Number(this.returnQuantity);
    if (quantity <= 0) return;
    const request = this.inventoryService.returnLoan(this.selectedLoan.id, {
      ...this.returnForm,
      items: [{ loanLineId: this.returnLine.id, quantity, condition: this.returnCondition,
        assetIds: serialized ? [...this.returnAssetIds] : [] }]
    });
    this.runMutation(request, 'Devolución registrada.', () => {
      this.selectedLoan = null;
      this.returnLine = null;
    });
  }

  hasPendingLines(loan: Loan): boolean {
    return loan.items.some((line) => line.outstandingQuantity > 0);
  }

  isLoanOverdue(loan: Loan): boolean {
    if (loan.status === 'CLOSED' || !loan.dueAt) return false;
    return loan.dueAt < this.today();
  }

  get openLoanCount(): number {
    return this.loans.filter((loan) => loan.status !== 'CLOSED').length;
  }

  get overdueLoanCount(): number {
    return this.loans.filter((loan) => this.isLoanOverdue(loan)).length;
  }

  startReturnAll(loan: Loan): void {
    this.returnAllLoan = loan;
    this.returnAllCondition = 'GOOD';
    this.returnAllAreaId = loan.areaId || this.areas[0]?.id || 0;
    this.showReturnAll = true;
  }

  get returnAllPendingLines(): LoanLine[] {
    return this.returnAllLoan?.items.filter((line) => line.outstandingQuantity > 0) ?? [];
  }

  saveReturnAll(): void {
    const loan = this.returnAllLoan;
    if (!loan || !this.returnAllAreaId) return;
    const items = loan.items
      .filter((line) => line.outstandingQuantity > 0)
      .map((line) => {
        const serialized = line.assets.length > 0;
        const outstandingAssets = line.assets.filter((asset) => asset.status === 'ON_LOAN');
        return {
          loanLineId: line.id,
          quantity: serialized ? outstandingAssets.length : line.outstandingQuantity,
          condition: this.returnAllCondition,
          assetIds: serialized ? outstandingAssets.map((asset) => asset.id) : []
        };
      })
      .filter((item) => item.quantity > 0);
    if (!items.length) return;
    this.runMutation(this.inventoryService.returnLoan(loan.id, {
      receivedById: this.currentUser?.id ?? 0,
      returnedById: loan.borrowerId ?? null,
      areaId: this.returnAllAreaId,
      items
    }), 'Devolución completa registrada. El préstamo quedó cerrado.', () => {
      this.showReturnAll = false;
      this.returnAllLoan = null;
    });
  }

  returnAssetFromQr(): void {
    const asset = this.selectedQrDetail?.asset;
    if (!asset) return;
    const loan = this.loans.find((candidate) => candidate.status !== 'CLOSED'
      && candidate.items.some((line) => line.outstandingQuantity > 0
        && line.assets.some((item) => item.id === asset.id && item.status === 'ON_LOAN')));
    const line = loan?.items.find((candidate) => candidate.assets.some(
      (item) => item.id === asset.id && item.status === 'ON_LOAN'));
    if (!loan || !line) {
      this.errorMessage = 'Este activo no tiene un préstamo pendiente abierto.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
      return;
    }
    this.closeAssetDetail();
    this.activeSection = 'loans';
    this.startReturn(loan, line);
    this.returnAssetIds = new Set([asset.id]);
  }

  async showAssetQr(asset: Asset): Promise<void> {
    this.selectedAsset = asset;
    try {
      this.selectedAssetQr = await QRCode.toDataURL(this.qrUrl(asset), { width: 240, margin: 1, errorCorrectionLevel: 'M' });
      this.changeDetector.markForCheck();
    } catch {
      this.errorMessage = 'No se pudo generar el QR localmente.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
  }

  toggleAssetSelection(id: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.selectedAssetIds.add(id);
    else this.selectedAssetIds.delete(id);
  }

  toggleAllFilteredAssets(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    for (const asset of this.filteredAssets) {
      if (checked) this.selectedAssetIds.add(asset.id);
      else this.selectedAssetIds.delete(asset.id);
    }
  }

  get allFilteredAssetsSelected(): boolean {
    return this.filteredAssets.length > 0 && this.filteredAssets.every((asset) => this.selectedAssetIds.has(asset.id));
  }

  dismissErrorModal(): void {
    this.showErrorModal = false;
  }

  openProductsForStock(): void {
    this.showErrorModal = false;
    this.activeSection = 'products';
  }

  get isAssetStockWarning(): boolean {
    return this.errorMessage.includes('no puedes etiquetar más unidades que las existentes');
  }

  openAssetDetail(asset: Asset): void {
    window.history.pushState({}, '', `${this.basePath}qr/${asset.qrToken}`);
    this.loadQrDetail(asset.qrToken);
  }

  closeAssetDetail(): void {
    this.selectedQrDetail = null;
    if (this.relativePath.startsWith('/qr/')) window.history.pushState({}, '', this.basePath);
  }

  async printQr(): Promise<void> {
    if (this.selectedAsset) await this.printQrSheet([this.selectedAsset]);
  }

  async printSelectedQrs(): Promise<void> {
    const assets = this.assets.filter((asset) => this.selectedAssetIds.has(asset.id));
    if (!assets.length) {
      this.errorMessage = 'Selecciona al menos un activo para imprimir su QR.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
      return;
    }
    await this.printQrSheet(assets);
  }

  private async printQrSheet(assets: Asset[]): Promise<void> {
    try {
      const labels = await Promise.all(assets.map(async (asset) => ({
        asset,
        dataUrl: await QRCode.toDataURL(this.qrUrl(asset), { width: 360, margin: 1, errorCorrectionLevel: 'M' })
      })));
      this.qrPrintLabels = labels;
      document.body.classList.remove('printing-report', 'printing-products');
      document.body.classList.add('printing-qr');
      this.changeDetector.markForCheck();
      // Espera a que Angular pinte la hoja de etiquetas antes de abrir el diálogo de impresión.
      setTimeout(() => window.print(), 80);
    } catch {
      this.errorMessage = 'No se pudieron generar los códigos QR para impresión.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
  }

  private qrUrl(asset: Asset): string {
    return `${window.location.origin}${this.basePath}qr/${asset.qrToken}`;
  }

  conditionLabel(condition: ItemCondition): string {
    return ({ NEW: 'Nuevo', GOOD: 'Bueno', FAIR: 'Regular', DAMAGED: 'Dañado', OUT_OF_SERVICE: 'Fuera de servicio' })[condition];
  }

  statusLabel(status: Asset['status']): string {
    return ({ IN_STOCK: 'En almacén', ASSIGNED: 'Asignado', ON_LOAN: 'Prestado', RETIRED: 'Retirado' })[status];
  }

  trackingLabel(type?: TrackingType): string {
    return ({ CONSUMABLE: 'Consumible', REUSABLE: 'Reutilizable', ASSET: 'Activo serializado', FUEL: 'Combustible' })[type ?? 'CONSUMABLE'];
  }

  private syncQrRoute(): void {
    const match = this.relativePath.match(/^\/qr\/([0-9a-f-]+)$/i);
    if (match) {
      this.activeSection = 'assets';
      this.loadQrDetail(match[1]);
    } else {
      this.selectedQrDetail = null;
    }
  }

  private get relativePath(): string {
    return window.location.pathname.startsWith(this.basePath)
      ? `/${window.location.pathname.slice(this.basePath.length)}`
      : window.location.pathname;
  }

  private loadQrDetail(token: string): void {
    this.inventoryService.getAssetByQr(token).subscribe({
      next: (detail) => {
        this.selectedQrDetail = detail;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.selectedQrDetail = null;
        if (this.isUnauthorized(error)) {
          this.expireSession();
          return;
        }
        this.errorMessage = this.errorText(error, 'No se pudo consultar el activo por QR.');
        this.showErrorModal = true;
        this.changeDetector.markForCheck();
      }
    });
  }

  categoryForMovement(movement: Movement): string {
    return this.products.find((product) => product.id === movement.productId)?.category ?? '—';
  }

  resetReportFilters(): void {
    this.reportStart = '';
    this.reportEnd = '';
    this.reportCategory = '';
  }

  async downloadExcel(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const rows = this.filteredMovements.map((movement) => ({
        'Fecha': movement.movementDate ?? '',
        'Producto': movement.productName ?? '',
        'Categoría': this.categoryForMovement(movement),
        'Tipo': movement.type === 'ENTRADA' ? 'Entrada' : 'Salida',
        'Cantidad': movement.quantity,
        'Registrado por': movement.userName ?? '',
        'Entregado a': movement.recipientName ?? '',
        'Motivo': movement.reason ?? ''
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 22 }, { wch: 22 }, { wch: 30 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Movimientos');
      XLSX.writeFile(workbook, `reporte-movimientos-${this.today()}.xlsx`);
    } catch {
      this.errorMessage = 'No se pudo generar el archivo de Excel. Inténtalo de nuevo.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
  }

  async exportProductsExcel(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const rows = this.filteredProducts.map((product) => ({
        'Código': product.code,
        'Producto': product.name,
        'Variante': product.variant ?? '',
        'Categoría': product.category,
        'Tipo de seguimiento': this.trackingLabel(product.trackingType),
        'Stock': product.stock,
        'Stock mínimo': product.minimumStock,
        'Unidad': product.unit,
        'Ubicación': product.location,
        'Estado': this.stockState(product)
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 16 }, { wch: 20 },
        { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 12 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      XLSX.writeFile(workbook, `inventario-productos-${this.today()}.xlsx`);
    } catch {
      this.errorMessage = 'No se pudo generar el archivo de Excel. Inténtalo de nuevo.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
  }

  stockState(product: Product): string {
    if (product.stock === 0) return 'Agotado';
    return product.stock <= product.minimumStock ? 'Stock bajo' : 'Disponible';
  }

  openImportForm(): void {
    this.importFileName = '';
    this.importRows = [];
    this.importSummary = '';
    this.importParsing = false;
    this.showImportForm = true;
  }

  get importReadyRows(): ImportPreviewRow[] {
    return this.importRows.filter((row) => row.status === 'ready');
  }

  importStatusLabel(status: ImportPreviewRow['status']): string {
    return ({ ready: 'Listo para importar', created: 'Importado', skip: 'Omitido', error: 'Con error' })[status];
  }

  async importFileChanged(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importParsing = true;
    this.importFileName = file.name;
    this.importSummary = '';
    this.importRows = [];
    this.changeDetector.markForCheck();
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
      if (!sheet) throw new Error('empty-workbook');
      const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      this.importRows = this.parseImportRecords(records);
      this.importSummary = this.importRows.length
        ? `${this.importRows.length} fila(s) leídas · ${this.importReadyRows.length} lista(s) para importar.`
        : 'El archivo no contiene filas de datos. Usa la plantilla como referencia.';
    } catch {
      this.importSummary = 'No se pudo leer el archivo. Verifica que sea un .xlsx, .xls o .csv válido.';
    } finally {
      this.importParsing = false;
      input.value = '';
      this.changeDetector.markForCheck();
    }
  }

  async downloadImportTemplate(): Promise<void> {
    try {
      const XLSX = await import('xlsx');
      const header = ['Código', 'Nombre', 'Categoría', 'Variante', 'Stock', 'Stock mínimo', 'Unidad', 'Ubicación', 'Tipo de seguimiento'];
      const examples = [
        ['', 'Taladro percutor', 'HERRAMIENTAS', 'Inalámbrico 18V', 1, 0, 'pza', 'Almacén', 'Reutilizable'],
        ['', 'Bombilla LED 9W', 'LIMPIEZA', 'Blanca', 24, 6, 'pza', 'Bodega', 'Consumible'],
        ['', 'Gasolina súper', 'COMBUSTIBLE', '', 100, 10, 'galón', 'Tanque', 'Combustible'],
        ['ACT-RAD-001', 'Radio portátil', 'EQUIPO', 'VHF', 2, 0, 'pza', 'Cámaras', 'Activo']
      ];
      const worksheet = XLSX.utils.aoa_to_sheet([header, ...examples]);
      worksheet['!cols'] = [
        { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 20 }
      ];
      const guide = XLSX.utils.aoa_to_sheet([
        ['Guía de importación masiva de productos'],
        [],
        ['Columna', 'Obligatoria', 'Detalle'],
        ['Código', 'No', 'Si se omite se genera con el formato CAT-PRO-VAR-001. No puede repetirse.'],
        ['Nombre', 'Sí', 'Nombre del producto.'],
        ['Categoría', 'Sí', 'Ej. HERRAMIENTAS, LIMPIEZA, SEGURIDAD, OFICINA, COMBUSTIBLE, EQUIPO.'],
        ['Variante', 'No', 'Color, modelo u otra referencia.'],
        ['Stock', 'Sí', 'Número mayor o igual a cero. Los activos individuales deben ser enteros.'],
        ['Stock mínimo', 'No', 'Por defecto 0.'],
        ['Unidad', 'Sí', 'pza, caja, par, galón… (combustible obligatoriamente en galones).'],
        ['Ubicación', 'Sí', 'Ej. Almacén, Bodega, Tanque.'],
        ['Tipo de seguimiento', 'No', 'Consumible (por defecto) | Reutilizable | Activo | Combustible.'],
        [],
        ['Notas'],
        ['• Solo se crean productos nuevos; si el código ya existe, la fila se omite.'],
        ['• Máximo 500 productos por archivo.']
      ]);
      guide['!cols'] = [{ wch: 24 }, { wch: 14 }, { wch: 90 }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');
      XLSX.utils.book_append_sheet(workbook, guide, 'Guía');
      XLSX.writeFile(workbook, 'plantilla-carga-productos.xlsx');
    } catch {
      this.errorMessage = 'No se pudo generar la plantilla. Inténtalo de nuevo.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
  }

  confirmImportProducts(): void {
    const ready = this.importReadyRows;
    if (!ready.length) return;
    const products = ready.map((row) => ({
      code: row.code,
      name: row.name,
      category: row.category,
      variant: row.variant,
      stock: row.stock,
      minimumStock: row.minimumStock,
      location: row.location,
      unit: row.unit,
      trackingType: row.trackingType
    }));
    this.saving = true;
    this.clearMessages();
    this.inventoryService.bulkCreateProducts(products)
      .pipe(timeout({ first: 120_000 }), finalize(() => {
        this.saving = false;
        this.changeDetector.markForCheck();
      }))
      .subscribe({
        next: (results) => {
          results.forEach((result) => {
            const preview = ready[result.row - 1];
            if (!preview) return;
            preview.message = result.message;
            preview.status = result.status === 'CREATED' ? 'created'
              : result.status === 'SKIPPED' ? 'skip' : 'error';
          });
          const created = results.filter((result) => result.status === 'CREATED').length;
          const skipped = results.filter((result) => result.status === 'SKIPPED').length;
          const failed = results.filter((result) => result.status === 'ERROR').length;
          const parts = [`importados: ${created}`];
          if (skipped) parts.push(`omitidos: ${skipped}`);
          if (failed) parts.push(`con error: ${failed}`);
          this.importSummary = `Carga finalizada · ${parts.join(' · ')}`;
          if (failed || skipped) {
            this.errorMessage = `${failed} fila(s) con error y ${skipped} omitida(s). Revisa el detalle de la tabla.`;
            this.showErrorModal = true;
          }
          this.successMessage = `Carga masiva finalizada. Productos importados: ${created}.`;
          this.loadAll();
        },
        error: (error: unknown) => this.handleMutationError(error)
      });
  }

  private parseImportRecords(records: Record<string, unknown>[]): ImportPreviewRow[] {
    const takenCodes = new Set(this.products.map((product) => product.code.toLocaleUpperCase()));
    const rows: ImportPreviewRow[] = [];
    records.forEach((record, index) => {
      const name = this.importCell(record, ['nombre', 'producto', 'nombredeproducto']);
      const category = this.importCell(record, ['categoria']);
      const variant = this.importCell(record, ['variante', 'modelo']);
      const unit = this.importCell(record, ['unidad', 'unidadmedida']);
      const location = this.importCell(record, ['ubicacion', 'localizacion']);
      const stockText = this.importCell(record, ['stock', 'cantidad', 'existencia', 'existenciainicial']);
      const minimumText = this.importCell(record, ['stockminimo', 'minimo', 'stockmin']);
      const trackingText = this.importCell(record, ['tipodeseguimiento', 'tipo', 'seguimiento']);
      let code = this.importCell(record, ['codigo', 'codigodeproducto']);
      const preview: ImportPreviewRow = {
        row: index + 1,
        code,
        name,
        category,
        variant,
        stock: 0,
        minimumStock: 0,
        unit,
        location,
        trackingType: 'CONSUMABLE',
        status: 'ready',
        message: ''
      };
      rows.push(preview);
      const fail = (message: string): void => {
        preview.status = 'error';
        preview.message = message;
      };
      if (!name) return fail('Falta el nombre del producto.');
      if (!category) return fail('Falta la categoría del producto.');
      if (!unit) return fail('Falta la unidad de medida.');
      if (!location) return fail('Falta la ubicación.');
      const stock = this.toImportNumber(stockText);
      if (stock === null) return fail('El stock debe ser un número mayor o igual a cero.');
      if (stock < 0 || stock > 999_999) return fail('El stock debe estar entre 0 y 999999.');
      const minimum = minimumText ? this.toImportNumber(minimumText) : 0;
      if (minimum === null || minimum < 0) return fail('El stock mínimo debe ser un número mayor o igual a cero.');
      const trackingType = this.toTrackingType(trackingText);
      if (!trackingType) return fail(`Tipo de seguimiento no reconocido: “${trackingText}”.`);
      if (trackingType === 'ASSET' && !Number.isInteger(stock)) {
        return fail('Los activos individuales requieren una existencia entera.');
      }
      if (trackingType === 'FUEL' && !GALLON_UNITS.includes(unit.toLocaleLowerCase())) {
        return fail('El combustible debe medirse en galones (gal, galón…).');
      }
      preview.stock = stock;
      preview.minimumStock = minimum;
      preview.trackingType = trackingType;
      if (!code) {
        code = this.nextImportCode(category, name, variant, takenCodes);
        preview.code = code;
      } else if (code.length > 40) {
        return fail('El código supera los 40 caracteres.');
      } else if (takenCodes.has(code.toLocaleUpperCase())) {
        preview.status = 'skip';
        preview.message = `El código ${code} ya existe en el inventario o se repite en el archivo.`;
      } else {
        takenCodes.add(code.toLocaleUpperCase());
      }
    });
    return rows;
  }

  private importCell(row: Record<string, unknown>, aliases: string[]): string {
    for (const [key, value] of Object.entries(row)) {
      if (aliases.includes(this.normalizeKey(key))) {
        const text = value == null ? '' : String(value).trim();
        if (text) return text;
      }
    }
    return '';
  }

  private normalizeKey(value: string): string {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private toImportNumber(text: string): number | null {
    if (!text) return null;
    let normalized = text.replace(/\s/g, '');
    if (normalized.includes(',') && normalized.includes('.')) normalized = normalized.replace(/,/g, '');
    else normalized = normalized.replace(',', '.');
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  private toTrackingType(text: string): TrackingType | null {
    const key = this.normalizeKey(text);
    if (!key) return 'CONSUMABLE';
    if (key === 'consumable') return 'CONSUMABLE';
    if (key === 'reusable') return 'REUSABLE';
    if (key === 'asset') return 'ASSET';
    if (key === 'fuel') return 'FUEL';
    const map: Record<string, TrackingType> = {
      consumible: 'CONSUMABLE', consumibles: 'CONSUMABLE', consumo: 'CONSUMABLE',
      reutilizable: 'REUSABLE', reutilizables: 'REUSABLE', prestamo: 'REUSABLE', herramienta: 'REUSABLE',
      activo: 'ASSET', activos: 'ASSET', serializado: 'ASSET', individual: 'ASSET',
      combustible: 'FUEL'
    };
    return map[key] ?? null;
  }

  private nextImportCode(category: string, name: string, variant: string, taken: Set<string>): string {
    const prefix = [category, name, variant].map((value) => this.codePart(value)).join('-');
    let sequence = 1;
    let code = `${prefix}-${String(sequence).padStart(3, '0')}`;
    while (taken.has(code.toLocaleUpperCase())) {
      sequence += 1;
      code = `${prefix}-${String(sequence).padStart(3, '0')}`;
    }
    taken.add(code.toLocaleUpperCase());
    return code;
  }

  printReport(): void {
    this.reportGeneratedAt = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date());
    document.body.classList.remove('printing-qr', 'printing-products');
    document.body.classList.add('printing-report');
    window.print();
  }

  printProductsReport(): void {
    this.productsReportGeneratedAt = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date());
    document.body.classList.remove('printing-qr', 'printing-report');
    document.body.classList.add('printing-products');
    window.print();
  }

  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase();
  }

  private emptyProduct(): Product {
    return { code: '', name: '', category: 'EQUIPO', variant: '', stock: 1, minimumStock: 0, location: '', unit: 'pza', trackingType: 'CONSUMABLE' };
  }

  private updateGeneratedProductCode(): void {
    const parts = [this.productForm.category, this.productForm.name, this.productForm.variant ?? '']
      .map((value) => this.codePart(value));
    const prefix = parts.join('-');
    const initialNumber = Math.min(9999, Math.max(1, Math.floor(Number(this.productInitialNumber) || 1)));
    const existingCodes = new Set(this.products.map((product) => product.code.toLocaleUpperCase()));
    let sequence = initialNumber;
    let code = `${prefix}-${String(sequence).padStart(3, '0')}`;
    while (existingCodes.has(code.toLocaleUpperCase())) {
      sequence += 1;
      code = `${prefix}-${String(sequence).padStart(3, '0')}`;
    }
    this.productForm.code = code;
  }

  private codePart(value: string): string {
    const firstWord = value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-zA-Z0-9]+/)[0] ?? '';
    return firstWord.slice(0, 3).toLocaleUpperCase() || 'GEN';
  }

  private runMutation<T>(request: import('rxjs').Observable<T>, success: string, afterSuccess?: (result: T) => void): void {
    this.saving = true;
    this.clearMessages();
    request.pipe(timeout({ first: 30_000 }), finalize(() => {
      this.saving = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: (result) => {
        afterSuccess?.(result);
        this.finishMutation(success);
      },
      error: (error: unknown) => this.handleMutationError(error)
    });
  }

  private finishMutation(message: string): void {
    this.successMessage = message;
    this.loadAll();
  }

  private handleMutationError(error: unknown): void {
    this.saving = false;
    if (this.isUnauthorized(error)) {
      this.expireSession();
      return;
    }
    this.errorMessage = this.errorText(error, 'No se pudo guardar el cambio.');
    this.showErrorModal = true;
    this.changeDetector.markForCheck();
  }

  private isUnauthorized(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'status' in error
      && (error as { status?: number }).status === 401;
  }

  private expireSession(): void {
    this.currentUser = null;
    this.products = [];
    this.users = [];
    this.accountUsers = [];
    this.movements = [];
    this.assets = [];
    this.loans = [];
    this.areas = [];
    this.selectedQrDetail = null;
    this.selectedAsset = null;
    this.selectedAssetQr = '';
    this.selectedAssetIds.clear();
    this.qrPrintLabels = [];
    this.loginError = 'La sesión expiró. Inicia sesión de nuevo para continuar.';
    this.showErrorModal = false;
    this.changeDetector.markForCheck();
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof TimeoutError) {
      return 'El servidor tardó demasiado en responder. El registro pudo guardarse; verifica el historial antes de volver a intentarlo.';
    }
    if (typeof error === 'object' && error !== null && 'error' in error) {
      const body = (error as { error?: { message?: string; detail?: string } }).error;
      if (body?.message) return body.message;
      if (body?.detail) return body.detail;
    }
    return fallback;
  }

  private clearMessages(): void {
    this.errorMessage = '';
    this.showErrorModal = false;
    this.successMessage = '';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

}
