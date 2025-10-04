# OpenERP QR Order Scanner (openerp-scanner)

This app scans QR codes to update Sale Orders in OpenERP/Odoo. It provides a streamlined camera UI, a quantity dialog with pack-based spinners, session-based delivery tracking, and a debug view.

## Quick Start

- Requirements: Node 18+
- Install
  ```bash
  npm install
  ```
- Run (HTTPS + HMR)
  ```bash
  npm run dev
  ```

## PWA Installation (Progressive Web App)

Der OpenERP Scanner kann als native App auf Ihrem Gerät installiert werden - ohne App Store!

### **Schnellinstallation (Empfohlen)**
1. App öffnen: `https://openerp-scanner.vercel.app`
2. Installationsaufforderung abwarten (erscheint automatisch nach 3-8 Sekunden)
3. "Installieren" klicken (blaue Schaltfläche im Popup)
4. Fertig! Die App erscheint auf Ihrem Startbildschirm

**🆕 Automatische Installationsaufforderung**: Die App zeigt ein modernes Popup mit Installationsbutton an. Erscheint automatisch auf allen unterstützten Browsern.

### **Manuelle Installation**
- **Chrome**: ⚡ Icon in Adressleiste → "App installieren"
- **Safari (iOS)**: 📤 Teilen-Button → "Zum Startbildschirm hinzufügen"
- **Firefox**: ≡ Menü → "Diese App installieren"
- **Edge**: ⚡ Icon in Adressleiste → "Diese App installieren"

### **Vorteile der PWA-Installation**
- 🚀 **Schneller Start**: Kein Browser-Ladevorgang
- 📱 **Vollbildmodus**: Wie eine native App
- 🌐 **Offline-Funktion**: Funktioniert auch ohne Internet
- 🔔 **Push-Benachrichtigungen**: Automatische Updates
- 📂 **Kein App Store**: Direkte Installation

📖 **Detaillierte Anleitung**: Siehe [`PWA_INSTALLATION.md`](./PWA_INSTALLATION.md)

## Authentication

- Login via the start screen with your OpenERP endpoint and credentials.
- A successful login initializes the `OpenERPClient` and unlocks the routes under `/orders`.

## Navigation

- Open Sale Orders: `/orders`
- Order Details: `/orders/:orderId`
- Session Debug (JSON): `/debug/session`

## Camera UI (Order Details)

- Open the scanner with the camera button in the header (tooltip: "Starte QR-Code Scanner").
- While scanning, the camera dropdown remains active. Selecting another device restarts the stream with the new camera automatically.
- Single Start/Stop CTA mirrors the visual style of `qr-scanner-client`.
- Icons are imported SVGs (not inline): `src/icons/start.svg`, `src/icons/stop.svg`.

## Scan Matching Logic

After decoding the QR payload, we derive the product code and match against the next open line:

- Exact match: open the quantity dialog immediately.
- Fuzzy match (first 4 characters equal AND same last character): open quantity dialog and adjust the product on confirm.
- Ambiguous: open an item chooser to select the target line, then show quantity dialog.

Utilities live in `src/utils/orderProcessing.ts`.

## Quantity Dialog

- Appears as an overlay on top of the camera video.
- Contains a number input and two spinner buttons.
- Spinner step is the pack size derived from the scanned code suffix indicating the default box sizes:
  - `F` (0.75l) → 6
  - `M` (1.5l)→ 3
  - `D` (0.375l) → 12
  - otherwise → 1
- Confirm with the check icon, cancel with the square/X icon.

## Delivery Flow

1. Scan → match → quantity dialog.
2. On confirm:
   - If fuzzy matched, update the order line’s product ID.
   - Call the delivery stub: `deliverOrderLine(orderId, line, quantity)`.
   - Persist delivered quantity in session (see next section).

ERP call is currently a stub; see "ERP Integration" below.

## Offline-First Architecture

Die Anwendung wurde vollständig auf eine Offline-First-Architektur umgestellt. Das UI wird ausschliesslich aus dem lokalen Cache betrieben, ohne direkte Abhängigkeit vom ERP-System.

### **Kernprinzipien**

- **Cache-First-Datenzugriff**: Alle UI-Daten kommen aus dem lokalen Cache
- **Erzwungener initialer Cache**: Nach Login wird der Cache automatisch aufgebaut
- **Optimistische Updates**: Änderungen sind sofort im UI sichtbar
- **Delta-Synchronisation**: Nur geänderte Daten werden synchronisiert
- **Background-Sync**: Automatische Synchronisation bei Netzwerk-Wiederherstellung

### **Offline-First Synchronization Workflow**

The app implements a sophisticated offline-first synchronization strategy with delta tracking and optimistic updates.

### Core Synchronization Logic

