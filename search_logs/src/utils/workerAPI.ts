// Worker API utility functions for controlling Cloudflare Worker KV status

// TODO: Update this URL after deploying your Cloudflare Worker
// The worker name in wrangler.jsonc is "backend", so the URL will be something like:
// https://backend.YOUR-ACCOUNT-NAME.workers.dev
// Or if you have a custom domain, use that instead
const WORKER_BASE_URL = import.meta.env.VITE_WORKER_URL || 'https://backend.carlo587-jcl.workers.dev'
;

export interface WorkerStatusResponse {
  worker_status: 'on' | 'off';
  ai_status: 'on' | 'off';
  timestamp: number;
  version?: string;
}

export interface WorkerUpdateRequest {
  worker_status?: 'on' | 'off';
  ai_status?: 'on' | 'off';
  reason?: string;
}

export interface WorkerUpdateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  userId: string;
  userEmail: string;
  action: 'worker_enabled' | 'worker_disabled' | 'ai_enabled' | 'ai_disabled' | 'bulk_enable' | 'bulk_disable';
  oldValue?: string;
  newValue?: string;
  reason?: string;
  ipAddress?: string;
}

/**
 * Fetch current worker and AI status from KV namespace
 */
export async function getWorkerStatus(): Promise<WorkerStatusResponse> {
  try {
    const response = await fetch(`${WORKER_BASE_URL}/admin/worker-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch worker status: ${response.status} - ${errorText}`);
    }

    const data: WorkerStatusResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching worker status:', error);
    throw error;
  }
}

/**
 * Update worker status in KV namespace
 */
export async function updateWorkerStatus(
  authToken: string,
  updates: WorkerUpdateRequest
): Promise<WorkerUpdateResponse> {
  try {
    const response = await fetch(`${WORKER_BASE_URL}/admin/worker-status`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update worker status: ${response.status} - ${errorText}`);
    }

    const data: WorkerUpdateResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error updating worker status:', error);
    throw error;
  }
}

/**
 * Test if the worker is responding (health check)
 */
export async function testWorkerHealth(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${WORKER_BASE_URL}/admin/worker-status`, {
      method: 'GET',
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      return {
        healthy: false,
        responseTime,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    return {
      healthy: true,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      healthy: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test search functionality
 */
export async function testSearchService(): Promise<{ working: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${WORKER_BASE_URL}?query=test&searchType=web&start=1`);
    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const data = await response.json();
      return {
        working: false,
        responseTime,
        error: data.error || `HTTP ${response.status}`
      };
    }

    return {
      working: true,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      working: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test AI chat functionality
 */
export async function testAIChatService(): Promise<{ working: boolean; responseTime: number; error?: string }> {
  const startTime = Date.now();
  
  try {
    const response = await fetch(`${WORKER_BASE_URL}/ai-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'Hello',
        maxSources: 3
      })
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const data = await response.json();
      return {
        working: false,
        responseTime,
        error: data.error || data.message || `HTTP ${response.status}`
      };
    }

    return {
      working: true,
      responseTime
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      working: false,
      responseTime,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get worker base URL for display
 */
export function getWorkerURL(): string {
  return WORKER_BASE_URL;
}
