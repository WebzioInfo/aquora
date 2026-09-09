import { api } from './api'

export interface RateRule {
  id: string
  productId: string
  productName?: string
  customerId?: string
  customerName?: string
  partyType: 'CUSTOMER' | 'DISTRIBUTOR' | 'ALL'
  refillType: 'WATER_ONLY' | 'NEW_JAR_AND_WATER'
  jarOwnerType: 'COMPANY' | 'CUSTOMER' | 'DISTRIBUTOR'
  minimumQuantity: number
  priority: number
  unitRate: number
  discountRate: number
  taxRate: number
  effectiveFrom: string
  effectiveTo?: string
  requiresAuthorization: boolean
  isActive: boolean
  notes?: string
  createdAt?: string
  createdBy?: string
}

export interface JarMovement {
  id: string
  occurredAt: string
  movementType: string
  quantity: number
  ownerType: string
  fromLocationType?: string
  toLocationType?: string
  containerStatus: string
  referenceType?: string
  referenceId?: string
  notes?: string
}

export interface JarPosition {
  id: string
  positionKey: string
  ownerType: string
  holderType: string
  locationType: string
  containerStatus: string
  quantity: number
}

export interface TwentyLDeliveryItem {
  id: string
  deliveryNumber: string
  deliveredAt: string
  status: 'DRAFT' | 'ASSIGNED' | 'OUT_FOR_DELIVERY' | 'COMPLETED' | 'CANCELLED' | 'FAILED'
  customerId: string
  customerName: string
  distributorId?: string
  distributorName?: string
  productId: string
  productName: string
  filledDeliveredQuantity: number
  emptyCollectedQuantity: number
  damagedJarsQuantity: number
  lostJarsQuantity: number
  unitRate: number
  discountRate: number
  taxRate: number
  subTotal: number
  taxAmount: number
  totalAmount: number
  amountCollected: number
  paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'PENDING'
  paymentMode?: string
  driverName?: string
  vehicleNumber?: string
  routeCode?: string
  jarOwnerType: string
  cancellationReason?: string
  notes?: string
  createdAt: string
  createdBy: string
}

export interface CreateDeliveryPayload {
  customerId: string
  distributorId?: string
  productId: string
  filledDeliveredQuantity: number
  emptyCollectedQuantity: number
  damagedJarsQuantity?: number
  lostJarsQuantity?: number
  unitRateOverride?: number
  amountCollected?: number
  paymentMode?: string
  driverName?: string
  vehicleNumber?: string
  routeCode?: string
}

export interface DistributorSupply {
  id: string
  supplyNumber: string
  distributorId: string
  distributorName: string
  productId: string
  productName: string
  stage: 'CREATED' | 'LOADING' | 'DISPATCHED' | 'RECEIVED' | 'COMPLETED' | 'CANCELLED'
  quantityRequested: number
  quantitySupplied: number
  quantityEmptyReturned: number
  quantityDamaged: number
  appliedRate: number
  totalAmount: number
  amountPaid: number
  paymentStatus: 'PAID' | 'PARTIAL' | 'PENDING'
  paymentMode?: string
  vehicleNumber?: string
  driverName?: string
  dispatcherNotes?: string
  receiverNotes?: string
  dispatchedAt?: string
  receivedAt?: string
  createdAt: string
}

export interface DistributorRoute {
  id: string
  distributorId: string
  routeCode: string
  routeName: string
  areaDescription?: string
  defaultDriverName?: string
  defaultVehicleNumber?: string
  scheduleDays: string
  isActive: boolean
}

export interface DistributorVehicle {
  id: string
  distributorId: string
  registrationNumber: string
  vehicleType: string
  capacityJars: number
  assignedDriverName?: string
  isActive: boolean
}

export interface DistributorDriver {
  id: string
  distributorId: string
  driverName: string
  phone: string
  licenseNumber?: string
  assignedVehicleNumber?: string
  currentRouteId?: string
  isActive: boolean
}

export interface DistributorCustomer {
  id: string
  distributorId: string
  customerName: string
  phone: string
  address?: string
  area?: string
  routeId?: string
  routeName?: string
  deliveryFrequency: string
  defaultRate: number
  assignedDriverName?: string
  assignedVehicleNumber?: string
  filledJarsHeld: number
  emptyJarsHeld: number
  securityDeposit: number
  outstandingBalance: number
  isActive: boolean
}