#### 1. Initial Down-Sync (Login Phase with Live Updates)

- **Trigger**: Successful login to OpenERP
- **Process**: `syncService.initialDownSync()` runs in background
  - User is immediately redirected to order list
  - Orders appear with basic info and `syncStatus: 'syncing'` (blue pulsing border)
  - Each order is individually loaded with lines from ERP
  - Border changes from blue (syncing) to green (synced) as each order completes
  - Stores everything in local cache (`localStorage`)
- **Result**: Live visual feedback, complete local cache, ready for offline operation

#### 2. Delivery Status Changes (Optimistic Updates)

- **Trigger**: User changes delivery quantities
- **Process**:
  1. **Immediate local update**: `orderRepo.deliverLine()` or `setDeliveredAbsolute()`
  2. **Delta tracking**: Change stored in `pending.deliveryUpdates[]`
  3. **Automatic up-sync attempt**: `syncService.syncDeliveryChange()`
     - **Online**: Up-sync → Down-sync → Delta removed → Status: `'synced'`
     - **Offline**: Up-sync fails → Delta remains → Status: `'pending'`
- **Result**: UI always responsive, changes tracked for later sync

#### 3. Manual Synchronization (Logo Click)

- **Trigger**: User clicks logo when offline changes exist
- **Process**: `syncService.syncAllPendingChanges()`
  - Syncs all pending delivery updates
  - Syncs all pending product code updates
  - Downloads fresh data from ERP after successful up-sync
  - Marks orders as `'synced'`
- **Result**: All local changes synchronized with ERP

### Data Structures

#### OrderRecord Structure

```typescript
interface OrderRecord {
  meta: {
    syncStatus: 'synced' | 'pending' | 'local-only';
    lastSyncedAt: string | null;
    // ... other metadata
  };
  snapshot: {
    order: OrderSnapshot;
    lines: OrderLineSnapshot[];
  };
  pending?: {
    deliveryUpdates?: Array<{
      id: string;
      lineId: number;
      oldQty: number;
      newQty: number;
      synced: boolean;
    }>;
    productUpdates?: Array<{
      id: string;
      lineId: number;
      oldCode: string;
      newCode: string;
      synced: boolean;
    }>;
  };
}
```

#### Sync Status States

- **`'synced'`**: Order is fully synchronized with ERP (green border)
- **`'pending'`**: Order has local changes waiting for sync (orange border)
- **`'syncing'`**: Order is currently being synchronized (blue pulsing border)
- **`'local-only'`**: Order exists only locally (no special border, rare edge case)

### Session-Based Delivery Tracking

We persist per-line progress in `sessionStorage` to color the UI and for later sync.

- Module: `src/utils/sessionStore.ts`
- Stored per order: `{ deliveredQty: { [lineId]: number }, targetQty: { [lineId]: number } }`
- On loading order lines, `targetQty` is initialized from `product_uom_qty`.
- On confirm delivery, `deliveredQty[lineId]` is incremented.

### Line Statuses

- `open`: no delivered quantity.
- `partial`: delivered between 1 and target-1.
- `full`: delivered ≥ target.

### Visual Indicators

#### Sales Order Status Signalik

Die Anwendung verwendet ein mehrschichtiges visuelles System, um den Status von Sales Orders anzuzeigen:

##### **Order List (Open Sale Orders) - Rahmenfarben**

- **🟢 Grüner Rahmen** (`sync-synced`): Order ist vollständig mit ERP synchronisiert

  - Farbe: `rgba(80, 221, 139, 0.25)` mit grünem Rahmen
  - Bedeutung: Alle lokalen Änderungen sind erfolgreich hochgeladen
- **🟠 Oranger Rahmen** (`sync-pending`): Order hat ausstehende lokale Änderungen

  - Farbe: `#ffa502` mit orangem Rahmen
  - Bedeutung: Lokale Änderungen warten auf Synchronisation
- **🔵 Blauer pulsierender Rahmen** (`sync-syncing`): Order wird aktuell synchronisiert

  - Farbe: `#74b9ff` mit Puls-Animation
  - Animation: `pulse-border` Keyframe (2s Zyklus)
  - Bedeutung: Synchronisation läuft im Hintergrund
- **⚪ Standard-Rahmen**: Order-Status unbekannt oder nur lokal vorhanden

  - Farbe: `#333` (Standard-Rahmenfarbe)
  - Bedeutung: Kein spezieller Sync-Status

##### **Order Details (Line Details) - Hintergrundfarben**

- **🟢 Grüner Hintergrund** (`status-full`): Linie vollständig geliefert

  - Farbe: `rgba(46, 160, 67, 0.25)` Hintergrund
  - Textfarbe: `#2ea043` (grün)
  - Bedeutung: Gelieferte Menge ≥ Zielmenge
