export interface Product {
  id?: number;
  code: string;
  name: string;
  category: string;
  stock: number;
  minimumStock: number;
  location: string;
  unit: string;
  active?: boolean;
  trackingType?: TrackingType;
  availableStock?: number;
}

export type TrackingType = 'CONSUMABLE' | 'REUSABLE' | 'ASSET' | 'FUEL';
export type ItemCondition = 'NEW' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'OUT_OF_SERVICE';
export type AssetStatus = 'IN_STOCK' | 'ASSIGNED' | 'ON_LOAN' | 'RETIRED';

export interface Area {
  id: number;
  name: string;
  description?: string;
}

export interface Asset {
  id: number;
  qrToken: string;
  assetCode: string;
  serialNumber?: string;
  productId: number;
  productName: string;
  productCode: string;
  areaId?: number;
  areaName?: string;
  responsibleId?: number;
  responsibleName?: string;
  condition: ItemCondition;
  status: AssetStatus;
}

export interface User {
  id?: number;
  fullName: string;
  jobTitle: string;
  role: 'ADMIN' | 'INVENTORY_MANAGER' | 'VIEWER';
  email: string;
  password?: string;
  enabled?: boolean;
}

export interface InventoryPerson {
  id: number;
  fullName: string;
  jobTitle: string;
}

export interface Movement {
  id?: number;
  productId: number;
  userId: number;
  type: 'ENTRADA' | 'SALIDA';
  quantity: number;
  reason?: string;
  movementDate?: string;
  productName?: string;
  userName?: string;
  recipientId?: number;
  recipientName?: string;
  areaId?: number;
  areaName?: string;
  assetId?: number;
  assetCode?: string;
  loanNumber?: string;
  purpose?: MovementPurpose;
  vehicleEquipment?: string;
  conditionBefore?: string;
  conditionAfter?: string;
}

export type MovementPurpose = 'PURCHASE' | 'CONSUMPTION' | 'FUEL_USE' | 'LOAN_ISSUE'
  | 'LOAN_RETURN' | 'ASSET_ASSIGNMENT' | 'ADJUSTMENT' | 'LEGACY';

export interface LoanLine {
  id: number;
  productId: number;
  productName: string;
  productCode: string;
  quantity: number;
  returnedQuantity: number;
  outstandingQuantity: number;
  conditionOut: ItemCondition;
  assets: Asset[];
}

export interface Loan {
  id: number;
  loanNumber: string;
  borrowerId: number;
  borrowerName: string;
  issuedById: number;
  issuedByName: string;
  areaId: number;
  areaName: string;
  purpose: string;
  issuedAt: string;
  dueAt?: string;
  closedAt?: string;
  status: 'OPEN' | 'PARTIALLY_RETURNED' | 'CLOSED';
  items: LoanLine[];
}

export interface QrAssetDetail {
  asset: Asset;
  history: Movement[];
}

export interface DashboardSummary {
  totalProducts: number;
  stocksByUnit: Record<string, number>;
  lowStockCount: number;
  movementsToday: number;
}
