// Utility functions for sync status indicators and UI helpers

import { OrderRecord } from '@/data/orderRepo.js';

export interface SyncStatusIndicator {
  icon: string;
  color: string;
  text: string;
  description: string;
}

export function getSyncStatusIndicator(order: OrderRecord): SyncStatusIndicator {
  switch (order.meta.syncStatus) {
    case 'synced':
      return {
        icon: '✅',
        color: '#2ed573',
        text: 'Synchronisiert',
        description: 'Alle Änderungen sind mit dem ERP synchronisiert'
      };
    case 'pending':
      return {
        icon: '⏳',
        color: '#ffa502',
        text: 'Ausstehend',
        description: 'Lokale Änderungen warten auf Synchronisation'
      };
    case 'local-only':
      return {
        icon: '📱',
        color: '#ff4757',
        text: 'Nur lokal',
        description: 'Order ist nur lokal verfügbar'
      };
    default:
      return {
        icon: '❓',
        color: '#747d8c',
        text: 'Unbekannt',
        description: 'Sync-Status unbekannt'
      };
  }
}

export function hasPendingDeliveryChanges(order: OrderRecord): boolean {
  return order.pending?.deliveryUpdates?.some(u => !u.synced) || false;
}

export function hasPendingProductChanges(order: OrderRecord): boolean {
  return order.pending?.productUpdates?.some(u => !u.synced) || false;
}

export function getPendingChangesCount(order: OrderRecord): number {
  const deliveryCount = order.pending?.deliveryUpdates?.filter(u => !u.synced).length || 0;
  const productCount = order.pending?.productUpdates?.filter(u => !u.synced).length || 0;
  return deliveryCount + productCount;
}

export function getPendingChangesText(order: OrderRecord): string {
  const count = getPendingChangesCount(order);
  if (count === 0) return '';
  return `${count} Änderung${count !== 1 ? 'en' : ''} ausstehend`;
}

export function formatLastSyncTime(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Nie synchronisiert';
  
  const syncTime = new Date(lastSyncedAt);
  const now = new Date();
  const diffMs = now.getTime() - syncTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Gerade synchronisiert';
  if (diffMinutes < 60) return `Vor ${diffMinutes} Min synchronisiert`;
  if (diffHours < 24) return `Vor ${diffHours} Std synchronisiert`;
  return `Vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''} synchronisiert`;
}
