import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { AIChatLog } from './types';
import LogoutButton from './Logout.tsx';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

// Utility function for debouncing
const useDebounce = (value: string, delay: number) => {
    const [debouncedValue, setDebouncedValue] = useState(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
};

// Export functionality
const exportToCSV = (data: AIChatLog[], deviceMappings: { [key: string]: string }) => {
    const headers = ['Date', 'Device ID', 'User Message', 'AI Model', 'Confidence', 'Processing Time (ms)', 'Tokens Used', 'Sources Count'];
    const csvContent = [
        headers.join(','),
        ...data.map(log => [
            formatDateTime(log.date),
            `"${deviceMappings[log.deviceId] || log.deviceId}"`,
            `"${log.userMessage.replace(/"/g, '""')}"`,
            log.aiModel,
            log.confidence,
            log.processingTime,
            log.tokensUsed,
            log.sourcesCount || 0
        ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ai_chat_logs_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

type SortKey = keyof Pick<AIChatLog, 'date' | 'deviceId' | 'userMessage' | 'confidence' | 'processingTime'>;

// Utility functions
const toJST = (date: Date): Date => {
    const jstOffset = 9 * 60;
    const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
    return new Date(utcDate.getTime() + (jstOffset * 60000));
};

const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateTime = (dateTimeString: string) => {
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return new Intl.DateTimeFormat('en-US', options).format(new Date(dateTimeString)).replace(',', '');
};

const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-green-100 text-green-800';
    if (confidence >= 0.4) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
};

const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) return 'High';
    if (confidence >= 0.4) return 'Medium';
    return 'Low';
};

const AIChatLogsTable: React.FC = () => {
    const [logs, setLogs] = useState<AIChatLog[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filter states
    const [fromDate, setFromDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [deviceId, setDeviceId] = useState('');
    const [userMessage, setUserMessage] = useState('');
    const [aiModel, setAiModel] = useState('');
    const [minConfidence, setMinConfidence] = useState('');
    const [maxConfidence, setMaxConfidence] = useState('');
    const [minProcessingTime, setMinProcessingTime] = useState('');
    const [maxProcessingTime, setMaxProcessingTime] = useState('');
    const [minTokens, setMinTokens] = useState('');
    const [maxTokens, setMaxTokens] = useState('');
    const [timeRange, setTimeRange] = useState('');
    
    // Debounced search values
    const debouncedDeviceId = useDebounce(deviceId, 300);
    const debouncedUserMessage = useDebounce(userMessage, 300);
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);
    const [expandedCard, setExpandedCard] = useState<string | null>(null);
    const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set());
    const [selectAll, setSelectAll] = useState(false);
    
    const { user } = useContext(AuthContext);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
        key: 'date', 
        direction: 'desc' 
    });

    // Load device mappings once
    useEffect(() => {
        const loadDeviceMappings = async () => {
            try {
                const deviceRegistryRef = ref(databaseLog, 'deviceRegistry');
                const snapshot = await get(deviceRegistryRef);
                if (snapshot.exists()) {
                    const deviceRegistry = snapshot.val();
                    const mappings: { [key: string]: string } = {};
                    Object.keys(deviceRegistry).forEach(deviceId => {
                        const device = deviceRegistry[deviceId];
                        mappings[deviceId] = device.deviceName || deviceId;
                    });
                    setDeviceMappings(mappings);
                }
            } catch (err) {
                console.error('Error loading device mappings:', err);
            }
        };
        
        loadDeviceMappings();
    }, []);

    // Optimized data fetching function
    const fetchLogs = useCallback(async (fromDateStr: string, toDateStr: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const fromDateTime = toJST(new Date(fromDateStr));
            const toDateTime = toJST(new Date(toDateStr));
            fromDateTime.setHours(0, 0, 0, 0);
            toDateTime.setHours(23, 59, 59, 999);

            const formattedData: AIChatLog[] = [];
            
            const currentDate = new Date(fromDateTime);
            const promises: Promise<any>[] = [];
            
            while (currentDate <= toDateTime) {
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                
                const dayRef = ref(databaseLog, `aiChatLogs/${year}/${month}/${day}`);
                promises.push(
                    get(dayRef).then(snapshot => {
                        if (snapshot.exists()) {
                            const dayData = snapshot.val();
                            Object.keys(dayData).forEach(logId => {
                                const logEntry = dayData[logId];
                                const dateTime = new Date(logEntry.date || `${year}-${month}-${day}T00:00:00`);
                                formattedData.push({
                                    id: logId,
                                    date: dateTime.toISOString(),
                                    ...logEntry
                                });
                            });
                        }
                    }).catch(err => {
                        console.warn(`Error fetching data for ${year}-${month}-${day}:`, err);
                    })
                );
                
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            await Promise.all(promises);
            
            formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLogs(formattedData);
            
        } catch (err) {
            setError('Failed to fetch AI chat logs. Please try again.');
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Client-side filtering with memoization
    const filteredLogs = useMemo(() => {
        let filtered = logs;

        if (debouncedDeviceId) {
            const deviceIdLower = debouncedDeviceId.toLowerCase();
            filtered = filtered.filter(log => 
                (deviceMappings[log.deviceId] || log.deviceId).toLowerCase().includes(deviceIdLower)
            );
        }

        if (debouncedUserMessage) {
            const messageLower = debouncedUserMessage.toLowerCase();
            filtered = filtered.filter(log => 
                log.userMessage.toLowerCase().includes(messageLower)
            );
        }

        if (aiModel) {
            filtered = filtered.filter(log => log.aiModel === aiModel);
        }

        if (minConfidence) {
            const min = parseFloat(minConfidence);
            if (!isNaN(min)) {
                filtered = filtered.filter(log => log.confidence >= min);
            }
        }

        if (maxConfidence) {
            const max = parseFloat(maxConfidence);
            if (!isNaN(max)) {
                filtered = filtered.filter(log => log.confidence <= max);
            }
        }

        if (minProcessingTime) {
            const min = parseInt(minProcessingTime);
            if (!isNaN(min)) {
                filtered = filtered.filter(log => log.processingTime >= min);
            }
        }

        if (maxProcessingTime) {
            const max = parseInt(maxProcessingTime);
            if (!isNaN(max)) {
                filtered = filtered.filter(log => log.processingTime <= max);
            }
        }

        if (minTokens) {
            const min = parseInt(minTokens);
            if (!isNaN(min)) {
                filtered = filtered.filter(log => log.tokensUsed >= min);
            }
        }

        if (maxTokens) {
            const max = parseInt(maxTokens);
            if (!isNaN(max)) {
                filtered = filtered.filter(log => log.tokensUsed <= max);
            }
        }

        if (timeRange) {
            const now = new Date();
            const timeRanges = {
                '1h': new Date(now.getTime() - 60 * 60 * 1000),
                '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
                '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
                '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
            };
            
            if (timeRanges[timeRange as keyof typeof timeRanges]) {
                const cutoff = timeRanges[timeRange as keyof typeof timeRanges];
                filtered = filtered.filter(log => new Date(log.date) >= cutoff);
            }
        }

        return filtered;
    }, [logs, debouncedDeviceId, debouncedUserMessage, aiModel, minConfidence, maxConfidence, minProcessingTime, maxProcessingTime, minTokens, maxTokens, timeRange, deviceMappings]);

    // Sorting with memoization
    const sortedLogs = useMemo(() => {
        return [...filteredLogs].sort((a, b) => {
            const { key, direction } = sortConfig;
            
            if (key === 'deviceId') {
                const deviceA = deviceMappings[a.deviceId] || a.deviceId;
                const deviceB = deviceMappings[b.deviceId] || b.deviceId;
                const comparison = deviceA.localeCompare(deviceB);
                return direction === 'asc' ? comparison : -comparison;
            } else if (key === 'date') {
                const dateA = new Date(a.date).getTime();
                const dateB = new Date(b.date).getTime();
                return direction === 'asc' ? dateA - dateB : dateB - dateA;
            } else if (key === 'confidence' || key === 'processingTime') {
                const comparison = a[key] - b[key];
                return direction === 'asc' ? comparison : -comparison;
            } else {
                const comparison = String(a[key]).localeCompare(String(b[key]));
                return direction === 'asc' ? comparison : -comparison;
            }
        });
    }, [filteredLogs, sortConfig, deviceMappings]);

    // Pagination
    const paginatedLogs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return sortedLogs.slice(startIndex, startIndex + itemsPerPage);
    }, [sortedLogs, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(sortedLogs.length / itemsPerPage);

    const handleFilter = useCallback(() => {
        setCurrentPage(1);
        fetchLogs(fromDate, toDate);
    }, [fromDate, toDate, fetchLogs]);

    const handleSort = useCallback((key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1);
    }, []);

    const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            handleFilter();
        }
    }, [handleFilter]);

    // Bulk operations
    const handleSelectLog = useCallback((logId: string) => {
        setSelectedLogs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(logId)) {
                newSet.delete(logId);
            } else {
                newSet.add(logId);
            }
            return newSet;
        });
    }, []);

    const handleSelectAll = useCallback(() => {
        if (selectAll) {
            setSelectedLogs(new Set());
        } else {
            setSelectedLogs(new Set(paginatedLogs.map(log => log.id)));
        }
        setSelectAll(!selectAll);
    }, [selectAll, paginatedLogs]);

    const handleBulkExport = useCallback(() => {
        const selectedLogsData = paginatedLogs.filter(log => selectedLogs.has(log.id));
        exportToCSV(selectedLogsData, deviceMappings);
    }, [selectedLogs, paginatedLogs, deviceMappings]);

    // Load initial data
    useEffect(() => {
        fetchLogs(fromDate, toDate);
    }, []);

    // Get unique AI models from logs
    const uniqueAiModels = useMemo(() => {
        return Array.from(new Set(logs.map(log => log.aiModel))).sort();
    }, [logs]);

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const getPageNumbers = () => {
            const pages = [];
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }

            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
            return pages;
        };

        return (
            <div className="mt-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                    <div className="text-sm text-gray-600">
                        Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-semibold">
                            {Math.min(currentPage * itemsPerPage, sortedLogs.length)}
                        </span>{' '}
                        of <span className="font-semibold">{sortedLogs.length}</span> results
                    </div>

                    <div className="flex items-center space-x-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors duration-200 flex items-center"
                        >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">Previous</span>
                        </button>

                        <div className="flex items-center space-x-1">
                            {getPageNumbers().map((pageNum) => (
                                <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                                        currentPage === pageNum
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {pageNum}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors duration-200 flex items-center"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-6 py-8">
            {/* Navbar */}
            <nav className="bg-gradient-to-r from-purple-600 to-purple-700 shadow-xl rounded-xl mb-8 overflow-hidden">
                <div className="px-6 py-4">
                    <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
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
                                        <p className="text-purple-100 text-xs">
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex items-center">
                            <div className="text-center">
                                <h1 className="text-2xl sm:text-3xl lg:text-4xl text-white font-extrabold">
                                    AI Chat Logs
                                </h1>
                                <p className="text-purple-100 text-sm mt-1">
                                    AI Conversation Analytics
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            <Link 
                                to="/" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                Search Logs
                            </Link>
                            <Link 
                                to="/ai-analytics" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200 flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                                <span>AI Analytics</span>
                            </Link>
                            <Link 
                                to="/devices" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                Devices
                            </Link>
                            <Link 
                                to="/worker-control" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200 flex items-center space-x-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span>Worker Control</span>
                            </Link>
                            <LogoutButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Filters */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                    </svg>
                    Search Filters
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Device ID</label>
                        <input
                            type="text"
                            value={deviceId}
                            onChange={(e) => setDeviceId(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Search device..."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">User Message</label>
                        <input
                            type="text"
                            value={userMessage}
                            onChange={(e) => setUserMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Search message..."
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">AI Model</label>
                        <select
                            value={aiModel}
                            onChange={(e) => setAiModel(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        >
                            <option value="">All Models</option>
                            {uniqueAiModels.map(model => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </div>
                </div>
                
                {/* Advanced Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Min Confidence</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={minConfidence}
                            onChange={(e) => setMinConfidence(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="0.0-1.0"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Max Confidence</label>
                        <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="1"
                            value={maxConfidence}
                            onChange={(e) => setMaxConfidence(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="0.0-1.0"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Min Time (ms)</label>
                        <input
                            type="number"
                            value={minProcessingTime}
                            onChange={(e) => setMinProcessingTime(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Min ms"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Max Time (ms)</label>
                        <input
                            type="number"
                            value={maxProcessingTime}
                            onChange={(e) => setMaxProcessingTime(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Max ms"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Min Tokens</label>
                        <input
                            type="number"
                            value={minTokens}
                            onChange={(e) => setMinTokens(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Min tokens"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Max Tokens</label>
                        <input
                            type="number"
                            value={maxTokens}
                            onChange={(e) => setMaxTokens(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                            placeholder="Max tokens"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Time Range</label>
                        <select
                            value={timeRange}
                            onChange={(e) => setTimeRange(e.target.value)}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        >
                            <option value="">All Time</option>
                            <option value="1h">Last Hour</option>
                            <option value="24h">Last 24 Hours</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="30d">Last 30 Days</option>
                        </select>
                    </div>
                </div>
                
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleFilter}
                        disabled={loading}
                        className="p-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 disabled:bg-gray-400 transition-colors duration-200"
                    >
                        {loading ? (
                            <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Loading...
                            </div>
                        ) : (
                            'Filter'
                        )}
                    </button>
                    <button
                        onClick={() => exportToCSV(sortedLogs, deviceMappings)}
                        disabled={loading || sortedLogs.length === 0}
                        className="p-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 focus:ring-2 focus:ring-green-400 disabled:bg-gray-400 transition-colors duration-200 flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export CSV
                    </button>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            {/* Loading Indicator */}
            {loading && (
                <div className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                    <p className="mt-4 text-gray-600 text-lg">Loading AI chat logs...</p>
                </div>
            )}

            {/* Results Summary */}
            {!loading && sortedLogs.length > 0 && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="text-purple-800">
                                <span className="font-semibold">{sortedLogs.length}</span> AI chat logs found
                                {filteredLogs.length !== logs.length && (
                                    <span className="text-purple-600 ml-2">
                                        (filtered from {logs.length} total)
                                    </span>
                                )}
                            </div>
                            
                            {selectedLogs.size > 0 && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm text-purple-700 font-medium">
                                        {selectedLogs.size} selected
                                    </span>
                                    <button
                                        onClick={handleBulkExport}
                                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-1"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>Export Selected</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 sm:mt-0">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    checked={selectAll}
                                    onChange={handleSelectAll}
                                    className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                />
                                <label className="text-sm text-gray-700 font-medium">Select All</label>
                            </div>
                            
                            <button
                                onClick={() => handleSort('date')}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    sortConfig.key === 'date' 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Sort by Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </button>
                            <button
                                onClick={() => handleSort('confidence')}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    sortConfig.key === 'confidence' 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Sort by Confidence {sortConfig.key === 'confidence' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </button>
                            <button
                                onClick={() => handleSort('processingTime')}
                                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                                    sortConfig.key === 'processingTime' 
                                        ? 'bg-purple-600 text-white' 
                                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                            >
                                Sort by Time {sortConfig.key === 'processingTime' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Logs Cards */}
            {!loading && (
                <>
                    <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
                        {paginatedLogs.map((log) => (
                            <div key={log.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100 relative">
                                <div className="absolute top-4 left-4 z-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedLogs.has(log.id)}
                                        onChange={() => handleSelectLog(log.id)}
                                        className="w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500 focus:ring-2"
                                    />
                                </div>
                                
                                {/* Card Header */}
                                <div className="p-6 border-b border-gray-100">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2 pl-6">
                                                {log.userMessage}
                                            </h3>
                                            <p className="text-sm text-gray-500">
                                                {formatDateTime(log.date)}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end space-y-1">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(log.confidence)}`}>
                                                {getConfidenceBadge(log.confidence)} ({log.confidence.toFixed(2)})
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center text-gray-600">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            {deviceMappings[log.deviceId] || log.deviceId}
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                {log.aiModel}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Content - AI Response Preview */}
                                <div className="p-6">
                                    <div className="mb-4">
                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">AI Response</h4>
                                        <div className="text-sm text-gray-700 line-clamp-4 bg-gray-50 p-3 rounded">
                                            {log.aiResponse}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                        <div className="bg-purple-50 p-2 rounded">
                                            <div className="text-purple-600 font-medium">Processing</div>
                                            <div className="text-gray-900 font-semibold">{log.processingTime}ms</div>
                                        </div>
                                        <div className="bg-green-50 p-2 rounded">
                                            <div className="text-green-600 font-medium">Tokens</div>
                                            <div className="text-gray-900 font-semibold">{log.tokensUsed}</div>
                                        </div>
                                        <div className="bg-blue-50 p-2 rounded">
                                            <div className="text-blue-600 font-medium">Sources</div>
                                            <div className="text-gray-900 font-semibold">{log.sourcesCount || 0}</div>
                                        </div>
                                    </div>

                                    {/* Related Questions Preview */}
                                    {log.relatedQuestions && log.relatedQuestions.length > 0 && (
                                        <div className="mt-4">
                                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Related Questions</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {log.relatedQuestions.slice(0, 2).map((question, idx) => (
                                                    <span key={idx} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded line-clamp-1">
                                                        {question}
                                                    </span>
                                                ))}
                                                {log.relatedQuestions.length > 2 && (
                                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                                                        +{log.relatedQuestions.length - 2} more
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer */}
                                <div className="px-6 py-3 bg-gray-50 rounded-b-xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3 text-xs text-gray-500">
                                            {log.conversationId && (
                                                <span className="flex items-center">
                                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                    </svg>
                                                    Msg {log.messageNumber}/{log.conversationLength}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setExpandedCard(expandedCard === log.id ? null : log.id)}
                                            className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full hover:bg-purple-200 transition-colors duration-200 flex items-center space-x-1"
                                        >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <span>{expandedCard === log.id ? 'Hide Details' : 'View Details'}</span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Expanded Details Section */}
                                {expandedCard === log.id && (
                                    <div className="border-t border-gray-200 bg-gray-50 p-6">
                                        <h4 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                                            <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Complete Details
                                        </h4>
                                        
                                        {/* Full AI Response */}
                                        <div className="mb-6">
                                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Full AI Response</h5>
                                            <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap">
                                                {log.aiResponse}
                                            </div>
                                        </div>

                                        {/* Sources */}
                                        {log.sources && log.sources.length > 0 && (
                                            <div className="mb-6">
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Sources ({log.sources.length})</h5>
                                                <div className="space-y-3">
                                                    {log.sources.map((source, index) => (
                                                        <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                                                            <div className="flex items-start space-x-3">
                                                                <div className="flex-shrink-0">
                                                                    <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                                                                        <span className="text-purple-600 font-semibold text-xs">
                                                                            [{source.citationNumber}]
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <a 
                                                                        href={source.url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer" 
                                                                        className="text-blue-600 hover:text-blue-800 font-medium text-sm block mb-1"
                                                                    >
                                                                        {source.title}
                                                                    </a>
                                                                    <p className="text-gray-700 text-xs mb-2">
                                                                        {source.snippet}
                                                                    </p>
                                                                    <div className="flex items-center text-xs text-gray-500">
                                                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                                                        </svg>
                                                                        {source.domain}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Related Questions */}
                                        {log.relatedQuestions && log.relatedQuestions.length > 0 && (
                                            <div className="mb-6">
                                                <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">Related Questions</h5>
                                                <div className="space-y-2">
                                                    {log.relatedQuestions.map((question, idx) => (
                                                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-700">
                                                            {question}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Additional metadata */}
                                        <div className="mt-6 pt-4 border-t border-gray-200">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                                                <div>
                                                    <span className="font-medium">Chat ID:</span> {log.id}
                                                </div>
                                                <div>
                                                    <span className="font-medium">Timestamp:</span> {log.timestamp}
                                                </div>
                                                {log.conversationId && (
                                                    <div>
                                                        <span className="font-medium">Conversation ID:</span> {log.conversationId}
                                                    </div>
                                                )}
                                                {log.wasRegenerated !== undefined && (
                                                    <div>
                                                        <span className="font-medium">Regenerated:</span> {log.wasRegenerated ? 'Yes' : 'No'}
                                                    </div>
                                                )}
                                                <div className="sm:col-span-2">
                                                    <span className="font-medium">User Agent:</span>
                                                    <p className="mt-1 p-2 bg-gray-100 rounded text-xs font-mono break-all">
                                                        {log.userAgent}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {renderPagination()}
                </>
            )}

            {/* No Results Message */}
            {!loading && sortedLogs.length === 0 && (
                <div className="text-center py-16">
                    <div className="max-w-md mx-auto">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No AI chat logs found</h3>
                        <p className="text-gray-600 mb-6">
                            No logs match your current search criteria. Try adjusting your filters or date range.
                        </p>
                        <button
                            onClick={() => {
                                setDeviceId('');
                                setUserMessage('');
                                setAiModel('');
                                setMinConfidence('');
                                setMaxConfidence('');
                                setMinProcessingTime('');
                                setMaxProcessingTime('');
                                setMinTokens('');
                                setMaxTokens('');
                                setTimeRange('');
                                setFromDate(formatDateForInput(toJST(new Date())));
                                setToDate(formatDateForInput(toJST(new Date())));
                            }}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 font-medium"
                        >
                            Clear All Filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIChatLogsTable;

