// Lightweight offline-ready repository for Orders and OrderLines
// Storage backend: localStorage (can be swapped for IndexedDB later)

import { getOrderSession, addDeliveredQty, setDeliveredQty, setTargetQty, getLineStatus, getOrderStatus } from '@/utils/sessionStore.js';

export interface OrderSnapshot {
  id: number;
  name: string;
  partner?: string;
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
  };
  snapshot: {
    order: OrderSnapshot;
    lines: OrderLineSnapshot[];
  };
  pending?: {
    productUpdates?: Array<{ id: string; lineId: number; oldCode: string; newCode: string; ts: string; synced?: boolean }>;
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
      meta: { version: 1, createdAt: now(), updatedAt: now(), lastSyncedAt: null, revision: 0 },
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

  // Optimistic local change: increments delivered and triggers subscribers
  deliverLine(orderId: number, lineId: number, delta: number) {
    addDeliveredQty(orderId, lineId, delta);
    emit(orderId);
  },

  // Optimistic local change: set delivered to an absolute value and trigger subscribers
  setDeliveredAbsolute(orderId: number, lineId: number, qty: number) {
    setDeliveredQty(orderId, lineId, Math.max(0, qty));
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

  // Debug: get all cached orders from localStorage
  getAllOrderRecords(): Record<string, OrderRecord> {
    const out: Record<string, OrderRecord> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (key.startsWith(LS_PREFIX)) {
        try {
          out[key.substring(LS_PREFIX.length)] = JSON.parse(localStorage.getItem(key) || '{}');
        } catch {
          // ignore
        }
      }
    }
    return out;
  }
};
