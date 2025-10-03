// Lightweight offline-ready repository for Orders and OrderLines
// Storage backend: localStorage (can be swapped for IndexedDB later)

import { getOrderSession, addDeliveredQty, setDeliveredQty, getDeliveredQty, setTargetQty, getLineStatus, getOrderStatus } from '@/utils/sessionStore.js';

// Interface für UI-Kompatibilität
export interface Order {
  id: number;
  name: string;
  partner_id: [number, string];
}

export interface OrderLine {
  id: number;
  name: string;
  product_id: [number, string];
  product_uom_qty: number;
  price_unit?: number;
  productCode?: string;
  productId?: number;
}

export interface OrderSnapshot {
  id: number;
  name: string;
  partner: string; // Partner-Name als String (wird aus partner_id[1] extrahiert)
}

export interface OrderLineSnapshot {
  id: number;
  name: string;
  productCode?: string;
  productId?: number;
  product_uom_qty: number;
}

export interface OrderRecord {
  meta: {
    version: number;
    createdAt: string;
    updatedAt: string;
    lastSyncedAt: string | null;
    revision: number;
    syncStatus: 'synced' | 'pending' | 'local-only' | 'syncing';
  };
  snapshot: {
    order: OrderSnapshot;
    lines: OrderLineSnapshot[];
  };
  pending?: {
    productUpdates?: Array<{ id: string; lineId: number; oldCode: string; newCode: string; ts: string; synced?: boolean }>;
    deliveryUpdates?: Array<{ id: string; lineId: number; oldQty: number; newQty: number; ts: string; synced?: boolean }>;
  };
}

const LS_PREFIX = 'erp_cache_order_';

// In-memory event subscribers per order
const subs = new Map<number, Set<() => void>>();

function emit(orderId: number) {
  const set = subs.get(orderId);
  if (set) set.forEach((cb) => {
    try { cb(); } catch { /* noop */ }
  });
}

function now() {
  return new Date().toISOString();
}

