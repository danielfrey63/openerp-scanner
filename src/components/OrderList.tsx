import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext.js';
import { getOrderStatus } from '@/utils/sessionStore.js';
import { orderRepo } from '@/data/orderRepo.js';
import BackIcon from '@/icons/back-icon.svg';
import SyncLogo from '@/components/SyncLogo.js';
import CacheDropdown from '@/components/CacheDropdown.js';

interface Order {
  id: number;
  name: string;
  partner_id: [number, string];
}

const OrderList: React.FC = () => {
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [error, setError] = React.useState('');
  const navigate = useNavigate();
  const { isAuthenticated } = useOpenERP();

  React.useEffect(() => {
    const loadOrdersFromCache = () => {
      try {
        // UI wird IMMER aus dem lokalen Cache generiert (Cache-First)
        const orderList = orderRepo.getAllOrdersFromCache();
        // Orders in absteigender Reihenfolge sortieren (höchste ID zuerst)
        const sortedOrders = orderList.sort((a, b) => b.id - a.id);
        setOrders(sortedOrders);
        setError('');

        // Falls Cache leer ist, zeige entsprechende Meldung an
        if (orderList.length === 0) {
          setError('Keine Bestellungen im Cache gefunden. Bitte initialisieren Sie den Cache neu.');
        }
      } catch (err) {
        console.error('Error loading orders from cache:', err);
        setError('Error loading orders: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    // Nur laden, wenn authentifiziert
    if (isAuthenticated) {
      loadOrdersFromCache();
    }
  }, [isAuthenticated]);

  // Listen for changes in orderRepo to update the list
  React.useEffect(() => {
    const updateOrderList = () => {
      // Cache-First: Immer aus dem Cache laden
      const orderList = orderRepo.getAllOrdersFromCache();
      // Orders in absteigender Reihenfolge sortieren (höchste ID zuerst)
      const sortedOrders = orderList.sort((a, b) => b.id - a.id);
      setOrders(sortedOrders);
    };

    // Subscribe to all order changes
    const unsubscribers: (() => void)[] = [];
    const cachedOrders = orderRepo.getAllOrderRecords();

    Object.keys(cachedOrders).forEach(orderIdStr => {
      const orderId = parseInt(orderIdStr);
      const unsubscribe = orderRepo.subscribeOrder(orderId, updateOrderList);
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, []);

  const handleOrderClick = (orderId: number) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <SyncLogo className="header-logo" />
          <h2>Open Sale Orders</h2>
        </div>
        <div className="action-buttons">
          <button 
            onClick={() => navigate('/')} 
            className="icon-button secondary" 
            title="Back to Login"
          >
            <img src={BackIcon} alt="Back" />
          </button>
          <CacheDropdown />
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      
      {orders.map(order => {
        const status = getOrderStatus(order.id);
        const cls = status === 'full' ? 'status-full' : status === 'partial' ? 'status-partial' : '';
        const title = status === 'full' ? 'Vollständig (Session)' : status === 'partial' ? 'Teilweise (Session)' : 'Offen';

        // Sync-Status aus lokalem Cache für Rahmen-Farbe
        const orderRecord = orderRepo.getOrder(order.id);
        const syncStatus = orderRecord?.meta.syncStatus || 'local-only';

        // CSS-Klasse basierend auf Sync-Status
        let syncClass = '';
        if (syncStatus === 'synced') {
          syncClass = 'sync-synced'; // Grün für synchronisiert
        } else if (syncStatus === 'pending') {
          syncClass = 'sync-pending'; // Orange für ausstehende Änderungen
        }
        // Kein spezieller Rahmen für 'local-only' oder unbekannt

        return (
          <div
            key={order.id}
            className={`item ${cls} ${syncClass}`}
            title={title}
            onClick={() => handleOrderClick(order.id)}
          >
            {order.name} - {order.partner_id[1]}
          </div>
        );
      })}
    </div>
  );
};

export default OrderList;