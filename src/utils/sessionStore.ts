// Simple session store for delivered quantities per order line
// Structure in sessionStorage: key `order_session_<orderId>` => { deliveredQty: { [lineId]: number } }

export interface OrderSessionData {
  deliveredQty: Record<number, number>;
  targetQty: Record<number, number>;
}

const prefix = 'order_session_';

function read(orderId: number): OrderSessionData {
  const raw = sessionStorage.getItem(prefix + orderId);
  if (!raw) return { deliveredQty: {}, targetQty: {} } as OrderSessionData;
  try {
    const parsed = JSON.parse(raw);
    return {
      deliveredQty: parsed.deliveredQty || {},
      targetQty: parsed.targetQty || {}
    } as OrderSessionData;
  } catch {
    return { deliveredQty: {}, targetQty: {} } as OrderSessionData;
  }
}

function write(orderId: number, data: OrderSessionData) {
  sessionStorage.setItem(prefix + orderId, JSON.stringify(data));
}

export function getDeliveredQty(orderId: number, lineId: number): number {
  return read(orderId).deliveredQty[lineId] || 0;
}

export function setDeliveredQty(orderId: number, lineId: number, qty: number) {
  const data = read(orderId);
  data.deliveredQty[lineId] = qty;
  write(orderId, data);
}

export function addDeliveredQty(orderId: number, lineId: number, delta: number) {
  const current = getDeliveredQty(orderId, lineId);
  setDeliveredQty(orderId, lineId, Math.max(0, current + delta));
}

export function getOrderSession(orderId: number): OrderSessionData {
  return read(orderId);
}

export function setTargetQty(orderId: number, lineId: number, qty: number) {
  const data = read(orderId);
  if (!data.targetQty) data.targetQty = {} as Record<number, number>;
  data.targetQty[lineId] = qty;
  write(orderId, data);
}

export type LineStatus = 'open' | 'partial' | 'full';

export function getLineStatus(orderId: number, lineId: number): LineStatus {
  const data = read(orderId);
  const delivered = data.deliveredQty[lineId] || 0;
  const target = data.targetQty[lineId] || 0;
  if (target > 0) {
    if (delivered >= target) return 'full';
    if (delivered > 0) return 'partial';
  }
  return 'open';
}

export type OrderStatus = 'open' | 'partial' | 'full';

export function getOrderStatus(orderId: number): OrderStatus {
  const data = read(orderId);
  const lineIds = Object.keys(data.targetQty || {});
  if (lineIds.length === 0) return 'open';
  let hasPartial = false;
  let allFull = true;
  for (const idStr of lineIds) {
    const id = Number(idStr);
    const st = getLineStatus(orderId, id);
    if (st !== 'full') allFull = false;
    if (st === 'partial') hasPartial = true;
    if (st === 'open' && (data.deliveredQty[id] || 0) === 0) {
      // still open
    }
  }
  if (allFull) return 'full';
  if (hasPartial) return 'partial';
  // If any delivered>0 but not all full, it's partial
  const anyDelivered = Object.values(data.deliveredQty || {}).some(v => v > 0);
  return anyDelivered ? 'partial' : 'open';
}

// For debugging all orders in this session
export function getAllSessions(): Record<string, OrderSessionData> {
  const result: Record<string, OrderSessionData> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i)!;
    if (key.startsWith(prefix)) {
      try {
        result[key.substring(prefix.length)] = JSON.parse(sessionStorage.getItem(key) || '{}');
      } catch {
        // ignore
      }
    }
  }
  return result;
}