export interface DistributorDelivery {
  id: string
  deliveryNumber: string
  distributorId: string
  distributorCustomerId: string
  customerName: string
  routeName?: string
  driverName?: string
  vehicleNumber?: string
  quantityFilledDelivered: number
  quantityEmptyCollected: number
  quantityDamaged: number
  sellingRate: number
  companyRefillRate: number
  totalAmount: number
  amountCollected: number
  paymentMode: string
  paymentStatus: string
  grossMargin: number
  deliveryDate: string
  notes?: string
}

export interface DistributorDashboardData {
  distributor: {
    id: string
    name: string
    phone?: string
    address?: string
    distributorType: string
    creditLimit: number
  }
  upstreamCompanyRelationship: {
    totalFilledJarsSupplied: number
    totalEmptiesReturnedToPlant: number
    totalSupplyPurchases: number
    totalPaidToCompany: number
    outstandingDueToCompany: number
  }
  downstreamCustomerBusiness: {
    totalFilledDelivered: number
    totalEmptiesCollected: number
    totalRevenue: number
    totalCollected: number
    customerOutstandingDue: number
    totalGrossMarginEarned: number
  }
  jarInventoryPosition: {
    filledJarsAtDepot: number
    emptyJarsAtDepot: number
    filledWithCustomers: number
    emptyWithCustomers: number
    totalPhysicalJarsInNetwork: number
  }
  counts: {
    activeCustomers: number
    activeRoutes: number
    activeVehicles: number
    activeDrivers: number
  }
  recentSupplies: DistributorSupply[]
  recentDeliveries: DistributorDelivery[]
}