- **🟠 Oranger Hintergrund** (`status-partial`): Linie teilweise geliefert

  - Farbe: `rgba(255, 165, 0, 0.2)` Hintergrund
  - Textfarbe: `#ffa500` (orange)
  - Bedeutung: Gelieferte Menge zwischen 1 und Zielmenge-1
- **⚪ Standard-Hintergrund**: Linie noch nicht geliefert

  - Farbe: `#1e1e1e` (Standard-Hintergrund)
  - Textfarbe: `#e0e0e0` (Standard-Text)
  - Bedeutung: Noch keine Lieferung erfasst

##### **Cache Status Indikatoren**

- **🔄 Cache-Drop-Down Button**: Zeigt Cache-Status mit Badge

  - **Oranger Badge**: Anzahl ausstehender Änderungen (99+ bei >99)
  - **Tooltip**: "Cache Status"
  - **Funktion**: Drop-Down mit detaillierten Cache-Informationen
- **📱 Offline-Status Badge** (oben rechts):

  - **Orange**: "Offline-Modus" mit Anzahl ausstehender Änderungen
  - **Funktion**: "Online versuchen" Button

##### **Status-Icons (Order Details)**

Drei Status-Icons zeigen den aktuellen Lieferstatus:

- **Offen** (`status-open.svg`): Graues Icon für nicht gelieferte Linien
- **Teilweise** (`status-partial.svg`): Oranges Icon für teilweise gelieferte Linien
- **Vollständig** (`check.svg`): Grünes Icon für vollständig gelieferte Linien

#### 🎨 Farbcodierung Übersicht

| Status                     | Rahmenfarbe          | Hintergrundfarbe | Textfarbe   | Bedeutung                   |
| -------------------------- | -------------------- | ---------------- | ----------- | --------------------------- |
| **Synced**           | 🟢 Grün             | -                | -           | Vollständig synchronisiert |
| **Pending**          | 🟠 Orange            | -                | -           | Ausstehende Änderungen     |
| **Syncing**          | 🔵 Blau (pulsierend) | -                | -           | Synchronisation läuft      |
| **Full Delivery**    | -                    | 🟢 Grün         | 🟢 Grün    | Vollständig geliefert      |
| **Partial Delivery** | -                    | 🟠 Orange        | 🟠 Orange   | Teilweise geliefert         |
| **No Delivery**      | ⚪ Standard          | ⚪ Standard      | ⚪ Standard | Noch nicht geliefert        |

## Debugging Session Data

- Visit `/debug/session` to see all session state in JSON.
- Useful when verifying delivery steps before ERP integration.

## Open Sale Orders (List)

- Route: `/orders`
- **Sortierung**: Orders in absteigender Reihenfolge (neueste zuerst)
- **Live Sync Visual Indicators**:
  - **🔵 Blauer pulsierender Rahmen**: Order wird aktuell synchronisiert (`syncStatus: 'syncing'`)
  - **🟢 Grüner Rahmen**: Order vollständig mit ERP synchronisiert (`syncStatus: 'synced'`)
  - **🟠 Oranger Rahmen**: Order hat ausstehende lokale Änderungen (`syncStatus: 'pending'`)
  - **⚪ Standard-Rahmen**: Order-Status unbekannt oder nur lokal vorhanden
- **Session-basierte Linien-Färbung**:
  - **🟢 Grüner Hintergrund**: Vollständig gelieferte Linien
  - **🟠 Oranger Hintergrund**: Teilweise gelieferte Linien
  - **⚪ Standard-Hintergrund**: Noch nicht gelieferte Linien
- **Actions**:
  - **Back to Login**: Zurück zum Login-Bildschirm
  - **Cache Status Drop-Down**: Detaillierte Cache-Informationen und Aktionen
    - **Refresh Icon**: Cache aktualisieren
    - **Delete Icon**: Cache löschen
    - **Badge**: Zeigt Anzahl ausstehender Änderungen
  - **Logo Click**: Manuelle Synchronisation aller ausstehenden Änderungen

### Cache Management Features

#### **Cache Status Drop-Down**

- **Anzeige**: Gespeicherte Orders, synchronisierte Orders, ausstehende Änderungen
- **Cache-Größe**: Aktuelle Speichernutzung in MB
- **Letzte Synchronisation**: Zeit seit letztem erfolgreichen Sync
- **Aktionen**:
  - **Cache aktualisieren**: Sync aller ausstehenden Änderungen
  - **Cache löschen**: Komplettes Löschen des lokalen Cache

#### **Offline-Indikatoren**

- **Offline-Status Badge**: Oben rechts bei Offline-Modus
- **Anzahl ausstehender Änderungen**: Oranger Badge mit Zähler
- **Online versuchen**: Button zum erzwungenen Online-Modus

