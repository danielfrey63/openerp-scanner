// Konfiguration für Offline-First-Architektur
export const OFFLINE_CONFIG = {
  // Cache-Aufbau
  INITIAL_CACHE_TIMEOUT: 5 * 60 * 1000, // 5 Minuten
  CACHE_VALIDITY_DURATION: 24 * 60 * 60 * 1000, // 24 Stunden
  
  // Synchronisation
  SYNC_RETRY_INTERVAL: 30 * 1000, // 30 Sekunden
  MAX_SYNC_RETRIES: 3,
  SYNC_BATCH_SIZE: 5,
  
  // Cache-Management
  MAX_CACHE_SIZE: 50 * 1024 * 1024, // 50MB
  CACHE_CLEANUP_THRESHOLD: 0.8, // 80%
  
  // UI
  OFFLINE_INDICATOR_DELAY: 2000, // 2 Sekunden
  SYNC_STATUS_UPDATE_INTERVAL: 5000, // 5 Sekunden
  
  // Netzwerk
  NETWORK_TIMEOUT: 10 * 1000, // 10 Sekunden
  CONNECTION_QUALITY_CHECK_INTERVAL: 30 * 1000, // 30 Sekunden
  
  // Fehlerbehandlung
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_BACKOFF_MULTIPLIER: 2,
  INITIAL_RETRY_DELAY: 1000, // 1 Sekunde
  
  // Cache-Strategien
  CACHE_STRATEGIES: {
    STATIC_ASSETS: 'cache-first',
    API_CALLS: 'network-first',
    ORDER_DATA: 'stale-while-revalidate'
  },
  
  // Prioritäten
  SYNC_PRIORITIES: {
    CRITICAL: 'delivery-updates',
    HIGH: 'recently-used',
    NORMAL: 'all-other'
  }
};

export default OFFLINE_CONFIG;