import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TimeoutError, finalize, forkJoin, of, timeout } from 'rxjs';
import QRCode from 'qrcode';
import { Area, Asset, DashboardSummary, InventoryPerson, ItemCondition, Loan, LoanLine, Movement, Product, QrAssetDetail, TrackingType, User } from './models';
import { InventoryService } from './inventory.service';

type Section = 'dashboard' | 'products' | 'movements' | 'assets' | 'loans' | 'users' | 'reports';
type ProductSortKey = 'code' | 'name' | 'category' | 'stock';
const CONDITIONS: ItemCondition[] = ['NEW', 'GOOD', 'FAIR', 'DAMAGED', 'OUT_OF_SERVICE'];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html'
})
export class App implements OnInit {
  readonly Math = Math;
  private loginAttempted = false;
  activeSection: Section = 'dashboard';
  products: Product[] = [];
  users: InventoryPerson[] = [];
  accountUsers: User[] = [];
  movements: Movement[] = [];
  areas: Area[] = [];
  assets: Asset[] = [];
  loans: Loan[] = [];
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
  selectedQrDetail: QrAssetDetail | null = null;
  selectedLoan: Loan | null = null;
  assetSearch = '';
  loanProductId = 0;
  loanQuantity = 1;
  loanAssetIds = new Set<number>();
  returnLine: LoanLine | null = null;
  returnQuantity = 1;
  returnAssetIds = new Set<number>();
  returnCondition: ItemCondition = 'GOOD';
  showProductForm = false;
  showMovementForm = false;
  showUserForm = false;
  showAreaForm = false;
  showAssetForm = false;
  showLoanForm = false;
  readonly conditions = CONDITIONS;
  areaForm = { name: '', description: '' };
  assetForm = { productId: 0, assetCode: '', serialNumber: '', areaId: 0, responsibleId: 0, recordedById: 0, condition: 'GOOD' as ItemCondition };
  assignmentForm = { areaId: 0, responsibleId: 0, issuedById: 0, condition: 'GOOD' as ItemCondition, reason: '' };
  loanForm = { borrowerId: 0, issuedById: 0, areaId: 0, purpose: '', dueAt: '' };
  returnForm = { receivedById: 0, returnedById: 0, areaId: 0 };

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
    document.body.classList.remove('printing-report', 'printing-qr');
  }

  get sectionTitle(): string {
    const titles: Record<Section, string> = {
      dashboard: 'Dashboard',
      products: 'Productos',
      movements: 'Entradas y salidas',
      assets: 'Activos, áreas y códigos QR',
      loans: 'Préstamos y devoluciones',
      users: 'Usuarios y permisos',
      reports: 'Reportes'
    };
    return titles[this.activeSection];
  }

  get categories(): string[] {
    return [...new Set(this.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
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
    return this.returnLine?.assets.filter((asset) => asset.status === 'ON_LOAN' && this.selectedLoan?.borrowerId === asset.responsibleId) ?? [];
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
    forkJoin({
      dashboard: this.inventoryService.getDashboard(),
      products: this.inventoryService.getProducts(),
      people: this.inventoryService.getPeople(),
      accounts: this.isAdministrator ? this.inventoryService.getUsers() : of([] as User[]),
      movements: this.inventoryService.getMovements(),
      areas: this.inventoryService.getAreas(),
      assets: this.inventoryService.getAssets(),
      loans: this.inventoryService.getLoans()
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
        if (!this.movementForm.recipientId && people.length) this.movementForm.recipientId = people[0].id;
        if (!this.loanForm.borrowerId && people.length) this.loanForm.borrowerId = people[0].id;
        if (!this.assetForm.responsibleId && people.length) this.assetForm.responsibleId = people[0].id;
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
    this.showProductForm = true;
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
    if (!this.productForm.code.trim() || !this.productForm.name.trim()) return;
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

  deleteUser(user: User): void {
    if (!window.confirm(`¿Desactivar el acceso de ${user.fullName}? Su historial se conservará.`)) return;
    this.runMutation(this.inventoryService.deleteUser(user.id!), 'Acceso de usuario desactivado.');
  }

  saveMovement(): void {
    if (!this.movementForm.productId || !this.movementForm.userId || !this.movementForm.quantity || this.movementForm.quantity <= 0) return;
    const product = this.products.find((item) => item.id === Number(this.movementForm.productId));
    const purpose = this.movementForm.type === 'ENTRADA' ? 'PURCHASE'
      : product?.trackingType === 'FUEL' ? 'FUEL_USE' : 'CONSUMPTION';
    this.runMutation(this.inventoryService.createMovement({ ...this.movementForm, purpose }), 'Movimiento registrado.', () => {
      this.showMovementForm = false;
      this.movementForm = {
        productId: this.movementProducts[0]?.id ?? 0,
        userId: this.currentUser?.id ?? 0,
        type: 'ENTRADA',
        quantity: 1,
        reason: '',
        recipientId: this.users[0]?.id,
        areaId: this.areas[0]?.id,
        vehicleEquipment: '',
        movementDate: this.today()
      };
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
    if (!this.assetForm.productId || !this.assetForm.areaId || !this.assetForm.responsibleId || !this.assetForm.recordedById) return;
    this.runMutation(this.inventoryService.createAsset(this.assetForm), 'Activo registrado y asignado.', () => {
      this.assetForm.assetCode = '';
      this.assetForm.serialNumber = '';
      this.showAssetForm = false;
    });
  }

  startAssignAsset(asset: Asset): void {
    this.assetToAssign = asset;
    this.assignmentForm = {
      areaId: asset.areaId ?? this.areas[0]?.id ?? 0,
      responsibleId: asset.responsibleId ?? this.users[0]?.id ?? 0,
      issuedById: this.currentUser?.id ?? 0,
      condition: asset.condition,
      reason: ''
    };
  }

  saveAssignment(): void {
    if (!this.assetToAssign) return;
    this.runMutation(this.inventoryService.assignAsset(this.assetToAssign.id, this.assignmentForm), 'Asignación del activo actualizada.', () => this.assetToAssign = null);
  }

  toggleLoanAsset(id: number, event: Event): void {
    if ((event.target as HTMLInputElement).checked) this.loanAssetIds.add(id);
    else this.loanAssetIds.delete(id);
  }

  issueLoan(): void {
    const product = this.selectedLoanProduct;
    const serialized = product?.trackingType === 'ASSET';
    const quantity = serialized ? this.loanAssetIds.size : Number(this.loanQuantity);
    if (!product || quantity <= 0 || !this.loanForm.borrowerId || !this.loanForm.issuedById || !this.loanForm.areaId || !this.loanForm.purpose.trim()) return;
    this.runMutation(this.inventoryService.createLoan({
      ...this.loanForm,
      dueAt: this.loanForm.dueAt || null,
      items: [{ productId: product.id, quantity, conditionOut: 'GOOD', assetIds: serialized ? [...this.loanAssetIds] : [] }]
    }), 'Préstamo registrado.', () => {
      this.showLoanForm = false;
      this.loanQuantity = 1;
      this.loanAssetIds.clear();
      this.loanForm.purpose = '';
      this.loanForm.dueAt = '';
    });
  }

  startReturn(loan: Loan, line: LoanLine): void {
    this.selectedLoan = loan;
    this.returnLine = line;
    this.returnQuantity = Math.min(1, line.outstandingQuantity);
    this.returnAssetIds.clear();
    this.returnCondition = 'GOOD';
    this.returnForm = {
      receivedById: this.currentUser?.id ?? 0,
      returnedById: loan.borrowerId,
      areaId: this.areas[0]?.id ?? loan.areaId
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

  async showAssetQr(asset: Asset): Promise<void> {
    this.selectedAsset = asset;
    const url = `${window.location.origin}/qr/${asset.qrToken}`;
    try {
      this.selectedAssetQr = await QRCode.toDataURL(url, { width: 240, margin: 1, errorCorrectionLevel: 'M' });
      this.changeDetector.markForCheck();
    } catch {
      this.errorMessage = 'No se pudo generar el QR localmente.';
      this.showErrorModal = true;
      this.changeDetector.markForCheck();
    }
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
    window.history.pushState({}, '', `/qr/${asset.qrToken}`);
    this.loadQrDetail(asset.qrToken);
  }

  closeAssetDetail(): void {
    this.selectedQrDetail = null;
    if (window.location.pathname.startsWith('/qr/')) window.history.pushState({}, '', '/');
  }

  printQr(): void {
    document.body.classList.remove('printing-report');
    document.body.classList.add('printing-qr');
    window.print();
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
    const match = window.location.pathname.match(/^\/qr\/([0-9a-f-]+)$/i);
    if (match) {
      this.activeSection = 'assets';
      this.loadQrDetail(match[1]);
    } else {
      this.selectedQrDetail = null;
    }
  }

  private loadQrDetail(token: string): void {
    this.inventoryService.getAssetByQr(token).subscribe({
      next: (detail) => {
        this.selectedQrDetail = detail;
        this.changeDetector.markForCheck();
      },
      error: (error: unknown) => {
        this.selectedQrDetail = null;
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

  downloadExcel(): void {
    const rows = [
      ['Fecha', 'Producto', 'Categoría', 'Tipo', 'Cantidad', 'Responsable', 'Motivo'],
      ...this.filteredMovements.map((movement) => [
        movement.movementDate ?? '',
        movement.productName ?? '',
        this.categoryForMovement(movement),
        movement.type,
        String(movement.quantity),
        movement.userName ?? '',
        movement.reason ?? ''
      ])
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map((value) => this.csvCell(value)).join(',')).join('\r\n');
    this.downloadFile(csv, 'reporte-inventario.csv', 'text/csv;charset=utf-8');
  }

  printReport(): void {
    this.reportGeneratedAt = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date());
    document.body.classList.remove('printing-qr');
    document.body.classList.add('printing-report');
    window.print();
  }

  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase();
  }

  private emptyProduct(): Product {
    return { code: '', name: '', category: 'Herramientas', stock: 0, minimumStock: 0, location: '', unit: 'pza', trackingType: 'CONSUMABLE' };
  }

  private runMutation<T>(request: import('rxjs').Observable<T>, success: string, afterSuccess?: () => void): void {
    this.saving = true;
    this.clearMessages();
    request.pipe(timeout({ first: 30_000 }), finalize(() => {
      this.saving = false;
      this.changeDetector.markForCheck();
    })).subscribe({
      next: () => {
        afterSuccess?.();
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

  private downloadFile(contents: string, filename: string, type: string): void {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: string): string {
    const safeValue = /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safeValue.replaceAll('"', '""')}"`;
  }
}