## ERP Integration (Implemented)

The app now features full ERP integration with sophisticated offline-first synchronization:

### Implemented Features

- **Complete order synchronization** via OpenERP TS client
- **Delivery quantity updates** with immediate ERP sync attempts
- **Product code modifications** with delta tracking
- **Conflict resolution** and error handling
- **Offline capability** with manual sync recovery

### Sync Service Methods

- `syncService.initialDownSync()`: Complete order cache population after login
- `syncService.syncDeliveryChange()`: Immediate sync attempt for delivery changes
- `syncService.syncAllPendingChanges()`: Manual sync of all pending deltas
- `orderRepo.deliverLine()`: Optimistic local updates with automatic sync triggers

### Data Persistence

- **localStorage**: Persistent order cache with delta tracking
- **sessionStorage**: Temporary delivery progress for UI coloring
- **Automatic cleanup**: Synced deltas are removed after successful ERP sync

## Icon Strategy

- All icons are imported SVG files (no inline SVGs) to keep visual parity and simplify styling.
- **Camera CTA**: `start.svg` (run triangle) and `stop.svg` (square outline).
- **Quantity Dialog**: `plus.svg`, `minus.svg`, `check.svg`, `stop.svg`.
- **Status CTA**: `status-open.svg`, `status-partial.svg`, `check.svg` (full).
- **Cache Management**:
  - `refresh-icon.svg` - Cache aktualisieren und Status-Button
  - `delete-cache.svg` - Cache löschen (neu erstellt)
- **Navigation**: `back-icon.svg`, `camera-icon.svg`, `home-icon.svg`, `login-icon.svg`.
- **UI Elements**: `dropdown-icon.svg`, `upload-icon.svg`, `logo.svg`.

### **Icon-Formate und Styling**

- **Grösse**: 24x24px für Standard-Icons, 32x32px für Header-Icons
- **Style**: Stroke-based mit konsistenter Linienbreite (2px)
- **Farben**: Schwarz (Standard), weiss für dunkle Hintergründe via CSS-Filter
- **Integration**: Alle Icons verwenden die gleichen CSS-Klassen wie Action-Buttons

## Styling Notes

- Camera select and CTAs are 44×44 with 24px icons.
- Select has a light style with a chevron; CTAs use light (default) and dark (secondary).
- Quantity overlay is positioned above the video.

## 🆕 Recent Updates & Features

### **Version 1.0.0 - Offline-First Transformation**

#### **🔄 Cache Management System**

- **Cache Status Drop-Down**: Integriertes Cache-Management mit SVG-Icons
- **Real-time Status**: Live-Anzeige von Cache-Grösse und Synchronisationsstatus
- **Badge-Indikatoren**: Visuelle Hinweise auf ausstehende Änderungen
- **Optimiertes Layout**: Icons neben Titeln für platzsparendendes Design

#### **🎯 Enhanced Visual Indicators**

- **Mehrschichtige Signalik**: Rahmenfarben für Sync-Status, Hintergrundfarben für Lieferstatus
- **Pulsierende Animationen**: Live-Feedback bei laufenden Synchronisationen
- **Konsistente Farbcodierung**: Grüner/oranger/blauer/weisser Status-Indikatoren
- **Responsive Design**: Optimiert für mobile und Desktop-Ansicht

#### **📱 Improved User Experience**

- **Absteigende Sortierung**: Neueste Orders zuerst in der Liste
- **Intuitive Icons**: SVG-basierte Action-Buttons mit Tooltips
- **Offline-Indikatoren**: Klare Anzeige des Offline-Modus
- **Auto-Close Drop-Downs**: Klick aushalb schliesst Menüs automatisch

#### **🔧 Technical Improvements**

- **Delta-Synchronisation**: Nur geänderte Daten werden übertragen
- **Optimistische Updates**: UI reagiert sofort auf Benutzeraktionen
- **Background-Sync**: Automatische Synchronisation bei Netzwerk-Wiederherstellung
- **Error Handling**: Robuste Fehlerbehandlung mit Benutzerfeedback

## Development Tips

- If camera labels are missing initially, switching devices once often updates labels.
- For mobile testing, the dev server is accessible on the LAN (see terminal output for URLs).
- If styles don't apply after changes, do a hard refresh (Shift + Reload).
- **Cache Debugging**: Use `/debug/session` to view detailed cache and sync status.
- **Offline Testing**: Use browser dev tools to simulate offline conditions.

## Known Limitations

- Delivery API not wired yet; session tracking is local-only until ERP integration is confirmed.
- Session data is per-browser session (clears when the tab/session ends).
- **Cache Size**: Large order volumes may impact localStorage capacity (monitor cache size in dropdown).
