// Network Service for Offline Detection and Connection Management
// Provides robust network monitoring, retry mechanisms, and queue management

export interface NetworkStatus {
  online: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface QueuedOperation {
  id: string;
  type: 'api_call' | 'sync' | 'upload';
  url: string;
  method: string;
  data?: any;
  headers?: Record<string, string>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high';
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

class NetworkService {
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private operationQueue: QueuedOperation[] = [];
  private isProcessingQueue = false;
  private retryTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private status: NetworkStatus;
  
  private defaultRetryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    jitter: true
  };

  constructor() {
    // Initialize status
    this.status = this.getNetworkStatus();
    this.initializeNetworkMonitoring();
    this.loadQueueFromStorage();
  }

  // Initialize network monitoring
  private initializeNetworkMonitoring() {
    // Listen to online/offline events
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Listen to custom network status events from service worker
    window.addEventListener('network-status', this.handleNetworkStatusChange.bind(this) as EventListener);
    
    // Monitor connection changes if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection.addEventListener('change', this.handleConnectionChange.bind(this));
    }
    
    // Periodic connectivity check
    this.startPeriodicConnectivityCheck();
  }

  // Get current network status
  getNetworkStatus(): NetworkStatus {
    const connection = (navigator as any).connection;
    
    return {
      online: navigator.onLine,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    };
  }

  // Check if connection is good enough for operations
  isConnectionGood(): boolean {
    const status = this.getNetworkStatus();
    
    if (!status.online) return false;
    
    // Consider connection good if:
    // - RTT is reasonable (< 2000ms)
    // - Effective type is not 'slow-2g'
    return status.rtt < 2000 && status.effectiveType !== 'slow-2g';
  }

  // Add listener for network status changes
  addNetworkListener(listener: (status: NetworkStatus) => void) {
    this.listeners.add(listener);
    
    // Immediately call with current status
    listener(this.getNetworkStatus());
    
    return () => this.listeners.delete(listener);
  }

  // Queue operation for later execution
  queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = this.generateOperationId();
    const queuedOp: QueuedOperation = {
      ...operation,
      id,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.operationQueue.push(queuedOp);
    this.saveQueueToStorage();
    
    console.log('[NetworkService] Operation queued:', id, operation.type);
    
    // Try to process queue if online
    if (this.getNetworkStatus().online) {
      this.processQueue();
    }
    
    return id;
  }

