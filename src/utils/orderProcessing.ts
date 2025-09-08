export function extractProductCodeFromName(name: string): string | null {
  if (!name) return null;
  const match = name.match(/\[(.*?)\]/);
  return match ? match[1] : null;
}

export function parseScannedCode(payload: string): string {
  if (!payload) return '';
  // If payload contains [CODE], extract it; else return trimmed payload
  const code = extractProductCodeFromName(payload);
  return (code ?? payload).trim();
}

// Product ID format: XXXX-NNNNN-X (e.g., DERO-240521-F)
const PRODUCT_ID_REGEX = /([A-Z]{4}-\d{5,}-[A-Z])$/i;

// Extract product ID from a URL or plain payload. Prefer last path segment matching pattern.
export function extractProductIdFromUrlOrPayload(payload: string): string | null {
  if (!payload) return null;
  try {
    // Try full URL parse
    const url = new URL(payload);
    const last = url.pathname.split('/').filter(Boolean).pop() ?? '';
    const m = last.match(PRODUCT_ID_REGEX);
    if (m) return m[1].toUpperCase();
  } catch {
    // Not a URL, continue
  }
  // Try tail token in plain text
  const parts = payload.trim().split(/\s|\//).filter(Boolean);
  const tail = parts[parts.length - 1] ?? payload.trim();
  const m2 = tail.match(PRODUCT_ID_REGEX);
  if (m2) return m2[1].toUpperCase();
  // Fallback to bracket code or raw
  const bracket = extractProductCodeFromName(payload);
  return bracket ? bracket.toUpperCase() : payload.trim().toUpperCase();
}

export function first4AndLastEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const A = a.toUpperCase();
  const B = b.toUpperCase();
  if (A.length < 6 || B.length < 6) return false;
  return A.slice(0, 4) === B.slice(0, 4) && A.slice(-1) === B.slice(-1);
}

export function getOrderLineCode(nameField: string): string | null {
  return extractProductCodeFromName(nameField)?.toUpperCase() ?? null;
}

export function getDefaultQuantityFromCode(code: string): number {
  if (!code) return 1;
  const last = code.trim().toUpperCase().slice(-1);
  if (last === 'F') return 6;
  if (last === 'M') return 3;
  if (last === 'D') return 12;
  return 1;
}
