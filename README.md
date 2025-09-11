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
  Default dev URL: https://localhost:5174/

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
- Spinner step is the pack size derived from the scanned code suffix:
  - `F` → 6
  - `M` → 3
  - `D` → 12
  - otherwise → 1
- Confirm with the check icon, cancel with the square/X icon.
- Icons are imported SVGs: `plus.svg`, `minus.svg`, `check.svg`, `stop.svg`.

## Delivery Flow

1. Scan → match → quantity dialog.
2. On confirm:
   - If fuzzy matched, update the order line’s product ID.
   - Call the delivery stub: `deliverOrderLine(orderId, line, quantity)`.
   - Persist delivered quantity in session (see next section).

ERP call is currently a stub; see "ERP Integration" below.

## Session-Based Delivery Tracking

We persist per-line progress in `sessionStorage` to color the UI and for later sync.

- Module: `src/utils/sessionStore.ts`
- Stored per order: `{ deliveredQty: { [lineId]: number }, targetQty: { [lineId]: number } }`
- On loading order lines, `targetQty` is initialized from `product_uom_qty`.
- On confirm delivery, `deliveredQty[lineId]` is incremented.

### Line Statuses

- `open`: no delivered quantity.
- `partial`: delivered between 1 and target-1.
- `full`: delivered ≥ target.

### Visuals (Order Details)

- Open: unchanged styling.
- Partial: orange background (`.item.status-partial`).
- Full: green background (`.item.status-full`).
- Read-only status CTA on the right shows three icons (open, partial, full). The current status is highlighted.

## Debugging Session Data

- Visit `/debug/session` to see all session state in JSON.
- Useful when verifying delivery steps before ERP integration.

## Open Sale Orders (List)

- Route: `/orders`
- Actions:
  - Back to Login
  - Refresh (reloads orders from ERP)
- Roadmap (to be implemented):
  - Refresh should also push local session changes back to ERP, then reload.
  - Orders colored by session-based status:
    - Full: green
    - Partial: orange
    - Open: default

## ERP Integration (Pending)

Delivery is currently a stub. Please provide:

- Model and RPC endpoint/method to post delivered quantities per order line
- Required parameters (order id, line id, quantity, or stock move refs)
- Any workflow constraints (e.g., picking creation/validation)

Planned wiring once specified:

- Implement `deliverOrderLine(orderId, orderLineId, quantity)` in the OpenERP TS client.
- Replace the stub in `OrderDetails.tsx`.
- Expand Refresh in `/orders` to push session changes, then color orders accordingly.

## Icon Strategy

- All icons are imported SVG files (no inline SVGs) to keep visual parity and simplify styling.
- Camera CTA uses `start.svg` (run triangle) and `stop.svg` (square outline).
- Quantity dialog uses `plus.svg`, `minus.svg`, `check.svg`, `stop.svg`.
- Status CTA uses `status-open.svg`, `status-partial.svg`, `check.svg` (full).

## Styling Notes

- Camera select and CTAs are 44×44 with 24px icons.
- Select has a light style with a chevron; CTAs use light (default) and dark (secondary).
- Quantity overlay is positioned above the video.

## Development Tips

- If camera labels are missing initially, switching devices once often updates labels.
- For mobile testing, the dev server is accessible on the LAN (see terminal output for URLs).
- If styles don’t apply after changes, do a hard refresh (Shift + Reload).

## Known Limitations

- Delivery API not wired yet; session tracking is local-only until ERP integration is confirmed.
- Session data is per-browser session (clears when the tab/session ends).