export const twentyLService = {
  // 1. Authoritative Balances & Movements
  async getPlantBalances() {
    const res = await api.get('/api/v1/20l/balances')
    return res.data?.data
  },

  async getMovements(params?: { page?: number; pageSize?: number }) {
    const res = await api.get('/api/v1/20l/ledger', { params })
    return res.data?.data
  },

  async getPositions() {
    const res = await api.get('/api/v1/20l/positions')
    return res.data?.data
  },

  async getCustomerJarPosition(customerId: string) {
    const res = await api.get(`/api/v1/20l/positions/customer/${customerId}`)
    return res.data?.data
  },

  async getCustomerPosition(customerId: string) {
    return this.getCustomerJarPosition(customerId)
  },

  async createMovement(payload: any) {
    const res = await api.post('/api/v1/20l/ledger/movement', payload)
    return res.data?.data
  },

  // 2. Upstream Distributor Supplies (Company -> Distributor)
  async getDistributorSupplies(params?: { distributorId?: string; stage?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number }) {
    const res = await api.get('/api/v1/20l/distributor-supplies', { params })
    return res.data?.data
  },

  async createDistributorSupply(payload: {
    distributorId: string
    productId: string
    productName?: string
    quantityRequested: number
    quantitySupplied: number
    quantityEmptyReturned: number
    quantityDamaged: number
    appliedRate: number
    amountPaid: number
    paymentMode?: string
    vehicleNumber?: string
    driverName?: string
    dispatcherNotes?: string
    receiverNotes?: string
    stage?: string
  }) {
    const res = await api.post('/api/v1/20l/distributor-supplies', payload)
    return res.data?.data
  },

  async receiveDistributorSupply(id: string, payload: { notes?: string }) {
    const res = await api.post(`/api/v1/20l/distributor-supplies/${id}/receive`, payload)
    return res.data?.data
  },

  // 3. Distributor Downstream Management
  async getDistributorRoutes(distributorId: string) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/routes`)
    return res.data?.data as DistributorRoute[]
  },

  async createDistributorRoute(distributorId: string, payload: Partial<DistributorRoute>) {
    const res = await api.post(`/api/v1/20l/distributors/${distributorId}/routes`, payload)
    return res.data?.data
  },

  async updateDistributorRoute(distributorId: string, id: string, payload: Partial<DistributorRoute>) {
    const res = await api.put(`/api/v1/20l/distributors/${distributorId}/routes/${id}`, payload)
    return res.data?.data
  },

  async deleteDistributorRoute(distributorId: string, id: string) {
    const res = await api.delete(`/api/v1/20l/distributors/${distributorId}/routes/${id}`)
    return res.data?.data
  },

  async getDistributorVehicles(distributorId: string) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/vehicles`)
    return res.data?.data as DistributorVehicle[]
  },

  async createDistributorVehicle(distributorId: string, payload: Partial<DistributorVehicle>) {
    const res = await api.post(`/api/v1/20l/distributors/${distributorId}/vehicles`, payload)
    return res.data?.data
  },

  async updateDistributorVehicle(distributorId: string, id: string, payload: Partial<DistributorVehicle>) {
    const res = await api.put(`/api/v1/20l/distributors/${distributorId}/vehicles/${id}`, payload)
    return res.data?.data
  },

  async deleteDistributorVehicle(distributorId: string, id: string) {
    const res = await api.delete(`/api/v1/20l/distributors/${distributorId}/vehicles/${id}`)
    return res.data?.data
  },

  async getDistributorDrivers(distributorId: string) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/drivers`)
    return res.data?.data as DistributorDriver[]
  },

  async createDistributorDriver(distributorId: string, payload: Partial<DistributorDriver>) {
    const res = await api.post(`/api/v1/20l/distributors/${distributorId}/drivers`, payload)
    return res.data?.data
  },

  async updateDistributorDriver(distributorId: string, id: string, payload: Partial<DistributorDriver>) {
    const res = await api.put(`/api/v1/20l/distributors/${distributorId}/drivers/${id}`, payload)
    return res.data?.data
  },

  async deleteDistributorDriver(distributorId: string, id: string) {
    const res = await api.delete(`/api/v1/20l/distributors/${distributorId}/drivers/${id}`)
    return res.data?.data
  },

  async getDistributorCustomers(distributorId: string, params?: { routeId?: string; search?: string }) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/customers`, { params })
    return res.data?.data as DistributorCustomer[]
  },

  async createDistributorCustomer(distributorId: string, payload: Partial<DistributorCustomer>) {
    const res = await api.post(`/api/v1/20l/distributors/${distributorId}/customers`, payload)
    return res.data?.data
  },

  async updateDistributorCustomer(distributorId: string, id: string, payload: Partial<DistributorCustomer>) {
    const res = await api.put(`/api/v1/20l/distributors/${distributorId}/customers/${id}`, payload)
    return res.data?.data
  },

  async deleteDistributorCustomer(distributorId: string, id: string) {
    const res = await api.delete(`/api/v1/20l/distributors/${distributorId}/customers/${id}`)
    return res.data?.data
  },

  // 4. Distributor Customer Deliveries
  async getDistributorDeliveries(distributorId: string, params?: { customerId?: string; fromDate?: string; toDate?: string; page?: number; pageSize?: number }) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/deliveries`, { params })
    return res.data?.data
  },

  async createDistributorDelivery(distributorId: string, payload: {
    distributorCustomerId: string
    routeId?: string
    routeName?: string
    driverName?: string
    vehicleNumber?: string
    productId?: string
    quantityFilledDelivered: number
    quantityEmptyCollected: number
    quantityDamaged: number
    sellingRate: number
    amountCollected: number
    paymentMode?: string
    notes?: string
  }) {
    const res = await api.post(`/api/v1/20l/distributors/${distributorId}/deliveries`, payload)
    return res.data?.data
  },

  // 5. Distributor Business Dashboard
  async getDistributorDashboard(distributorId: string) {
    const res = await api.get(`/api/v1/20l/distributors/${distributorId}/dashboard`)
    return res.data?.data as DistributorDashboardData
  },

  // 6. Driver Mobile Portal
  async getDriverPortalToday(params?: { distributorId?: string; driverName?: string }) {
    const res = await api.get('/api/v1/20l/driver-portal/today', { params })
    return res.data?.data
  },

  async driverDeliverStop(payload: {
    distributorId: string
    customerId: string
    quantityFilledDelivered: number
    quantityEmptyCollected: number
    quantityDamaged: number
    sellingRate: number
    amountCollected: number
    paymentMode?: string
    driverName?: string
    vehicleNumber?: string
    notes?: string
  }) {
    const res = await api.post('/api/v1/20l/driver-portal/deliver-stop', payload)
    return res.data?.data
  },

  // 7. Rate Rules
  async getRateRules(params?: { productId?: string; customerId?: string; partyType?: string; isActive?: boolean }) {
    const res = await api.get('/api/v1/20l/rate-rules', { params })
    return res.data?.data
  },

  async createRateRule(payload: Partial<RateRule>) {
    const res = await api.post('/api/v1/20l/rate-rules', payload)
    return res.data?.data
  },

  async updateRateRule(id: string, payload: Partial<RateRule>) {
    const res = await api.put(`/api/v1/20l/rate-rules/${id}`, payload)
    return res.data?.data
  },

  async deleteRateRule(id: string) {
    const res = await api.delete(`/api/v1/20l/rate-rules/${id}`)
    return res.data?.data
  },

  // 8. Trips & Operations
  async getTrips(params?: { status?: string; plannedDate?: string; page?: number; pageSize?: number }) {
    const res = await api.get('/api/v1/20l/trips', { params })
    return res.data?.data
  },

  async getTrip(id: string) {
    const res = await api.get(`/api/v1/20l/trips/${id}`)
    return res.data?.data
  },

  async createTrip(payload: any) {
    const res = await api.post('/api/v1/20l/trips', payload)
    return res.data?.data
  },

  async loadTrip(id: string, payload: any) {
    const res = await api.post(`/api/v1/20l/trips/${id}/load`, payload)
    return res.data?.data
  },

  async dispatchTrip(id: string) {
    const res = await api.post(`/api/v1/20l/trips/${id}/dispatch`)
    return res.data?.data
  },

  async deliverTripStop(tripId: string, payload: any) {
    const res = await api.post(`/api/v1/20l/trips/${tripId}/deliver-stop`, payload)
    return res.data?.data
  },

  async returnTrip(tripId: string, payload: any) {
    const res = await api.post(`/api/v1/20l/trips/${tripId}/return`, payload)
    return res.data?.data
  },

  async returnAndReconcileTrip(tripId: string, payload: any) {
    const res = await api.post(`/api/v1/20l/trips/${tripId}/return`, payload)
    return res.data?.data
  },

  async reconcileTrip(tripId: string) {
    const res = await api.post(`/api/v1/20l/trips/${tripId}/reconcile`)
    return res.data?.data
  },

  async cancelTrip(id: string, reason: string) {
    const res = await api.post(`/api/v1/20l/trips/${id}/cancel`, { reason })
    return res.data?.data
  },

  // 9. Deliveries (Direct)
  async getDeliveries(params?: { customerId?: string; distributorId?: string; status?: string; page?: number; pageSize?: number }) {
    const res = await api.get('/api/v1/20l/deliveries', { params })
    return res.data?.data
  },

  async createDelivery(payload: CreateDeliveryPayload) {
    const res = await api.post('/api/v1/20l/deliveries', payload)
    return res.data?.data
  },

  async cancelDelivery(id: string, reason: string) {
    const res = await api.post(`/api/v1/20l/deliveries/${id}/cancel`, { reason })
    return res.data?.data
  },

  // 10. All-At-Once & Quick Operations
  async executeAllAtOnceOperation(payload: any) {
    const res = await api.post('/api/v1/20l/operations/all-at-once', payload)
    return res.data?.data
  },

  async quickDelivery(payload: any) {
    const res = await api.post('/api/v1/20l/operations/quick-delivery', payload)
    return res.data?.data
  },

  async quickReturn(payload: any) {
    const res = await api.post('/api/v1/20l/operations/quick-return', payload)
    return res.data?.data
  },

  async quickDamageCondemnation(payload: any) {
    const res = await api.post('/api/v1/20l/operations/quick-damage-condemnation', payload)
    return res.data?.data
  },

  // 11. Quality & Inspections
  async getInspections(params?: { outcome?: string; page?: number; pageSize?: number }) {
    const res = await api.get('/api/v1/20l/inspections', { params })
    return res.data?.data
  },

  async repairQuarantinedJars(payload: { productId?: string; quantity: number; notes?: string }) {
    const res = await api.post('/api/v1/20l/inspections/repair-to-stock', payload)
    return res.data?.data
  },

  // 12. Reconciliation
  async reconcile() {
    const res = await api.get('/api/v1/20l/reconcile')
    return res.data?.data
  },

  // 13. Accounts & Accountability
  async getDistributorAccounts() {
    const res = await api.get('/api/v1/20l/distributors')
    return res.data?.data
  },

  async getDriverAccountability() {
    const res = await api.get('/api/v1/20l/trips')
    return res.data?.data
  }
}
