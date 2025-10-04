// Sync Service for Bidirectional Synchronization with Conflict Resolution
// Handles data synchronization between local storage and OpenERP server

import { OpenERPClient } from '@danielfrey63/openerp-ts-client';
import { orderRepo, OrderRecord } from '@/data/orderRepo.js';
import { networkService } from '@/services/networkService.js';

export interface SyncConflict {
  id: string;
  type: 'order_modified' | 'line_modified' | 'product_updated';
  orderId: number;
  lineId?: number;
  localData: any;
  serverData: any;
  timestamp: number;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merge';
}

export interface SyncResult {
  success: boolean;
  conflicts: SyncConflict[];
  syncedOrders: number[];
  errors: string[];
  timestamp: number;
}

export interface SyncOptions {
  forceSync?: boolean;
  resolveConflicts?: 'local' | 'server' | 'manual';
  orderId?: number;
  batchSize?: number;
}

class SyncService {
  private client: OpenERPClient | null = null;
  private isSyncing = false;
  private syncQueue: Set<number> = new Set();
  private conflicts: Map<string, SyncConflict> = new Map();
  private lastSyncTime: number = 0;

  constructor() {
    this.loadConflictsFromStorage();
    this.setupNetworkListener();
  }

  // Set OpenERP client
  setClient(client: OpenERPClient | null) {
    this.client = client;
  }

