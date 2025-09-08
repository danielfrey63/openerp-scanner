import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOpenERP } from '@/context/OpenERPContext.js';
import { OrderLine as ClientOrderLine } from '@danielfrey63/openerp-ts-client';
import BackIcon from '@/icons/back-icon.svg';
import Logo from '@/icons/logo.svg';
import CameraIcon from '@/icons/camera-icon.svg';
import Camera from '@/components/Camera.js';
import { extractProductIdFromUrlOrPayload, first4AndLastEqual, getOrderLineCode, getDefaultQuantityFromCode } from '@/utils/orderProcessing.js';
import PlusIcon from '@/icons/plus.svg';
import MinusIcon from '@/icons/minus.svg';
import CheckIcon from '@/icons/check.svg';
import StopIcon from '@/icons/stop.svg';

interface OrderLine extends ClientOrderLine {
  id: number;
  product_id: [number, string];
  product_uom_qty: number;
}

const OrderDetails: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [deliveredLineIds, setDeliveredLineIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState<boolean>(false);
  const [chooserOpen, setChooserOpen] = useState<boolean>(false);
  const [pendingScanCode, setPendingScanCode] = useState<string | null>(null);
  const [qtyPromptOpen, setQtyPromptOpen] = useState<boolean>(false);
  const [qtyValue, setQtyValue] = useState<number>(1);
  const [pendingTargetLineId, setPendingTargetLineId] = useState<number | null>(null);
  const { client, isAuthenticated } = useOpenERP();

  useEffect(() => {
    const fetchOrderLines = async () => {
      try {
        if (!client || !isAuthenticated) {
          throw new Error('Not authenticated');
        }

        if (!orderId) {
          throw new Error('Order ID is required');
        }

        const lines = await client.getSaleOrderLines(parseInt(orderId));
        // Convert the returned lines to match our OrderLine interface
        const typedLines = lines.map(line => ({
          ...line,
          id: (line as any).id || Math.random() // Use existing id or generate a random one
        })) as OrderLine[];
        setOrderLines(typedLines);
      } catch (err) {
        setError('Failed to fetch order lines: ' + (err instanceof Error ? err.message : String(err)));
        
        // If not authenticated, redirect to login
        if (err instanceof Error && err.message === 'Not authenticated') {
          navigate('/');
        }
      }
    };

    if (orderId) {
      fetchOrderLines();
    }
  }, [client, isAuthenticated, orderId, navigate]);

  // Compute next pending line (simple: not delivered yet)
  const nextPendingLine = useMemo(() => {
    return orderLines.find(l => !deliveredLineIds.has(l.id)) || null;
  }, [orderLines, deliveredLineIds]);

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

      // 1) Vollständiger Match: Öffne Mengenabfrage mit Default
      if (scannedCode === expectedCode) {
        setPendingTargetLineId(nextPendingLine.id);
        setPendingScanCode(scannedCode);
        setQtyValue(getDefaultQuantityFromCode(scannedCode));
        setQtyPromptOpen(true);
        return;
      }

      // 2) Gleiche ersten 4 und letzter Buchstabe: Öffne Mengenabfrage und plane Positionsanpassung
      if (first4AndLastEqual(scannedCode, expectedCode)) {
        setPendingTargetLineId(nextPendingLine.id);
        setPendingScanCode(scannedCode);
        setQtyValue(getDefaultQuantityFromCode(scannedCode));
        setQtyPromptOpen(true);
        return;
      }

      // 3) Ambig: Benutzer soll Zielposition wählen (oder abbrechen)
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
    if (!pendingScanCode) return;
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
    setQtyValue(getDefaultQuantityFromCode(pendingScanCode));
    setQtyPromptOpen(true);
  };

  const handleConfirmQuantity = async () => {
    if (!pendingScanCode || pendingTargetLineId == null) {
      setQtyPromptOpen(false);
      return;
    }
    const line = orderLines.find(l => l.id === pendingTargetLineId);
    if (!line) {
      setError('Ausgewählte Position nicht gefunden.');
      setQtyPromptOpen(false);
      return;
    }
    try {
      setProcessing(true);
      const needsUpdate = pendingScanCode !== (getOrderLineCode(line.name) || '').toUpperCase();
      if (client && isAuthenticated) {
        if (needsUpdate) {
          await client.updateOrderLineProduct(parseInt(orderId!), line.id, pendingScanCode);
        }
        await deliverOrderLine(parseInt(orderId!), line, qtyValue);
      }
      setDeliveredLineIds(prev => new Set(prev).add(line.id));
      setShowCamera(false);
    } catch (e) {
      console.error(e);
      setError('Fehler beim Übertragen.');
    } finally {
      setProcessing(false);
      setPendingScanCode(null);
      setPendingTargetLineId(null);
      setQtyPromptOpen(false);
    }
  };

  return (
    <div className="list">
      <div className="header-container">
        <div className="title-with-logo">
          <img src={Logo} alt="Logo" className="header-logo" />
          <h2>Order Details</h2>
        </div>
        <div className="action-buttons">
          {/* Camera first (default) */}
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
          {qtyPromptOpen && (
            <div className="qty-prompt" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: 'rgba(30,30,30,0.95)', border: '1px solid #333', borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
              {(() => {
                const pack = getDefaultQuantityFromCode(pendingScanCode || '');
                return (
                  <>
                    <button
                      className="icon-button"
                      onClick={() => setQtyValue((v) => Math.max(1, v - Math.max(1, pack)))}
                      disabled={processing}
                      title={`-${Math.max(1, pack)}`}
                    >
                      <img src={MinusIcon} width={24} height={24} alt="-" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={qtyValue}
                      onChange={(e) => setQtyValue(Math.max(1, Number(e.target.value) || 1))}
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
          {chooserOpen && (
            <div className="chooser" style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>Bitte Item für Code {pendingScanCode} wählen:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {orderLines.map((line) => {
                  const code = getOrderLineCode(line.name) || '';
                  const delivered = deliveredLineIds.has(line.id);
                  return (
                    <button
                      key={line.id}
                      className={`item ${delivered ? 'disabled' : ''}`}
                      disabled={delivered}
                      onClick={() => handleChooseLine(line.id)}
                    >
                      {line.product_uom_qty}x {code}
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
            const delivered = deliveredLineIds.has(line.id);
            return (
              <div
                key={line.id}
                className={`item ${delivered ? 'selected' : ''}`}
                title={delivered ? 'Geliefert (aktuelle Sitzung)' : 'Offen'}
              >
                {line.product_uom_qty}x {productCode}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OrderDetails;