export const orderRepo = {
  subscribeOrder(orderId: number, cb: () => void): () => void {
    if (!subs.has(orderId)) subs.set(orderId, new Set());
    subs.get(orderId)!.add(cb);
    return () => subs.get(orderId)!.delete(cb);
  },

  getOrder(orderId: number): (OrderRecord & {
    session: ReturnType<typeof getOrderSession>;
    derived: {
      orderStatus: ReturnType<typeof getOrderStatus>;
      lineStatus: Record<number, 'open'|'partial'|'full'>;
    };
  }) | null {
    const raw = localStorage.getItem(LS_PREFIX + orderId);
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const session = getOrderSession(orderId);
      const derived = {
        orderStatus: getOrderStatus(orderId),
        lineStatus: Object.fromEntries(
          rec.snapshot.lines.map((l) => [l.id, getLineStatus(orderId, l.id)])
        ) as Record<number, 'open'|'partial'|'full'>
      };
      return { ...rec, session, derived };
    } catch {
      return null;
    }
  },

  upsertSnapshot(orderId: number, order: OrderSnapshot, lines: OrderLineSnapshot[]) {
    const key = LS_PREFIX + orderId;
    const existing = localStorage.getItem(key);
    const base: OrderRecord = existing ? JSON.parse(existing) : {
      meta: { version: 1, createdAt: now(), updatedAt: now(), lastSyncedAt: null, revision: 0, syncStatus: 'local-only' },
      snapshot: { order, lines }
    };
    // If there are pending product updates, apply the latest newCode per line to the incoming snapshot,
    // so UI remains consistent even if ERP snapshot still contains old codes.
    const pending = (base.pending && base.pending.productUpdates) ? base.pending.productUpdates : [];
    const latestByLine = new Map<number, { oldCode: string; newCode: string; ts: string }>();
    for (const u of pending) {
      const prev = latestByLine.get(u.lineId);
      if (!prev || new Date(u.ts).getTime() > new Date(prev.ts).getTime()) {
        latestByLine.set(u.lineId, { oldCode: u.oldCode, newCode: u.newCode, ts: u.ts });
      }
    }
    const applyCode = (name: string, code: string) => (/\[.*?\]/.test(name) ? name.replace(/\[(.*?)\]/, `[${code}]`) : `[${code}] ${name}`);
    const mergedLines = lines.map(l => {
      const upd = latestByLine.get(l.id);
      if (!upd) return l;
      const newName = applyCode(l.name || '', upd.newCode);
      return { ...l, name: newName, productCode: upd.newCode } as OrderLineSnapshot;
    });
    const rec: OrderRecord = {
      meta: {
        ...base.meta,
        updatedAt: now(),
        revision: base.meta.revision + 1,
      },
      snapshot: { order, lines: mergedLines },
      pending: base.pending
    };
    localStorage.setItem(key, JSON.stringify(rec));
    emit(orderId);
  },

  // Initialize target quantities in session from snapshot
  setTargetQtyFromSnapshot(orderId: number) {
    const data = this.getOrder(orderId);
    if (!data) return;
    for (const l of data.snapshot.lines) {
      setTargetQty(orderId, l.id, l.product_uom_qty);
    }
    emit(orderId);
  },

  // Optimistic local change: increments delivered and triggers sync
  deliverLine(orderId: number, lineId: number, delta: number) {
    const currentQty = getDeliveredQty(orderId, lineId);
    const newQty = Math.max(0, currentQty + delta);

    // 1. Lokalen Cache sofort aktualisieren
    addDeliveredQty(orderId, lineId, delta);

    // 2. Delta für Sync vormerken
    this.queueDeliveryUpdate(orderId, lineId, currentQty, newQty);

    // 3. Sofortiger Up-Sync-Versuch (ohne Online-Check!)
    this.triggerDeliverySync(orderId, lineId, newQty);

    emit(orderId);
  },

  // Optimistic local change: set delivered to absolute value and trigger sync
  setDeliveredAbsolute(orderId: number, lineId: number, qty: number) {
    const currentQty = getDeliveredQty(orderId, lineId);
    const newQty = Math.max(0, qty);

    // 1. Lokalen Cache sofort aktualisieren
    setDeliveredQty(orderId, lineId, newQty);

    // 2. Delta für Sync vormerken
    this.queueDeliveryUpdate(orderId, lineId, currentQty, newQty);

    // 3. Sofortiger Up-Sync-Versuch (ohne Online-Check!)
    this.triggerDeliverySync(orderId, lineId, newQty);

    emit(orderId);
  },

  // Persistently update a line's product code/name in the cached snapshot and notify subscribers
  updateLineCode(orderId: number, lineId: number, newCode: string) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const lines = rec.snapshot.lines.map((l) => {
        if (l.id !== lineId) return l;
        const name = l.name || '';
        const updatedName = /\[.*?\]/.test(name)
          ? name.replace(/\[(.*?)\]/, `[${newCode}]`)
          : `[${newCode}] ${name}`;
        return {
          ...l,
          name: updatedName,
          productCode: newCode,
        } as OrderLineSnapshot;
      });
      const newRec: OrderRecord = {
        ...rec,
        meta: { ...rec.meta, updatedAt: new Date().toISOString(), revision: rec.meta.revision + 1 },
        snapshot: { ...rec.snapshot, lines }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  // Enqueue a product update for later sync with ERP
  queueProductUpdate(orderId: number, lineId: number, oldCode: string, newCode: string) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const pending = rec.pending || {};
      const list = pending.productUpdates || [];
      const id = `upd_${orderId}_${lineId}_${Date.now()}`;
      const entry = { id, lineId, oldCode, newCode, ts: new Date().toISOString(), synced: false };
      const newRec: OrderRecord = {
        ...rec,
        meta: { ...rec.meta, updatedAt: new Date().toISOString(), revision: rec.meta.revision + 1 },
        pending: { ...pending, productUpdates: [...list, entry] }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  getPendingProductUpdates(orderId: number) {
    const raw = localStorage.getItem(LS_PREFIX + orderId);
    if (!raw) return [] as Array<{ id: string; lineId: number; oldCode: string; newCode: string; ts: string; synced?: boolean }>;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      return rec.pending?.productUpdates || [];
    } catch {
      return [];
    }
  },

  markProductUpdateSynced(orderId: number, updateId: string) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const list = rec.pending?.productUpdates || [];
      const updatedList = list.map(u =>
        u.id === updateId ? { ...u, synced: true } : u
      );
      const newRec: OrderRecord = {
        ...rec,
        meta: { ...rec.meta, updatedAt: new Date().toISOString(), revision: rec.meta.revision + 1 },
        pending: { ...(rec.pending || {}), productUpdates: updatedList }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  // Delta-Tracking für Delivery-Updates
  queueDeliveryUpdate(orderId: number, lineId: number, oldQty: number, newQty: number) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const pending = rec.pending || {};
      const list = pending.deliveryUpdates || [];
      const id = `del_${orderId}_${lineId}_${Date.now()}`;
      const entry = { id, lineId, oldQty, newQty, ts: new Date().toISOString(), synced: false };
      const newRec: OrderRecord = {
        ...rec,
        meta: {
          ...rec.meta,
          updatedAt: new Date().toISOString(),
          revision: rec.meta.revision + 1,
          syncStatus: 'pending'
        },
        pending: { ...pending, deliveryUpdates: [...list, entry] }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  markDeliveryUpdateSynced(orderId: number, updateId: string) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const list = rec.pending?.deliveryUpdates || [];
      const updatedList = list.map(u =>
        u.id === updateId ? { ...u, synced: true } : u
      );
      const newRec: OrderRecord = {
        ...rec,
        meta: { ...rec.meta, updatedAt: new Date().toISOString(), revision: rec.meta.revision + 1 },
        pending: { ...(rec.pending || {}), deliveryUpdates: updatedList }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  markAsFullySynced(orderId: number) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const newRec: OrderRecord = {
        ...rec,
        meta: {
          ...rec.meta,
          lastSyncedAt: new Date().toISOString(),
          syncStatus: 'synced'
        }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  markAsSyncing(orderId: number) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const newRec: OrderRecord = {
        ...rec,
        meta: {
          ...rec.meta,
          syncStatus: 'syncing'
        }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  markAsLocalOnly(orderId: number) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const newRec: OrderRecord = {
        ...rec,
        meta: {
          ...rec.meta,
          syncStatus: 'local-only'
        }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  hasPendingChanges(orderId: number): boolean {
    const order = this.getOrder(orderId);
    if (!order) return false;

    const pendingProducts = order.pending?.productUpdates?.some(u => !u.synced) || false;
    const pendingDeliveries = order.pending?.deliveryUpdates?.some(u => !u.synced) || false;

    return pendingProducts || pendingDeliveries;
  },

  triggerDeliverySync(orderId: number, lineId: number, newQty: number) {
    // Dynamischer Import um zirkuläre Abhängigkeiten zu vermeiden
    import('@/services/syncService.js').then(({ syncService }) => {
      syncService.syncDeliveryChange(orderId, lineId, newQty)
        .catch(error => {
          console.log('[OrderRepo] Sync failed, keeping delta:', error);
          // Delta bleibt in pending, wird bei Logo-Klick synchronisiert
        });
    });
  },

  getAllOrderRecords(): Record<string, OrderRecord> {
    const result: Record<string, OrderRecord> = {};

    // Durchsuche localStorage nach allen Order-Records
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(LS_PREFIX)) {
        try {
          const orderIdStr = key.substring(LS_PREFIX.length);
          const raw = localStorage.getItem(key);
          if (raw) {
            const record = JSON.parse(raw) as OrderRecord;
            result[orderIdStr] = record;
          }
        } catch {
          // Ignore invalid records
        }
      }
    }

    return result;
  },

  clearProductUpdate(orderId: number, updateId: string) {
    const key = LS_PREFIX + orderId;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    try {
      const rec = JSON.parse(raw) as OrderRecord;
      const list = rec.pending?.productUpdates || [];
      const newList = list.filter(u => u.id !== updateId);
      const newRec: OrderRecord = {
        ...rec,
        meta: { ...rec.meta, updatedAt: new Date().toISOString(), revision: rec.meta.revision + 1 },
        pending: { ...(rec.pending || {}), productUpdates: newList }
      };
      localStorage.setItem(key, JSON.stringify(newRec));
      emit(orderId);
    } catch {
      // ignore
    }
  },

  // Cache-First Methoden für UI-Komponenten
  
  // Sicherstellen, dass Daten im Cache vorhanden sind
  ensureOrderCached(orderId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.getOrder(orderId)) {
        resolve();
        return;
      }
      
      // Wenn nicht im Cache, über Sync-Service laden
      import('@/services/syncService.js').then(({ syncService }) => {
        syncService.loadOrderDetails(orderId)
          .then(() => resolve())
          .catch(reject);
      });
    });
  },
  
  // Alle Orders aus Cache laden
  getAllOrdersFromCache(): Order[] {
    const cachedOrders = this.getAllOrderRecords();
    return Object.values(cachedOrders).map(record => ({
      id: record.snapshot.order.id,
      name: record.snapshot.order.name,
      partner_id: typeof record.snapshot.order.partner === 'string'
        ? [0, record.snapshot.order.partner]
        : record.snapshot.order.partner || [0, 'Unknown Partner']
    }));
  },
  
  // Order-Lines aus Cache laden
  getOrderLinesFromCache(orderId: number): OrderLine[] {
    const order = this.getOrder(orderId);
    if (!order) return [];
    
    return order.snapshot.lines.map(line => ({
      ...line,
      product_id: [line.productId || 0, line.name],
      price_unit: 0 // Standardwert, da nicht im Cache gespeichert
    }));
  },
  
  // Anzahl der ausstehenden Änderungen für eine Order
  getPendingChangesCount(orderId: number): number {
    const order = this.getOrder(orderId);
    if (!order) return 0;
    
    const deliveryCount = order.pending?.deliveryUpdates?.filter(u => !u.synced).length || 0;
    const productCount = order.pending?.productUpdates?.filter(u => !u.synced).length || 0;
    
    return deliveryCount + productCount;
  },

};
