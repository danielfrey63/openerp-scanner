import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext.js';
import { OrderLine } from '@/data/orderRepo.js';
import BackIcon from '@/icons/back-icon.svg';
import SyncLogo from '@/components/SyncLogo.js';
import CameraIcon from '@/icons/camera-icon.svg';
import Camera from '@/components/Camera.js';
// SyncStatus removed - sync happens automatically in background
import { extractProductIdFromUrlOrPayload, first4AndLastEqual, getOrderLineCode, getDefaultQuantityFromCode } from '@/utils/orderProcessing.js';
import PlusIcon from '@/icons/plus.svg';
import MinusIcon from '@/icons/minus.svg';
import CheckIcon from '@/icons/check.svg';
import StopIcon from '@/icons/stop.svg';
import StatusOpenIcon from '@/icons/status-open.svg';
import StatusPartialIcon from '@/icons/status-partial.svg';
import StatusFullIcon from '@/icons/status-full.svg';
import { getLineStatus, getDeliveredQty, getOrderSession } from '@/utils/sessionStore.js';
import { orderRepo } from '@/data/orderRepo.js';
import { useOrderSync } from '@/hooks/useBackgroundSync.js';
import { syncService } from '@/services/syncService.js';

const OrderDetails: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);
  const [pendingScanCode, setPendingScanCode] = useState<string | null>(null);
  const [qtyPromptOpen, setQtyPromptOpen] = useState<boolean>(false);
  const [qtyValue, setQtyValue] = useState<number>(1);
  const [pendingTargetLineId, setPendingTargetLineId] = useState<number | null>(null);
  const [absoluteEdit, setAbsoluteEdit] = useState<boolean>(false);
  const [productChanges, setProductChanges] = useState<Record<number, { oldCode: string; newCode: string }>>({});
  const { client, isAuthenticated } = useOpenERP();

  // Background sync for this order
  const {
    orderConflicts,
    hasOrderConflicts,
    resolveConflict
  } = useOrderSync(parseInt(orderId || '0'));

  useEffect(() => {
    const fetchOrderLinesFromCache = async () => {
      try {
        if (!orderId) {
          throw new Error('Order ID is required');
        }

        const oid = parseInt(orderId);
        
        // Sicherstellen, dass Order im Cache ist
        await orderRepo.ensureOrderCached(oid);
        
        // Order-Lines aus Cache laden
        const cachedLines = orderRepo.getOrderLinesFromCache(oid);
        setOrderLines(cachedLines);
        
        // Target-Mengen aus Cache initialisieren
        orderRepo.setTargetQtyFromSnapshot(oid);
        
        // Nutzung der Order tracken für intelligente Priorisierung
        syncService.trackOrderUsage?.(oid);
        
      } catch (err) {
        setError('Failed to load order lines from cache: ' + (err instanceof Error ? err.message : String(err)));
        
        // If not authenticated, redirect to login
        if (err instanceof Error && err.message === 'Not authenticated') {
          navigate('/');
        }
      }
    };

    if (orderId && isAuthenticated) {
      fetchOrderLinesFromCache();
    }
  }, [orderId, isAuthenticated, navigate]);

  // Compute next pending line: first line that is NOT full according to session store
  const nextPendingLine = useMemo(() => {
    if (!orderId) return null;
    const oid = parseInt(orderId);
    return orderLines.find(l => getLineStatus(oid, l.id) !== 'full') || null;
  }, [orderLines, orderId]);

  // Stub for delivery until ERP method is confirmed
  const deliverOrderLine = async (orderIdNum: number, line: OrderLine, quantity: number) => {
    // TODO: Replace with real ERP call when method is confirmed
    console.info('Delivering line (stub):', { orderIdNum, lineId: line.id, quantity });
  };

  const handleScanComplete = async (payload: string) => {
    try {
      setProcessing(true);
      const scannedCode = (extractProductIdFromUrlOrPayload(payload) || '').toUpperCase();

      if (!nextPendingLine) {
        setShowCamera(false);
        return;
      }

      const expectedCode = (getOrderLineCode(nextPendingLine.name) || '').toUpperCase();

      if (!scannedCode) {
        setError('Kein gültiger Code erkannt.');
        return;
      }

      // Prefer a non-full line that matches the scanned code exactly
      const oid = orderId ? parseInt(orderId) : 0;
      const nonFullLines = oid ? orderLines.filter(l => getLineStatus(oid, l.id) !== 'full') : orderLines;
      const findCode = (l: OrderLine) => (getOrderLineCode(l.name) || '').toUpperCase();
      const exactLine = nonFullLines.find(l => findCode(l) === scannedCode) || null;
      if (exactLine) {
        setPendingTargetLineId(exactLine.id);
        setPendingScanCode(scannedCode);
        setQtyValue(getDefaultQuantityFromCode(scannedCode));
        setAbsoluteEdit(false);
        setQtyPromptOpen(true);
        return;
      }

      // Then try fuzzy (first 4 + last) among non-full lines
      const fuzzyLine = nonFullLines.find(l => first4AndLastEqual(scannedCode, findCode(l))) || null;
      if (fuzzyLine) {
        setPendingTargetLineId(fuzzyLine.id);
        setPendingScanCode(scannedCode);
        setQtyValue(getDefaultQuantityFromCode(scannedCode));
        setAbsoluteEdit(false);
        setQtyPromptOpen(true);
        return;
      }

      // Otherwise fall back to comparing against the next pending line
      if (scannedCode === expectedCode || first4AndLastEqual(scannedCode, expectedCode)) {
        setPendingTargetLineId(nextPendingLine.id);
        setPendingScanCode(scannedCode);
        setQtyValue(getDefaultQuantityFromCode(scannedCode));
        setAbsoluteEdit(false);
        setQtyPromptOpen(true);
        return;
      }

      // Ambiguous: user chooses target
      setPendingScanCode(scannedCode);
      setChooserOpen(true);
    } catch (err) {
      console.error('Fehler bei Verarbeitung des Scans:', err);
      setError('Fehler bei der Verarbeitung des Scans.');
    } finally {
      setProcessing(false);
    }
  };

  const handleChooseLine = async (lineId: number | null) => {
    setChooserOpen(false);
    if (lineId === null) {
      return;
    }
    const line = orderLines.find(l => l.id === lineId);
    if (!line) {
      setError('Ausgewählte Position nicht gefunden.');
      return;
    }
    // Öffne Mengenabfrage mit Default
    setPendingTargetLineId(line.id);
    const fallbackCode = getOrderLineCode(line.name) || '';
    const codeForDefault = (pendingScanCode && pendingScanCode.length > 0) ? pendingScanCode : fallbackCode;
    setPendingScanCode(codeForDefault);
    setQtyValue(getDefaultQuantityFromCode(codeForDefault));
    setAbsoluteEdit(false);
    setQtyPromptOpen(true);
  };

  const handleConfirmQuantity = async () => {
    if (pendingTargetLineId == null) {
      setQtyPromptOpen(false);
      return;
    }
    const line = orderLines.find(l => l.id === pendingTargetLineId);
    if (!line) {
      setError('Ausgewählte Position nicht gefunden.');
      setQtyPromptOpen(false);
      return;
    }
    let canceledByWarning = false;
    try {
      setProcessing(true);
      // Warn if this confirmation would exceed target quantity
      if (orderId) {
        const oid = parseInt(orderId);
        const current = getDeliveredQty(oid, line.id) || 0;
        const target = (getOrderSession(oid).targetQty?.[line.id] ?? line.product_uom_qty) || 0;
        const nextTotal = absoluteEdit ? qtyValue : (current + qtyValue);
        if (target > 0 && nextTotal > target) {
          const proceed = window.confirm(`Warnung: Liefermenge (${nextTotal}) überschreitet Ziel (${target}). Fortfahren?`);
          if (!proceed) {
            canceledByWarning = true;
            return; // skip commit, fall to finally
          }
        }
      }
      const codeFromName = (getOrderLineCode(line.name) || '').toUpperCase();
      const effectiveCode = (pendingScanCode || codeFromName).toUpperCase();
      const needsUpdate = !!effectiveCode && effectiveCode !== codeFromName;
      if (!absoluteEdit) {
        // Optimistic UI + Cache update for product code change
        if (needsUpdate) {
          setProductChanges((m) => ({ ...m, [line.id]: { oldCode: codeFromName, newCode: effectiveCode } }));
          setOrderLines((prev) => prev.map((l) => {
            if (l.id !== line.id) return l;
            const name = l.name;
            if (/\[.*?\]/.test(name)) {
              const newName = name.replace(/\[(.*?)\]/, `[${effectiveCode}]`);
              const displayStr = Array.isArray(l.product_id) && typeof l.product_id[1] === 'string'
                ? l.product_id[1].replace(/\[(.*?)\]/, `[${effectiveCode}]`)
                : l.product_id?.[1] || newName;
              return { ...l, name: newName, product_id: [l.product_id?.[0] ?? 0, displayStr] as [number, string] } as OrderLine;
            }
            const newName = `[${effectiveCode}] ${name}`;
            const displayStr = Array.isArray(l.product_id) && typeof l.product_id[1] === 'string'
              ? `[${effectiveCode}] ${l.product_id[1]}`
              : newName;
            return { ...l, name: newName, product_id: [l.product_id?.[0] ?? 0, displayStr] as [number, string] } as OrderLine;
          }));
          if (orderId) {
            const oid = parseInt(orderId);
            orderRepo.updateLineCode(oid, line.id, effectiveCode);
            // enqueue pending product update for ERP sync
            orderRepo.queueProductUpdate(oid, line.id, codeFromName, effectiveCode);
          }
        }
        // Try ERP update and clear pending if success
        if (client && isAuthenticated && needsUpdate) {
          try {
            await client.updateOrderLineProduct(parseInt(orderId!), line.id, effectiveCode);
            if (orderId) {
              const oid = parseInt(orderId);
              const pend = orderRepo.getPendingProductUpdates(oid).find(p => p.lineId === line.id && p.newCode === effectiveCode);
              if (pend) orderRepo.clearProductUpdate(oid, pend.id);
            }
          } catch (e: any) {
            const msg = (e?.message || String(e)).toLowerCase();
            if (msg.includes('not found')) {
              // keep pending; will require manual resolution
              console.warn('Produktcode nicht gefunden (ERP), Offline-Änderung verbleibt als Pending.');
            } else {
              console.warn('ERP-Update fehlgeschlagen, Offline-Änderung verbleibt als Pending:', e);
            }
          }
        }
        // Delivery stub call (no-op to ERP if offline)
        await deliverOrderLine(parseInt(orderId!), line, qtyValue);
      }
      // Update via repository
      if (orderId) {
        const oid = parseInt(orderId);
        if (absoluteEdit) {
          orderRepo.setDeliveredAbsolute(oid, line.id, qtyValue);
        } else {
          orderRepo.deliverLine(oid, line.id, qtyValue);
        }
      }
      setShowCamera(false);
    } catch (e) {
      console.error(e);
      setError('Fehler beim Übertragen.');
    } finally {
      setProcessing(false);
      if (!canceledByWarning) {
        setPendingScanCode(null);
        setPendingTargetLineId(null);
        setAbsoluteEdit(false);
        setQtyPromptOpen(false);
      } else {
        // keep qty dialog open, preserve pending state
        setQtyPromptOpen(true);
      }
    }
  };

  return (
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <SyncLogo className="header-logo" />
          <h2>Order Details</h2>
        </div>

        {/* Sync Status removed - sync happens automatically in background */}

        {/* Conflict Resolution UI */}
        {hasOrderConflicts && (
          <div style={{
            margin: '10px 0',
            padding: '12px',
            backgroundColor: 'rgba(255, 107, 107, 0.1)',
            border: '2px solid #ff6b6b',
            borderRadius: '8px',
            color: 'white'
          }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
              ⚠️ Synchronisationskonflikte ({orderConflicts.length})
            </h4>
            {orderConflicts.map(conflict => (
              <div key={conflict.id} style={{
                marginBottom: '8px',
                fontSize: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{conflict.type === 'line_modified' ? 'Zeile geändert' : 'Bestellung geändert'}</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => resolveConflict(conflict.id, 'local')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Lokal
                  </button>
                  <button
                    onClick={() => resolveConflict(conflict.id, 'server')}
                    style={{
                      padding: '4px 8px',
                      fontSize: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Server
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="action-buttons">
          {/* Camera toggle */}
          {!showCamera ? (
            <button 
              onClick={() => {
                setShowCamera(true);
              }} 
              className={`icon-button ${processing ? 'disabled' : 'default'}`}
              disabled={processing}
              title="Starte QR-Code Scanner"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setShowCamera(true);
                }
              }}
              tabIndex={0}
            >
              <img src={CameraIcon} alt="Camera" />
            </button>
          ) : (
            <button 
              onClick={() => {
                setQtyPromptOpen(false);
                setChooserOpen(false);
                setShowCamera(false);
              }} 
              className={`icon-button`}
              title="Zurück zu Items"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setQtyPromptOpen(false);
                  setChooserOpen(false);
                  setShowCamera(false);
                }
              }}
              tabIndex={0}
            >
              <img src={StopIcon} alt="Stop" />
            </button>
          )}

          {/* Sync Button removed - sync happens automatically in background */}

          {/* Back secondary */}
          <button
            onClick={() => navigate('/orders')}
            className={`icon-button`}
            title="Back to Orders"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate('/orders');
              }
            }}
            tabIndex={0}
          >
            <img src={BackIcon} alt="Back" />
          </button>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {/* removed status text from UI */}
      
      {showCamera ? (
        <div className="scanner-section" style={{ position: 'relative' }}>
          <Camera 
            onScanComplete={handleScanComplete}
          />
          {chooserOpen && (
            <div className="chooser" style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Bitte Item für Code {pendingScanCode} wählen:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {orderLines.map((line) => {
                  const code = getOrderLineCode(line.name) || '';
                  const oid = orderId ? parseInt(orderId) : 0;
                  const cachedName = oid ? orderRepo.getOrder(oid)?.snapshot.lines.find(ls => ls.id === line.id)?.name : undefined;
                  const overrideCode = productChanges[line.id]?.newCode;
                  const label = overrideCode || code || cachedName || line.product_id?.[1] || line.name;
                  const status = oid ? getLineStatus(oid, line.id) : 'open';
                  const isFull = status === 'full';
                  const delivered = oid ? (getDeliveredQty(oid, line.id) || 0) : 0;
                  const target = oid ? (getOrderSession(oid).targetQty?.[line.id] ?? line.product_uom_qty) : line.product_uom_qty;
                  return (
                    <button
                      key={line.id}
                      className={`item ${isFull ? 'disabled' : ''}`}
                      disabled={isFull}
                      onClick={() => handleChooseLine(line.id)}
                    >
                      {delivered}/{target}x {label}
                    </button>
                  );
                })}
                <button className="secondary" onClick={() => handleChooseLine(null)}>Abbrechen</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="order-lines">
          {orderLines.map((line) => {
            const productCodeMatch = line.product_id[1].match(/\[(.*?)\]/);
            const productCode = productCodeMatch ? productCodeMatch[1] : '';
            const oid = orderId ? parseInt(orderId) : 0;
            const cachedName = oid ? orderRepo.getOrder(oid)?.snapshot.lines.find(ls => ls.id === line.id)?.name : undefined;
            const overrideCode = productChanges[line.id]?.newCode;
            const productLabel = overrideCode || productCode || cachedName || line.product_id?.[1] || line.name;
            const status = oid ? getLineStatus(oid, line.id) : 'open';
            const delivered = oid ? (getDeliveredQty(oid, line.id) || 0) : 0;
            const target = oid ? (getOrderSession(oid).targetQty?.[line.id] ?? line.product_uom_qty) : line.product_uom_qty;
            // Persisted old id: read the latest pending product update for this line (survives reload until synced)
            const pendingUpdates = oid ? orderRepo.getPendingProductUpdates(oid) : [];
            const latestPending = pendingUpdates
              .filter(u => u.lineId === line.id)
              .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())[0];
            const persistedOldCode = latestPending?.oldCode;
            const persistedNewCode = latestPending?.newCode;
            // Build current label as ID only: prefer pending new code, then transient override, then extracted code from product
            const extractedFromName = (line.product_id?.[1] || line.name).match(/\[(.*?)\]/)?.[1] || '';
            const currentCode = (persistedNewCode || overrideCode || productCode || extractedFromName || '').trim();
            const currentLabel = currentCode || productLabel;
            const isFull = status === 'full';
            const isPartial = status === 'partial';
            return (
              <div
                key={line.id}
                className={`item-row`}
                title={isFull ? 'Vollständig geliefert' : isPartial ? 'Teilweise geliefert' : 'Offen'}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {/* Left: item text as non-interactive div styled like items */}
                <div
                  className={`item readonly ${isFull ? 'status-full' : isPartial ? 'status-partial' : ''}`}
                  style={{ flex: 1, textAlign: 'left' }}
                  aria-hidden
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div className="line-variant current" style={{}}>
                      {delivered}/{target}x {currentLabel}
                    </div>
                    {(productChanges[line.id]?.oldCode || persistedOldCode) && (() => {
                      const oldCode = productChanges[line.id]?.oldCode || persistedOldCode!;
                      return (
                        <div className="line-variant overridden" style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>
                          {oldCode}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {/* Right CTA: status icon only (click opens qty dialog for this line) */}
                <div
                  className={`icon-button secondary status-indicator ${status}`}
                  title={isFull ? 'Vollständig geliefert' : isPartial ? 'Teilweise geliefert' : 'Offen'}
                  role="button"
                  onClick={() => {
                    const code = (getOrderLineCode(line.name) || '').toUpperCase();
                    setPendingTargetLineId(line.id);
                    setPendingScanCode(code);
                    const oid = orderId ? parseInt(orderId) : 0;
                    const current = oid ? getDeliveredQty(oid, line.id) || 0 : 0;
                    setQtyValue(Math.max(0, current));
                    setAbsoluteEdit(true);
                    setQtyPromptOpen(true);
                  }}
                >
                  {status === 'open' && <img src={StatusOpenIcon} width={28} height={28} alt="offen" />}
                  {status === 'partial' && <img src={StatusPartialIcon} width={28} height={28} alt="teilweise" />}
                  {status === 'full' && <img src={StatusFullIcon} width={28} height={28} alt="vollständig" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {qtyPromptOpen && (
        <div className="qty-prompt" style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,30,0.98)', border: '1px solid #333', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10, zIndex: 200 }}>
          {(() => {
            const pack = getDefaultQuantityFromCode(pendingScanCode || '');
            return (
              <>
                <button
                  className="icon-button"
                  onClick={() => setQtyValue((v) => Math.max(0, v - Math.max(1, pack)))}
                  disabled={processing}
                  title={`-${Math.max(1, pack)}`}
                >
                  <img src={MinusIcon} width={24} height={24} alt="-" />
                </button>
                <input
                  type="number"
                  min={0}
                  value={qtyValue}
                  onChange={(e) => setQtyValue(Math.max(0, Number(e.target.value) || 0))}
                  style={{ width: 80 }}
                />
                <button
                  className="icon-button"
                  onClick={() => setQtyValue((v) => v + Math.max(1, pack))}
                  disabled={processing}
                  title={`+${Math.max(1, pack)}`}
                >
                  <img src={PlusIcon} width={24} height={24} alt="+" />
                </button>
                <button className="default" onClick={handleConfirmQuantity} disabled={processing} title="Bestätigen">
                  <img src={CheckIcon} width={24} height={24} alt="OK" />
                </button>
                <button className="secondary" onClick={() => setQtyPromptOpen(false)} disabled={processing} title="Abbrechen">
                  <img src={StopIcon} width={24} height={24} alt="Abbrechen" />
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;