  // Execute operation with retry logic
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === retryConfig.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt, retryConfig);
        console.log(`[NetworkService] Retry attempt ${attempt + 1} in ${delay}ms`);
        
        await this.delay(delay);
      }
    }
    
    throw lastError!;
  }

  // Process queued operations
  private async processQueue() {
    if (this.isProcessingQueue || !this.getNetworkStatus().online) {
      return;
    }
    
    this.isProcessingQueue = true;
    console.log('[NetworkService] Processing queue with', this.operationQueue.length, 'operations');
    
    // Sort by priority and timestamp
    this.operationQueue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp;
    });
    
    const operations = [...this.operationQueue];
    
    for (const operation of operations) {
      if (!this.getNetworkStatus().online) {
        break;
      }
      
      try {
        await this.executeQueuedOperation(operation);
        this.removeFromQueue(operation.id);
      } catch (error) {
        console.error('[NetworkService] Failed to execute queued operation:', operation.id, error);
        
        if (operation.retryCount >= operation.maxRetries) {
          console.log('[NetworkService] Max retries reached, removing operation:', operation.id);
          this.removeFromQueue(operation.id);
        } else {
          // Increment retry count and schedule retry
          operation.retryCount++;
          this.scheduleRetry(operation);
        }
      }
    }
    
    this.isProcessingQueue = false;
    this.saveQueueToStorage();
  }

  // Execute a queued operation
  private async executeQueuedOperation(operation: QueuedOperation): Promise<any> {
    const { url, method, data, headers } = operation;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: data ? JSON.stringify(data) : undefined
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  }

  // Handle online event
  private handleOnline() {
    console.log('[NetworkService] Network came online');
    this.status = this.getNetworkStatus();
    this.notifyListeners();
    this.processQueue();
  }

  // Handle offline event
  private handleOffline() {
    console.log('[NetworkService] Network went offline');
    this.status = this.getNetworkStatus();
    this.notifyListeners();
  }

  // Handle network status change from service worker
  private handleNetworkStatusChange(event: CustomEvent) {
    console.log('[NetworkService] Network status changed:', event.detail);
    this.notifyListeners();
    
    if (event.detail.online) {
      this.processQueue();
    }
  }

  // Handle connection change
  private handleConnectionChange() {
    console.log('[NetworkService] Connection changed');
    this.status = this.getNetworkStatus();
    this.notifyListeners();
  }

  // Notify all listeners
  private notifyListeners() {
    this.status = this.getNetworkStatus();
    this.listeners.forEach(listener => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('[NetworkService] Error in network listener:', error);
      }
    });
  }

  // Periodic connectivity check
  private startPeriodicConnectivityCheck() {
    setInterval(async () => {
      if (navigator.onLine) {
        try {
          // Try to fetch a small resource to verify actual connectivity
          const response = await fetch('/manifest.json', { 
            method: 'HEAD',
            cache: 'no-cache'
          });
          
          if (!response.ok && this.getNetworkStatus().online) {
            // Browser thinks we're online but we can't reach our server
            console.log('[NetworkService] Connectivity check failed despite online status');
          }
        } catch (error) {
          console.log('[NetworkService] Connectivity check failed:', error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  // Calculate retry delay with exponential backoff
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffFactor, attempt);
    const cappedDelay = Math.min(exponentialDelay, config.maxDelay);
    
    if (config.jitter) {
      // Add random jitter to prevent thundering herd
      const jitter = cappedDelay * 0.1 * Math.random();
      return cappedDelay + jitter;
    }
    
    return cappedDelay;
  }

  // Utility functions
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private removeFromQueue(id: string) {
    this.operationQueue = this.operationQueue.filter(op => op.id !== id);
    
    // Clear any pending retry timeout
    const timeout = this.retryTimeouts.get(id);
    if (timeout) {
      clearTimeout(timeout);
      this.retryTimeouts.delete(id);
    }
  }

  private scheduleRetry(operation: QueuedOperation) {
    const delay = this.calculateRetryDelay(operation.retryCount, this.defaultRetryConfig);
    
    const timeout = setTimeout(() => {
      this.retryTimeouts.delete(operation.id);
      if (this.getNetworkStatus().online) {
        this.processQueue();
      }
    }, delay);
    
    this.retryTimeouts.set(operation.id, timeout);
  }

  // Persistence
  private saveQueueToStorage() {
    try {
      localStorage.setItem('networkService_queue', JSON.stringify(this.operationQueue));
    } catch (error) {
      console.error('[NetworkService] Failed to save queue to storage:', error);
    }
  }

  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('networkService_queue');
      if (stored) {
        this.operationQueue = JSON.parse(stored);
        console.log('[NetworkService] Loaded', this.operationQueue.length, 'operations from storage');
      }
    } catch (error) {
      console.error('[NetworkService] Failed to load queue from storage:', error);
      this.operationQueue = [];
    }
  }

  // Public API
  isOnline(): boolean {
    return this.status.online;
  }

  getQueueStatus() {
    return {
      total: this.operationQueue.length,
      byPriority: {
        high: this.operationQueue.filter(op => op.priority === 'high').length,
        normal: this.operationQueue.filter(op => op.priority === 'normal').length,
        low: this.operationQueue.filter(op => op.priority === 'low').length
      },
      processing: this.isProcessingQueue
    };
  }

  clearQueue() {
    this.operationQueue = [];
    this.retryTimeouts.forEach(timeout => clearTimeout(timeout));
    this.retryTimeouts.clear();
    this.saveQueueToStorage();
    console.log('[NetworkService] Queue cleared');
  }
}

// Export singleton instance
export const networkService = new NetworkService();
