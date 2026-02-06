import React, { useState, useEffect, useCallback, useContext } from 'react';
import { Link } from 'react-router-dom';
import { ref, push, onValue, off } from 'firebase/database';
import { database } from './firebaseConfig';
import { AuthContext } from './AuthProvider';
import LogoutButton from './Logout';
import {
  getWorkerStatus,
  updateWorkerStatus,
  testWorkerHealth,
  testSearchService,
  testAIChatService,
  getWorkerURL,
  WorkerStatusResponse,
  ActivityLogEntry
} from './utils/workerAPI';

const WorkerControlPanel: React.FC = () => {
  const { user } = useContext(AuthContext);
  
  // Worker status state
  const [workerStatus, setWorkerStatus] = useState<'on' | 'off' | 'unknown'>('unknown');
  const [aiStatus, setAIStatus] = useState<'on' | 'off' | 'unknown'>('unknown');
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<{ worker: boolean; ai: boolean }>({ worker: false, ai: false });
  
  // Health check state
  const [healthCheck, setHealthCheck] = useState<{ healthy: boolean; responseTime: number; error?: string } | null>(null);
  const [searchCheck, setSearchCheck] = useState<{ working: boolean; responseTime: number; error?: string } | null>(null);
  const [aiChatCheck, setAIChatCheck] = useState<{ working: boolean; responseTime: number; error?: string } | null>(null);
  
  // Activity log state
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);
  
  // Error and confirmation state
  const [error, setError] = useState<string>('');
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    action: 'worker_enabled' | 'worker_disabled' | 'ai_enabled' | 'ai_disabled' | 'bulk_enable' | 'bulk_disable' | null;
    message: string;
  }>({ show: false, action: null, message: '' });

  // Auto-refresh state
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  /**
   * Fetch worker status from API
   */
  const fetchWorkerStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const status: WorkerStatusResponse = await getWorkerStatus();
      setWorkerStatus(status.worker_status || 'unknown');
      setAIStatus(status.ai_status || 'unknown');
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching worker status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch worker status');
      setWorkerStatus('unknown');
      setAIStatus('unknown');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Run health checks
   */
  const runHealthChecks = useCallback(async () => {
    const [health, search, aiChat] = await Promise.all([
      testWorkerHealth(),
      testSearchService(),
      testAIChatService()
    ]);
    
    setHealthCheck(health);
    setSearchCheck(search);
    setAIChatCheck(aiChat);
  }, []);

  /**
   * Handle worker status toggle
   */
  const handleWorkerToggle = async (newStatus: 'on' | 'off') => {
    if (!user) return;

    setConfirmDialog({
      show: true,
      action: newStatus === 'on' ? 'worker_enabled' : 'worker_disabled',
      message: `Are you sure you want to ${newStatus === 'on' ? 'ENABLE' : 'DISABLE'} the Worker Service?\n\nThis will ${newStatus === 'on' ? 'activate' : 'deactivate'} the entire search engine backend.`
    });
  };

  /**
   * Handle AI status toggle
   */
  const handleAIToggle = async (newStatus: 'on' | 'off') => {
    if (!user) return;

    setConfirmDialog({
      show: true,
      action: newStatus === 'on' ? 'ai_enabled' : 'ai_disabled',
      message: `Are you sure you want to ${newStatus === 'on' ? 'ENABLE' : 'DISABLE'} AI Chat Service?\n\nThis will ${newStatus === 'on' ? 'activate' : 'deactivate'} the AI-powered chat and related questions features.`
    });
  };

  /**
   * Handle bulk enable (both services)
   */
  const handleBulkEnable = () => {
    setConfirmDialog({
      show: true,
      action: 'bulk_enable',
      message: 'Enable both Worker Service and AI Chat Service?\n\nThis will activate all search engine features.'
    });
  };

  /**
   * Handle bulk disable (both services)
   */
  const handleBulkDisable = () => {
    setConfirmDialog({
      show: true,
      action: 'bulk_disable',
      message: 'Disable both Worker Service and AI Chat Service?\n\nThis will deactivate the entire search engine.'
    });
  };

  /**
   * Confirm and execute action
   */
  const executeAction = async () => {
    if (!confirmDialog.action || !user) return;

    const action = confirmDialog.action;
    setConfirmDialog({ show: false, action: null, message: '' });

    try {
      setError('');

      // Get auth token
      const token = await user.getIdToken();

      // Determine which status to update
      let updates: { worker_status?: 'on' | 'off'; ai_status?: 'on' | 'off' } = {};
      let updateWorker = false;

      switch (action) {
        case 'worker_enabled':
          updates.worker_status = 'on';
          updateWorker = true;
          setUpdating(prev => ({ ...prev, worker: true }));
          break;
        case 'worker_disabled':
          updates.worker_status = 'off';
          updateWorker = true;
          setUpdating(prev => ({ ...prev, worker: true }));
          break;
        case 'ai_enabled':
          updates.ai_status = 'on';
          updateWorker = false;
          setUpdating(prev => ({ ...prev, ai: true }));
          break;
        case 'ai_disabled':
          updates.ai_status = 'off';
          updateWorker = false;
          setUpdating(prev => ({ ...prev, ai: true }));
          break;
        case 'bulk_enable':
          updates.worker_status = 'on';
          updates.ai_status = 'on';
          updateWorker = true;
          setUpdating({ worker: true, ai: true });
          break;
        case 'bulk_disable':
          updates.worker_status = 'off';
          updates.ai_status = 'off';
          updateWorker = true;
          setUpdating({ worker: true, ai: true });
          break;
      }

      // Update worker status
      const response = await updateWorkerStatus(token, updates);

      if (!response.success) {
        throw new Error(response.error || 'Failed to update worker status');
      }

      // Log activity to Firebase
      const logEntry: Omit<ActivityLogEntry, 'id'> = {
        timestamp: Date.now(),
        userId: user.uid,
        userEmail: user.email || 'unknown',
        action: action,
        oldValue: updateWorker ? workerStatus : aiStatus,
        newValue: updates.worker_status || updates.ai_status || 'unknown',
        reason: 'Manual toggle from control panel'
      };

      await push(ref(database, 'workerActivityLogs'), logEntry);

      // Refresh status
      await fetchWorkerStatus();
      await runHealthChecks();

    } catch (err) {
      console.error('Error updating worker status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update worker status');
    } finally {
      setUpdating({ worker: false, ai: false });
    }
  };

  /**
   * Cancel confirmation dialog
   */
  const cancelAction = () => {
    setConfirmDialog({ show: false, action: null, message: '' });
  };

  /**
   * Load activity logs from Firebase
   */
  useEffect(() => {
    const logsRef = ref(database, 'workerActivityLogs');
    
    const unsubscribe = onValue(logsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const logs: ActivityLogEntry[] = [];
        
        Object.keys(data).forEach(key => {
          logs.push({
            id: key,
            ...data[key]
          });
        });
        
        // Sort by timestamp, newest first
        logs.sort((a, b) => b.timestamp - a.timestamp);
        setActivityLogs(logs.slice(0, 50)); // Keep last 50 logs
      }
    });

    return () => off(logsRef, 'value', unsubscribe);
  }, []);

  /**
   * Initial load and auto-refresh
   */
  useEffect(() => {
    fetchWorkerStatus();
    runHealthChecks();
  }, [fetchWorkerStatus, runHealthChecks]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchWorkerStatus();
      runHealthChecks();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, fetchWorkerStatus, runHealthChecks]);

  /**
   * Format timestamp to JST
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('ja-JP', { 
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  /**
   * Get status badge color
   */
  const getStatusColor = (status: 'on' | 'off' | 'unknown'): string => {
    switch (status) {
      case 'on': return 'bg-green-500';
      case 'off': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  /**
   * Get action label
   */
  const getActionLabel = (action: string): string => {
    const labels: { [key: string]: string } = {
      'worker_enabled': '✓ Worker Enabled',
      'worker_disabled': '✗ Worker Disabled',
      'ai_enabled': '✓ AI Enabled',
      'ai_disabled': '✗ AI Disabled',
      'bulk_enable': '✓✓ All Services Enabled',
      'bulk_disable': '✗✗ All Services Disabled'
    };
    return labels[action] || action;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <h1 className="text-2xl font-bold">⚙️ Worker Control Panel</h1>
            <div className="flex space-x-4">
              <Link to="/" className="hover:underline">Search Logs</Link>
              <Link to="/ai-chats" className="hover:underline">AI Chats</Link>
              <Link to="/analytics" className="hover:underline">Analytics</Link>
              <Link to="/ai-analytics" className="hover:underline">AI Analytics</Link>
              <Link to="/devices" className="hover:underline">Devices</Link>
              <Link to="/config" className="hover:underline">Config</Link>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user?.email}</span>
            <LogoutButton />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Cloudflare Worker Control Center</h2>
              <p className="text-gray-600">
                Manage your search engine backend services in real-time
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Worker URL: <code className="bg-gray-100 px-2 py-1 rounded">{getWorkerURL()}</code>
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center space-x-3">
                <label className="flex items-center space-x-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <span>Auto-refresh (30s)</span>
                </label>
                <button
                  onClick={() => { fetchWorkerStatus(); runHealthChecks(); }}
                  disabled={loading}
                  className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
                >
                  {loading ? '⟳ Refreshing...' : '↻ Refresh Now'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Last refresh: {lastRefresh.toLocaleTimeString('ja-JP')}
              </p>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-4 mb-4">
              <p className="text-red-700 font-medium mb-2">⚠️ Error: {error}</p>
              {error.includes('Failed to fetch') && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
                  <p className="text-sm text-yellow-800 font-semibold mb-2">💡 Worker Not Deployed?</p>
                  <p className="text-xs text-yellow-700 mb-2">
                    The Cloudflare Worker doesn't seem to be accessible. To deploy it:
                  </p>
                  <ol className="text-xs text-yellow-700 list-decimal list-inside space-y-1">
                    <li>Open terminal and navigate to: <code className="bg-yellow-100 px-1 rounded">backendgfa-search-engine-v1-backend</code></li>
                    <li>Run: <code className="bg-yellow-100 px-1 rounded">npx wrangler deploy</code></li>
                    <li>Copy the deployed worker URL (e.g., <code className="bg-yellow-100 px-1 rounded">https://backend.YOUR-ACCOUNT.workers.dev</code>)</li>
                    <li>Create a <code className="bg-yellow-100 px-1 rounded">.env</code> file in <code className="bg-yellow-100 px-1 rounded">search_logs/</code> folder</li>
                    <li>Add: <code className="bg-yellow-100 px-1 rounded">VITE_WORKER_URL=your-worker-url</code></li>
                    <li>Restart the dev server</li>
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Worker Service Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">🔧 Worker Service</h3>
                <p className="text-sm text-gray-600">Main search engine backend</p>
              </div>
              <div className={`px-4 py-2 rounded-full text-white font-bold ${getStatusColor(workerStatus)}`}>
                {workerStatus.toUpperCase()}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                Controls all search functionality including web search, image search, and API routing.
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Service Status:</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleWorkerToggle('off')}
                  disabled={updating.worker || workerStatus === 'off' || workerStatus === 'unknown'}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    workerStatus === 'off' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  OFF
                </button>
                <button
                  onClick={() => handleWorkerToggle('on')}
                  disabled={updating.worker || workerStatus === 'on'}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    workerStatus === 'on' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  ON
                </button>
              </div>
            </div>

            {updating.worker && (
              <div className="mt-3 text-center text-blue-600 text-sm font-medium">
                ⟳ Updating worker status...
              </div>
            )}

            {/* Health Check */}
            {healthCheck && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Health:</span>
                  <span className={`font-medium ${healthCheck.healthy ? 'text-green-600' : 'text-red-600'}`}>
                    {healthCheck.healthy ? '✓ Healthy' : '✗ Unhealthy'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-700">Response Time:</span>
                  <span className="font-medium text-gray-800">{healthCheck.responseTime}ms</span>
                </div>
                {healthCheck.error && (
                  <div className="mt-2 text-xs text-red-600">
                    Error: {healthCheck.error}
                  </div>
                )}
              </div>
            )}

            {/* Search Service Check */}
            {searchCheck && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">Search API:</span>
                  <span className={`font-medium ${searchCheck.working ? 'text-green-600' : 'text-red-600'}`}>
                    {searchCheck.working ? '✓ Working' : '✗ Not Working'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-700">Response Time:</span>
                  <span className="font-medium text-gray-800">{searchCheck.responseTime}ms</span>
                </div>
                {searchCheck.error && (
                  <div className="mt-2 text-xs text-red-600">
                    Error: {searchCheck.error}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* AI Service Card */}
          <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-gray-800 mb-1">🤖 AI Chat Service</h3>
                <p className="text-sm text-gray-600">AI-powered search assistance</p>
              </div>
              <div className={`px-4 py-2 rounded-full text-white font-bold ${getStatusColor(aiStatus)}`}>
                {aiStatus.toUpperCase()}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-700 mb-2">
                Enables AI chat responses, related questions, and intelligent search summaries.
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Service Status:</span>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => handleAIToggle('off')}
                  disabled={updating.ai || aiStatus === 'off' || aiStatus === 'unknown'}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    aiStatus === 'off' 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  OFF
                </button>
                <button
                  onClick={() => handleAIToggle('on')}
                  disabled={updating.ai || aiStatus === 'on'}
                  className={`px-4 py-2 rounded-md font-medium transition-colors ${
                    aiStatus === 'on' 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  ON
                </button>
              </div>
            </div>

            {updating.ai && (
              <div className="mt-3 text-center text-purple-600 text-sm font-medium">
                ⟳ Updating AI status...
              </div>
            )}

            {/* AI Chat Check */}
            {aiChatCheck && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">AI Chat API:</span>
                  <span className={`font-medium ${aiChatCheck.working ? 'text-green-600' : 'text-red-600'}`}>
                    {aiChatCheck.working ? '✓ Working' : '✗ Not Working'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-gray-700">Response Time:</span>
                  <span className="font-medium text-gray-800">{aiChatCheck.responseTime}ms</span>
                </div>
                {aiChatCheck.error && (
                  <div className="mt-2 text-xs text-red-600">
                    Error: {aiChatCheck.error}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">⚡ Quick Actions</h3>
          <div className="flex space-x-4">
            <button
              onClick={handleBulkEnable}
              disabled={updating.worker || updating.ai || (workerStatus === 'on' && aiStatus === 'on')}
              className="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ✓✓ Enable All Services
            </button>
            <button
              onClick={handleBulkDisable}
              disabled={updating.worker || updating.ai || (workerStatus === 'off' && aiStatus === 'off')}
              className="flex-1 bg-red-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ✗✗ Disable All Services
            </button>
          </div>
        </div>

        {/* Activity Log Section */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">📋 Activity Log</h3>
            <button
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
            >
              {showActivityLog ? '▲ Hide' : '▼ Show'} ({activityLogs.length} entries)
            </button>
          </div>

          {showActivityLog && (
            <div className="max-h-96 overflow-y-auto">
              {activityLogs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No activity logs yet</p>
              ) : (
                <div className="space-y-2">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-800">{getActionLabel(log.action)}</div>
                          <div className="text-sm text-gray-600 mt-1">
                            By: {log.userEmail}
                          </div>
                          {log.reason && (
                            <div className="text-sm text-gray-600 mt-1">
                              Reason: {log.reason}
                            </div>
                          )}
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-800 mb-4">⚠️ Confirm Action</h3>
            <p className="text-gray-700 whitespace-pre-line mb-6">{confirmDialog.message}</p>
            <div className="flex space-x-3">
              <button
                onClick={cancelAction}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors font-medium"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerControlPanel;
