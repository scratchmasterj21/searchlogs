import React, { useEffect, useState, useContext, useCallback } from 'react';
import { ref, get, set, remove } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import LogoutButton from './Logout.tsx';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    firstVisit: string;
    hardwareConcurrency: number;
    isNamed: boolean;
    lastSeen: string;
    screenResolution: string;
    userAgent: string;
    searchBlocked: boolean;
}

const DeviceManagement: React.FC = () => {
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [editingDevice, setEditingDevice] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ deviceName: '', isNamed: false, searchBlocked: false });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState<'deviceName' | 'lastSeen' | 'firstVisit'>('lastSeen');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [bulkEditMode, setBulkEditMode] = useState(false);
    const [bulkEditForm, setBulkEditForm] = useState({ deviceName: '', isNamed: false, searchBlocked: false });
    
    const { user } = useContext(AuthContext);

    // Load devices from database
    const loadDevices = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const deviceRegistryRef = ref(databaseLog, 'deviceRegistry');
            const snapshot = await get(deviceRegistryRef);
            
            if (snapshot.exists()) {
                const deviceRegistry = snapshot.val();
                const deviceList: DeviceInfo[] = Object.keys(deviceRegistry).map(deviceId => ({
                    deviceId,
                    ...deviceRegistry[deviceId]
                }));
                setDevices(deviceList);
            } else {
                setDevices([]);
            }
        } catch (err) {
            setError('Failed to load devices. Please try again.');
            console.error('Error loading devices:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load devices on component mount
    useEffect(() => {
        loadDevices();
    }, [loadDevices]);

    // Handle device edit
    const handleEditDevice = (device: DeviceInfo) => {
        setEditingDevice(device.deviceId);
        setEditForm({
            deviceName: device.deviceName,
            isNamed: device.isNamed,
            searchBlocked: device.searchBlocked || false
        });
    };

    // Save device changes
    const handleSaveDevice = async (deviceId: string) => {
        if (!editForm.deviceName.trim()) {
            alert('Device name cannot be empty');
            return;
        }

        try {
            const deviceRef = ref(databaseLog, `deviceRegistry/${deviceId}`);
            const snapshot = await get(deviceRef);
            
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                await set(deviceRef, {
                    ...currentData,
                    deviceName: editForm.deviceName.trim(),
                    isNamed: editForm.isNamed,
                    searchBlocked: editForm.searchBlocked
                });
                
                // Update local state
                setDevices(prev => prev.map(device => 
                    device.deviceId === deviceId 
                        ? { ...device, deviceName: editForm.deviceName.trim(), isNamed: editForm.isNamed, searchBlocked: editForm.searchBlocked }
                        : device
                ));
                
                setEditingDevice(null);
                setEditForm({ deviceName: '', isNamed: false, searchBlocked: false });
            }
        } catch (err) {
            setError('Failed to update device. Please try again.');
            console.error('Error updating device:', err);
        }
    };

    // Cancel edit
    const handleCancelEdit = () => {
        setEditingDevice(null);
        setEditForm({ deviceName: '', isNamed: false, searchBlocked: false });
    };

    // Bulk edit functions
    const handleBulkEdit = () => {
        setBulkEditMode(true);
        setBulkEditForm({ deviceName: '', isNamed: false, searchBlocked: false });
    };

    const handleBulkSave = async () => {
        if (!bulkEditForm.deviceName.trim()) {
            alert('Device name cannot be empty');
            return;
        }

        const unnamedDevices = devices.filter(device => !device.isNamed);
        
        if (unnamedDevices.length === 0) {
            alert('No unnamed devices found to update');
            return;
        }

        const confirmed = window.confirm(
            `This will set the device name to "${bulkEditForm.deviceName}" and mark as named for ${unnamedDevices.length} unnamed devices. Continue?`
        );

        if (confirmed) {
            try {
                const promises = unnamedDevices.map(async (device) => {
                    const deviceRef = ref(databaseLog, `deviceRegistry/${device.deviceId}`);
                    const snapshot = await get(deviceRef);
                    
                    if (snapshot.exists()) {
                        const currentData = snapshot.val();
                        await set(deviceRef, {
                            ...currentData,
                            deviceName: bulkEditForm.deviceName.trim(),
                            isNamed: bulkEditForm.isNamed,
                            searchBlocked: bulkEditForm.searchBlocked
                        });
                    }
                });

                await Promise.all(promises);
                
                // Update local state
                setDevices(prev => prev.map(device => 
                    !device.isNamed 
                        ? { ...device, deviceName: bulkEditForm.deviceName.trim(), isNamed: bulkEditForm.isNamed, searchBlocked: bulkEditForm.searchBlocked }
                        : device
                ));
                
                setBulkEditMode(false);
                setBulkEditForm({ deviceName: '', isNamed: false, searchBlocked: false });
            } catch (err) {
                setError('Failed to update devices. Please try again.');
                console.error('Error updating devices:', err);
            }
        }
    };

    const handleBulkCancel = () => {
        setBulkEditMode(false);
        setBulkEditForm({ deviceName: '', isNamed: false, searchBlocked: false });
    };

    // Toggle search blocking directly
    const handleToggleSearchBlocking = async (deviceId: string, currentStatus: boolean) => {
        try {
            const deviceRef = ref(databaseLog, `deviceRegistry/${deviceId}`);
            const snapshot = await get(deviceRef);
            
            if (snapshot.exists()) {
                const currentData = snapshot.val();
                await set(deviceRef, {
                    ...currentData,
                    searchBlocked: !currentStatus
                });
                
                // Update local state
                setDevices(prev => prev.map(device => 
                    device.deviceId === deviceId 
                        ? { ...device, searchBlocked: !currentStatus }
                        : device
                ));
            }
        } catch (err) {
            setError('Failed to update search blocking. Please try again.');
            console.error('Error updating search blocking:', err);
        }
    };

    // Delete device
    const handleDeleteDevice = async (deviceId: string, deviceName: string) => {
        const confirmed = window.confirm(
            `Are you sure you want to delete device "${deviceName}"? This action cannot be undone.`
        );
        
        if (confirmed) {
            try {
                const deviceRef = ref(databaseLog, `deviceRegistry/${deviceId}`);
                await remove(deviceRef);
                
                // Update local state
                setDevices(prev => prev.filter(device => device.deviceId !== deviceId));
            } catch (err) {
                setError('Failed to delete device. Please try again.');
                console.error('Error deleting device:', err);
            }
        }
    };

    // Filter and sort devices
    const filteredAndSortedDevices = devices
        .filter(device => 
            (device.deviceName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (device.deviceId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (device.userAgent || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'deviceName':
                    comparison = (a.deviceName || '').localeCompare(b.deviceName || '');
                    break;
                case 'lastSeen':
                    comparison = new Date(a.lastSeen || 0).getTime() - new Date(b.lastSeen || 0).getTime();
                    break;
                case 'firstVisit':
                    comparison = new Date(a.firstVisit || 0).getTime() - new Date(b.firstVisit || 0).getTime();
                    break;
            }
            
            return sortOrder === 'asc' ? comparison : -comparison;
        });

    // Format date for display

    // Get device type from user agent

    return (
        <div className="container mx-auto px-6 py-8">
            {/* Navbar */}
            <nav className="bg-gradient-to-r from-blue-600 to-blue-700 shadow-xl rounded-xl mb-8 overflow-hidden">
                <div className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                        {/* User info */}
                        <div className="flex items-center">
                            {user && (
                                <div className="flex items-center space-x-3">
                                    <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="text-white font-semibold text-sm">
                                            {user.displayName || 'User'}
                                        </p>
                                        <p className="text-blue-100 text-xs">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Title */}
                        <div className="flex items-center">
                            <div className="text-center">
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl text-white font-extrabold">
                                    Device Management
                                </h1>
                                <p className="text-blue-100 text-sm mt-1">
                                    Manage Device Registry
                                </p>
                            </div>
                        </div>
                        
                        {/* Navigation */}
                        <div className="flex items-center space-x-3">
                            <Link 
                                to="/" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                Search Logs
                            </Link>
                            <Link 
                                to="/analytics" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                Analytics
                            </Link>
                            <LogoutButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Search and Filter Controls */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Search Devices</label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
                            placeholder="Search by device name, ID, or user agent..."
                        />
                    </div>
                    <div className="lg:w-48">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as 'deviceName' | 'lastSeen' | 'firstVisit')}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
                        >
                            <option value="lastSeen">Last Seen</option>
                            <option value="deviceName">Device Name</option>
                            <option value="firstVisit">First Visit</option>
                        </select>
                    </div>
                    <div className="lg:w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Order</label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
                        >
                            <option value="desc">Newest</option>
                            <option value="asc">Oldest</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                    {error}
                </div>
            )}

            {/* Loading Indicator */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600"></div>
                    <p className="mt-4 text-gray-600 text-lg">Loading devices...</p>
                </div>
            )}

            {/* Devices List */}
            {!loading && (
                <>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-gray-900">
                            {filteredAndSortedDevices.length} devices found
                            {devices.filter(d => !d.isNamed).length > 0 && (
                                <span className="text-sm text-yellow-600 ml-2">
                                    ({devices.filter(d => !d.isNamed).length} unnamed)
                                </span>
                            )}
                        </h2>
                        <div className="flex space-x-2">
                            {devices.filter(d => !d.isNamed).length > 0 && (
                                <button
                                    onClick={handleBulkEdit}
                                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200 flex items-center space-x-2"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span>Bulk Name Unnamed</span>
                                </button>
                            )}
                            <button
                                onClick={loadDevices}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Bulk Edit Form */}
                    {bulkEditMode && (
                        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <h3 className="text-lg font-semibold text-yellow-800 mb-3">Bulk Edit Unnamed Devices</h3>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Device Name</label>
                                    <input
                                        type="text"
                                        value={bulkEditForm.deviceName}
                                        onChange={(e) => setBulkEditForm(prev => ({ ...prev, deviceName: e.target.value }))}
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
                                        placeholder="Enter device name for all unnamed devices"
                                    />
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="bulkIsNamed"
                                        checked={bulkEditForm.isNamed}
                                        onChange={(e) => setBulkEditForm(prev => ({ ...prev, isNamed: e.target.checked }))}
                                        className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                                    />
                                    <label htmlFor="bulkIsNamed" className="text-sm text-gray-700">
                                        Mark as named
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="bulkSearchBlocked"
                                        checked={bulkEditForm.searchBlocked}
                                        onChange={(e) => setBulkEditForm(prev => ({ ...prev, searchBlocked: e.target.checked }))}
                                        className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                                    />
                                    <label htmlFor="bulkSearchBlocked" className="text-sm text-gray-700">
                                        Block search access
                                    </label>
                                </div>
                                <div className="flex space-x-2">
                                    <button
                                        onClick={handleBulkSave}
                                        className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors duration-200"
                                    >
                                        Apply to {devices.filter(d => !d.isNamed).length} devices
                                    </button>
                                    <button
                                        onClick={handleBulkCancel}
                                        className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Devices Table */}
                    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Device ID
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Device Name
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Status
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Search Access
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredAndSortedDevices.map((device) => (
                                        <tr key={device.deviceId} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-mono text-gray-900 max-w-xs truncate" title={device.deviceId || 'Unknown'}>
                                                    {device.deviceId || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {editingDevice === device.deviceId ? (
                                                    <div className="space-y-2">
                                                        <input
                                                            type="text"
                                                            value={editForm.deviceName}
                                                            onChange={(e) => setEditForm(prev => ({ ...prev, deviceName: e.target.value }))}
                                                            className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                                            placeholder="Enter device name"
                                                            autoFocus
                                                        />
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                id={`isNamed-${device.deviceId}`}
                                                                checked={editForm.isNamed}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, isNamed: e.target.checked }))}
                                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <label htmlFor={`isNamed-${device.deviceId}`} className="text-xs text-gray-700">
                                                                Named
                                                            </label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <input
                                                                type="checkbox"
                                                                id={`searchBlocked-${device.deviceId}`}
                                                                checked={editForm.searchBlocked}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, searchBlocked: e.target.checked }))}
                                                                className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500"
                                                            />
                                                            <label htmlFor={`searchBlocked-${device.deviceId}`} className="text-xs text-gray-700">
                                                                Block Search
                                                            </label>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-sm text-gray-900">
                                                        {device.deviceName || 'Unnamed Device'}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    device.isNamed 
                                                        ? 'bg-green-100 text-green-800' 
                                                        : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {device.isNamed ? 'Named' : 'Unnamed'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center space-x-3">
                                                    <button
                                                        onClick={() => handleToggleSearchBlocking(device.deviceId, device.searchBlocked || false)}
                                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                                            device.searchBlocked ? 'bg-red-600' : 'bg-green-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                                device.searchBlocked ? 'translate-x-6' : 'translate-x-1'
                                                            }`}
                                                        />
                                                    </button>
                                                    <span className={`text-xs font-medium ${
                                                        device.searchBlocked ? 'text-red-600' : 'text-green-600'
                                                    }`}>
                                                        {device.searchBlocked ? 'Blocked' : 'Allowed'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                {editingDevice === device.deviceId ? (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleSaveDevice(device.deviceId)}
                                                            className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex space-x-2">
                                                        <button
                                                            onClick={() => handleEditDevice(device)}
                                                            className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteDevice(device.deviceId, device.deviceName || 'Unknown')}
                                                            className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs font-medium transition-colors"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* No Devices Message */}
                    {filteredAndSortedDevices.length === 0 && (
                        <div className="text-center py-16">
                            <div className="max-w-md mx-auto">
                                <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">No devices found</h3>
                                <p className="text-gray-600 mb-6">
                                    {searchTerm ? 'No devices match your search criteria.' : 'No devices have been registered yet.'}
                                </p>
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm('')}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-medium"
                                    >
                                        Clear Search
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default DeviceManagement;