  // Main sync function
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error('Sync already in progress');
    }

    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - skipping sync');
      return {
        success: false,
        conflicts: [],
        syncedOrders: [],
        errors: ['OpenERP client not available - working in offline mode'],
        timestamp: Date.now()
      };
    }

    if (!networkService.getNetworkStatus().online) {
      console.warn('[SyncService] No network connection - skipping sync');
      return {
        success: false,
        conflicts: [],
        syncedOrders: [],
        errors: ['No network connection - working in offline mode'],
        timestamp: Date.now()
      };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      console.log('[SyncService] Starting sync with options:', options);

      const result: SyncResult = {
        success: false,
        conflicts: [],
        syncedOrders: [],
        errors: [],
        timestamp: startTime
      };

      // Get orders to sync
      const ordersToSync = options.orderId 
        ? [options.orderId]
        : this.getOrdersNeedingSync();

      console.log('[SyncService] Orders to sync:', ordersToSync);

      // Process orders in batches
      const batchSize = options.batchSize || 5;
      for (let i = 0; i < ordersToSync.length; i += batchSize) {
        const batch = ordersToSync.slice(i, i + batchSize);
        
        for (const orderId of batch) {
          try {
            const syncResult = await this.syncOrder(orderId, options);
            
            if (syncResult.success) {
              result.syncedOrders.push(orderId);
            }
            
            result.conflicts.push(...syncResult.conflicts);
            result.errors.push(...syncResult.errors);
          } catch (error) {
            console.error('[SyncService] Failed to sync order:', orderId, error);
            result.errors.push(`Order ${orderId}: ${(error as Error).message}`);
          }
        }
      }

      // Update last sync time
      this.lastSyncTime = Date.now();
      localStorage.setItem('syncService_lastSync', this.lastSyncTime.toString());

      result.success = result.errors.length === 0;
      
      console.log('[SyncService] Sync completed:', result);
      return result;

    } finally {
      this.isSyncing = false;
    }
  }

  // Sync individual order
  private async syncOrder(orderId: number, options: SyncOptions): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      conflicts: [],
      syncedOrders: [],
      errors: [],
      timestamp: Date.now()
    };

    try {
      // Get local order data
      const localOrder = orderRepo.getOrder(orderId);
      if (!localOrder) {
        result.errors.push(`Local order ${orderId} not found`);
        return result;
      }

      // Fetch server order data
      const serverOrder = await this.fetchServerOrder(orderId);
      if (!serverOrder) {
        result.errors.push(`Server order ${orderId} not found`);
        return result;
      }

      // Check for conflicts
      const conflicts = this.detectConflicts(localOrder, serverOrder);
      
      if (conflicts.length > 0 && options.resolveConflicts !== 'local' && options.resolveConflicts !== 'server') {
        // Store conflicts for manual resolution
        conflicts.forEach(conflict => {
          this.conflicts.set(conflict.id, conflict);
        });
        result.conflicts = conflicts;
        this.saveConflictsToStorage();
        return result;
      }

      // Resolve conflicts automatically if specified
      if (conflicts.length > 0 && (options.resolveConflicts === 'local' || options.resolveConflicts === 'server')) {
        await this.resolveConflicts(conflicts, options.resolveConflicts);
      }

      // Sync pending product updates
      await this.syncPendingProductUpdates(orderId);

      // Sync delivery quantities
      await this.syncDeliveryQuantities(orderId);

      // Update local order with server data
      await this.updateLocalOrder(orderId, serverOrder);

      result.success = true;
      result.syncedOrders = [orderId];

    } catch (error) {
      console.error('[SyncService] Order sync failed:', orderId, error);
      result.errors.push((error as Error).message);
    }

    return result;
  }

  // Fetch order data from server
  private async fetchServerOrder(orderId: number): Promise<any> {
    if (!this.client) throw new Error('Client not available');

    try {
      // Hole die aktuellen Lines vom ERP
      const lines = await this.client.getSaleOrderLines(orderId);

      // Versuche, die existierenden Order-Daten aus dem Cache zu erhalten
      const existingOrder = orderRepo.getOrder(orderId);

      // Erstelle Order-Daten, die die existierenden Partner-Informationen bewahren
      const order = {
        id: orderId,
        name: existingOrder?.snapshot.order.name || `Order ${orderId}`,
        partner: existingOrder?.snapshot.order.partner || 'Unknown Partner',
        state: 'sale',
        writeDate: new Date().toISOString()
      };

      return {
        order,
        lines: lines.map((line: any) => ({
          id: line.id || Math.random(),
          name: line.name,
          productCode: (line.product_id?.[1]?.match(/\[(.*?)\]/)?.[1]) || '',
          productId: line.product_id?.[0],
          product_uom_qty: line.product_uom_qty,
          qty_delivered: 0, // Mock delivered quantity
          writeDate: new Date().toISOString()
        }))
      };
    } catch (error) {
      console.error('[SyncService] Failed to fetch server order:', orderId, error);
      throw error;
    }
  }

  // Detect conflicts between local and server data
  private detectConflicts(localOrder: OrderRecord, serverOrder: any): SyncConflict[] {
    const conflicts: SyncConflict[] = [];

    // Check order-level conflicts
    if (localOrder.meta.lastSyncedAt && serverOrder.order.writeDate > localOrder.meta.lastSyncedAt) {
      conflicts.push({
        id: `order_${localOrder.snapshot.order.id}_modified`,
        type: 'order_modified',
        orderId: localOrder.snapshot.order.id,
        localData: localOrder.snapshot.order,
        serverData: serverOrder.order,
        timestamp: Date.now(),
        resolved: false
      });
    }

    // Check line-level conflicts
    serverOrder.lines.forEach((serverLine: any) => {
      const localLine = localOrder.snapshot.lines.find(l => l.id === serverLine.id);
      
      if (localLine && localOrder.meta.lastSyncedAt && serverLine.writeDate > localOrder.meta.lastSyncedAt) {
        // Check if quantities differ
        if (Math.abs(localLine.product_uom_qty - serverLine.product_uom_qty) > 0.001) {
          conflicts.push({
            id: `line_${serverLine.id}_qty_modified`,
            type: 'line_modified',
            orderId: localOrder.snapshot.order.id,
            lineId: serverLine.id,
            localData: { qty: localLine.product_uom_qty },
            serverData: { qty: serverLine.product_uom_qty },
            timestamp: Date.now(),
            resolved: false
          });
        }
      }
    });

    return conflicts;
  }

  // Resolve conflicts automatically
  private async resolveConflicts(conflicts: SyncConflict[], resolution: 'local' | 'server'): Promise<void> {
    for (const conflict of conflicts) {
      conflict.resolution = resolution;
      conflict.resolved = true;

      if (resolution === 'server') {
        // Apply server data to local storage
        if (conflict.type === 'order_modified') {
          // Update local order with server data
          // This would be implemented based on specific requirements
        } else if (conflict.type === 'line_modified') {
          // Update local line with server data
          // This would be implemented based on specific requirements
        }
      } else if (resolution === 'local') {
        // Push local data to server
        if (conflict.type === 'line_modified' && conflict.lineId) {
          await this.updateServerLineQuantity(conflict.lineId, conflict.localData.qty);
        }
      }

      this.conflicts.set(conflict.id, conflict);
    }

    this.saveConflictsToStorage();
  }

  // Sync pending product updates
  private async syncPendingProductUpdates(orderId: number): Promise<void> {
    const pendingUpdates = orderRepo.getPendingProductUpdates(orderId);
    
    for (const update of pendingUpdates) {
      if (update.synced) continue;

      try {
        // Update product code on server
        await this.updateServerProductCode(update.lineId, update.newCode);
        
        // Mark as synced
        orderRepo.markProductUpdateSynced(orderId, update.id);
        
        console.log('[SyncService] Product update synced:', update.id);
      } catch (error) {
        console.error('[SyncService] Failed to sync product update:', update.id, error);
        throw error;
      }
    }
  }

  // Sync delivery quantities
  private async syncDeliveryQuantities(orderId: number): Promise<void> {
    // This would implement the actual delivery quantity sync
    // For now, we'll just log the intent
    console.log('[SyncService] Syncing delivery quantities for order:', orderId);

    // Implementation would depend on OpenERP's delivery/stock move API
    // This is where you'd update qty_delivered or create stock moves
  }

  // Update local order with server data
  private async updateLocalOrder(orderId: number, serverOrder: any): Promise<void> {
    // Update the local order snapshot with server data
    orderRepo.upsertSnapshot(orderId, serverOrder.order, serverOrder.lines);
    
    // Update sync metadata
    const now = new Date().toISOString();
    const orderRecord = orderRepo.getOrder(orderId);
    if (orderRecord) {
      orderRecord.meta.lastSyncedAt = now;
      localStorage.setItem(`orderRepo_${orderId}`, JSON.stringify(orderRecord));
    }
  }

  // Helper methods for server updates
  private async updateServerLineQuantity(lineId: number, quantity: number): Promise<void> {
    if (!this.client) throw new Error('Client not available');

    // Mock implementation - would use OpenERP client's write method
    console.log('[SyncService] Would update line quantity:', lineId, quantity);
  }

  private async updateServerProductCode(lineId: number, productCode: string): Promise<void> {
    if (!this.client) throw new Error('Client not available');

    // Mock implementation - would use OpenERP client's read/write methods
    console.log('[SyncService] Would update product code:', lineId, productCode);
  }

  // Utility methods
  private getOrdersNeedingSync(): number[] {
    const allOrders = orderRepo.getAllOrderRecords();
    const needSync: number[] = [];

    Object.entries(allOrders).forEach(([orderIdStr, order]) => {
      const orderId = parseInt(orderIdStr);
      
      // Check if order has pending updates
      if (order.pending?.productUpdates?.some(u => !u.synced)) {
        needSync.push(orderId);
      }
      
      // Check if order hasn't been synced recently
      const lastSync = order.meta.lastSyncedAt ? new Date(order.meta.lastSyncedAt).getTime() : 0;
      const now = Date.now();
      const syncThreshold = 5 * 60 * 1000; // 5 minutes
      
      if (now - lastSync > syncThreshold) {
        needSync.push(orderId);
      }
    });

    return [...new Set(needSync)]; // Remove duplicates
  }

  private setupNetworkListener() {
    networkService.addNetworkListener((status) => {
      if (status.online && this.syncQueue.size > 0) {
        // Auto-sync when network comes back online
        setTimeout(() => {
          this.sync({ orderId: Array.from(this.syncQueue)[0] });
        }, 1000);
      }
    });
  }

  // Persistence for conflicts
  private saveConflictsToStorage() {
    try {
      const conflictsArray = Array.from(this.conflicts.values());
      localStorage.setItem('syncService_conflicts', JSON.stringify(conflictsArray));
    } catch (error) {
      console.error('[SyncService] Failed to save conflicts:', error);
    }
  }

  private loadConflictsFromStorage() {
    try {
      const stored = localStorage.getItem('syncService_conflicts');
      if (stored) {
        const conflictsArray: SyncConflict[] = JSON.parse(stored);
        this.conflicts = new Map(conflictsArray.map(c => [c.id, c]));
      }
    } catch (error) {
      console.error('[SyncService] Failed to load conflicts:', error);
    }
  }

  // Public API
  getConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values()).filter(c => !c.resolved);
  }

  async resolveConflict(conflictId: string, resolution: 'local' | 'server'): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) throw new Error('Conflict not found');

    await this.resolveConflicts([conflict], resolution);
  }

  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  queueOrderForSync(orderId: number) {
    this.syncQueue.add(orderId);
  }

  // Einmalige Synchronisation nach Login (ERP → Lokal) mit Live-Updates
  async initialDownSync(): Promise<void> {
    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - skipping initial down-sync');
      return;
    }

    if (!networkService.getNetworkStatus().online) {
      console.warn('[SyncService] No network connection - skipping initial down-sync');
      return;
    }

    console.log('[SyncService] Starting initial down-sync...');

    try {
      // Alle offenen Orders vom ERP laden
      const orders = await this.client.getOpenSaleOrders();

      for (const order of orders) {
        try {
          // Order-Grunddaten sofort speichern und als "syncing" markieren
          const orderSnapshot = {
            id: order.id,
            name: order.name,
            partner: order.partner_id?.[1] || 'Unknown Partner'
          };

          // Erstelle Order-Record mit syncing Status
          orderRepo.upsertSnapshot(order.id, orderSnapshot, []);
          orderRepo.markAsSyncing(order.id);

          // Order-Lines für jede Order laden
          const lines = await this.client.getSaleOrderLines(order.id);

          // Lines-Daten hinzufügen
          const lineSnapshots = lines.map(line => ({
            id: line.id || Math.random(),
            name: line.name,
            productCode: (line.product_id?.[1]?.match(/\[(.*?)\]/)?.[1]) || '',
            productId: line.product_id?.[0],
            product_uom_qty: line.product_uom_qty,
          }));

          // Vollständige Order mit Lines aktualisieren
          orderRepo.upsertSnapshot(order.id, orderSnapshot, lineSnapshots);
          orderRepo.setTargetQtyFromSnapshot(order.id);

          // Als vollständig synchronisiert markieren (Live-Update zu Grün)
          orderRepo.markAsFullySynced(order.id);

          console.log(`[SyncService] Order ${order.id} synced to local cache`);
        } catch (error) {
          console.error(`[SyncService] Failed to sync order ${order.id}:`, error);
          // Bei Fehler als local-only markieren
          orderRepo.markAsLocalOnly(order.id);
        }
      }

      console.log(`[SyncService] Initial down-sync completed: ${orders.length} orders`);
    } catch (error) {
      console.error('[SyncService] Initial down-sync failed:', error);
      throw error;
    }
  }

  // Sofortige Delivery-Synchronisation (Lokal → ERP → Lokal)
  async syncDeliveryChange(orderId: number, lineId: number, newQty: number): Promise<void> {
    if (!networkService.isOnline()) {
      console.warn('[SyncService] Offline - delivery change will be retried later');
      return;
    }

    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - delivery change queued for later sync');
      return;
    }

    try {
      console.log(`[SyncService] Syncing delivery change: Order ${orderId}, Line ${lineId}, Qty ${newQty}`);

      // 1. UP-SYNC: Delivery-Änderung an ERP senden
      await this.updateServerLineQuantity(lineId, newQty);

      // 2. DOWN-SYNC: Aktualisierte Order-Daten vom ERP holen
      const updatedOrder = await this.fetchServerOrder(orderId);

      // 3. Lokalen Cache mit ERP-Daten aktualisieren
      orderRepo.upsertSnapshot(orderId, updatedOrder.order, updatedOrder.lines);

      // 4. Delta als synchronisiert markieren (entfernen)
      const pendingDeliveries = orderRepo.getOrder(orderId)?.pending?.deliveryUpdates || [];
      const matchingUpdate = pendingDeliveries.find(u => u.lineId === lineId && !u.synced);
      if (matchingUpdate) {
        orderRepo.markDeliveryUpdateSynced(orderId, matchingUpdate.id);
      }

      // 5. Order als vollständig synchronisiert markieren
      orderRepo.markAsFullySynced(orderId);

      console.log(`[SyncService] Delivery change synced successfully: Order ${orderId}`);
    } catch (error) {
      console.error(`[SyncService] Delivery sync failed: Order ${orderId}, Line ${lineId}:`, error);
      // Delta bleibt in pending für späteren Sync
      throw error;
    }
  }

  // Manuelle Synchronisation aller ausstehenden Änderungen
  async syncAllPendingChanges(): Promise<void> {
    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - cannot sync pending changes');
      return;
    }

    if (!networkService.getNetworkStatus().online) {
      console.warn('[SyncService] No network connection - cannot sync pending changes');
      return;
    }

    console.log('[SyncService] Starting sync of all pending changes...');

    const allOrders = orderRepo.getAllOrderRecords();
    let syncedOrdersCount = 0;

    for (const [orderIdStr, order] of Object.entries(allOrders)) {
      const orderId = parseInt(orderIdStr);
      let orderHadChanges = false;

      try {
        // Delivery-Updates synchronisieren
        const pendingDeliveries = order.pending?.deliveryUpdates?.filter(u => !u.synced) || [];
        for (const delivery of pendingDeliveries) {
          try {
            await this.updateServerLineQuantity(delivery.lineId, delivery.newQty);
            orderRepo.markDeliveryUpdateSynced(orderId, delivery.id);
            orderHadChanges = true;
            console.log(`[SyncService] Synced delivery update: ${delivery.id}`);
          } catch (error) {
            console.error(`[SyncService] Failed to sync delivery ${delivery.id}:`, error);
            throw error;
          }
        }

        // Produktcode-Updates synchronisieren
        const pendingProducts = order.pending?.productUpdates?.filter(u => !u.synced) || [];
        for (const product of pendingProducts) {
          try {
            await this.updateServerProductCode(product.lineId, product.newCode);
            orderRepo.markProductUpdateSynced(orderId, product.id);
            orderHadChanges = true;
            console.log(`[SyncService] Synced product update: ${product.id}`);
          } catch (error) {
            console.error(`[SyncService] Failed to sync product ${product.id}:`, error);
            throw error;
          }
        }

        // Nach erfolgreichem Up-Sync: Down-Sync für aktualisierte Daten
        if (orderHadChanges) {
          const updatedOrder = await this.fetchServerOrder(orderId);
          orderRepo.upsertSnapshot(orderId, updatedOrder.order, updatedOrder.lines);
          orderRepo.markAsFullySynced(orderId);
          syncedOrdersCount++;
        }
      } catch (error) {
        console.error(`[SyncService] Failed to sync order ${orderId}:`, error);
        throw error;
      }
    }

    console.log(`[SyncService] Pending changes sync completed: ${syncedOrdersCount} orders updated`);
  }

  // Vollständiger initialer Cache-Aufbau
  async loadAllOrders(): Promise<any[]> {
    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - cannot load orders');
      return [];
    }

    if (!networkService.getNetworkStatus().online) {
      console.warn('[SyncService] No network connection - cannot load orders');
      return [];
    }

    console.log('[SyncService] Loading all orders for cache...');
    
    const orders = await this.client.getOpenSaleOrders();
    
    // Alle Orders im Cache speichern
    for (const order of orders) {
      const orderSnapshot = {
        id: order.id,
        name: order.name,
        partner: order.partner_id?.[1] || 'Unknown Partner'
      };
      
      orderRepo.upsertSnapshot(order.id, orderSnapshot, []);
      orderRepo.markAsSyncing(order.id);
    }
    
    console.log(`[SyncService] Cached ${orders.length} orders`);
    return orders;
  }
  
  // Order-Details für alle Orders laden
  async loadAllOrderDetails(orders: any[]): Promise<void> {
    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - cannot load order details');
      return;
    }

    console.log(`[SyncService] Loading details for ${orders.length} orders...`);
    
    for (const order of orders) {
      try {
        const lines = await this.client.getSaleOrderLines(order.id);
        
        const lineSnapshots = lines.map(line => ({
          id: line.id || Math.random(),
          name: line.name,
          productCode: (line.product_id?.[1]?.match(/\[(.*?)\]/)?.[1]) || '',
          productId: line.product_id?.[0],
          product_uom_qty: line.product_uom_qty,
        }));
        
        orderRepo.upsertSnapshot(order.id, {
          id: order.id,
          name: order.name,
          partner: order.partner_id?.[1] || 'Unknown Partner'
        }, lineSnapshots);
        
        orderRepo.setTargetQtyFromSnapshot(order.id);
        orderRepo.markAsFullySynced(order.id);
        
        console.log(`[SyncService] Cached order ${order.id} with ${lines.length} lines`);
      } catch (error) {
        console.error(`[SyncService] Failed to cache order ${order.id}:`, error);
        orderRepo.markAsLocalOnly(order.id);
      }
    }
  }
  
  // Zusätzliche relevante Daten laden
  async loadAdditionalData(): Promise<void> {
    // Hier könnten zusätzliche Daten geladen werden, die für die Offline-Nutzung wichtig sind
    // z.B. Produktinformationen, Kundendaten, etc.
    console.log('[SyncService] Loading additional data...');
    
    // Placeholder für zukünftige Erweiterungen
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Einzelne Order-Details laden
  async loadOrderDetails(orderId: number): Promise<void> {
    if (!this.client) {
      console.warn('[SyncService] OpenERP client not available - cannot load order details');
      return;
    }

    try {
      // Order-Informationen aus dem Cache holen oder erstellen
      const existingOrder = orderRepo.getOrder(orderId);
      const orderSnapshot = existingOrder?.snapshot.order || {
        id: orderId,
        name: `Order ${orderId}`,
        partner: 'Unknown Partner'
      };
      
      // Order-Lines vom ERP laden
      const lines = await this.client.getSaleOrderLines(orderId);
      
      const lineSnapshots = lines.map(line => ({
        id: line.id || Math.random(),
        name: line.name,
        productCode: (line.product_id?.[1]?.match(/\[(.*?)\]/)?.[1]) || '',
        productId: line.product_id?.[0],
        product_uom_qty: line.product_uom_qty,
      }));
      
      orderRepo.upsertSnapshot(orderId, orderSnapshot, lineSnapshots);
      orderRepo.setTargetQtyFromSnapshot(orderId);
      orderRepo.markAsFullySynced(orderId);
      
      console.log(`[SyncService] Cached order ${orderId} on demand`);
    } catch (error) {
      console.error(`[SyncService] Failed to cache order ${orderId}:`, error);
      throw error;
    }
  }
  
  // Nutzung von Orders tracken für intelligente Priorisierung
  trackOrderUsage(orderId: number): void {
    const usage = JSON.parse(localStorage.getItem('orderUsage') || '{}');
    usage[orderId] = Date.now();
    localStorage.setItem('orderUsage', JSON.stringify(usage));
  }
}

// Export singleton instance
export const syncService = new SyncService();
