import React, { useEffect, useState, useContext, useCallback, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { SearchLog } from './types';
import LogoutButton from './Logout.tsx';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

type SortKey = keyof Pick<SearchLog, 'date' | 'deviceId' | 'query'>;

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

const SearchLogsTable: React.FC = () => {
    const [logs, setLogs] = useState<SearchLog[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Filter states
    const [fromDate, setFromDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [deviceId, setDeviceId] = useState('');
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState('');
    
    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(50);
    
    const { user } = useContext(AuthContext);
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ 
        key: 'date', 
        direction: 'desc' 
    });

    // Load device mappings once
    useEffect(() => {
        const loadDeviceMappings = async () => {
            try {
                const deviceMappingsRef = ref(databaseLog, 'deviceid');
                const snapshot = await get(deviceMappingsRef);
                if (snapshot.exists()) {
                    setDeviceMappings(snapshot.val());
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

            const formattedData: SearchLog[] = [];
            
            // Generate date range to fetch
            const currentDate = new Date(fromDateTime);
            const promises: Promise<any>[] = [];
            
            while (currentDate <= toDateTime) {
                const year = currentDate.getFullYear();
                const month = String(currentDate.getMonth() + 1).padStart(2, '0');
                const day = String(currentDate.getDate()).padStart(2, '0');
                
                const dayRef = ref(databaseLog, `searchLogs/${year}/${month}/${day}`);
                promises.push(
                    get(dayRef).then(snapshot => {
                        if (snapshot.exists()) {
                            const dayData = snapshot.val();
                            Object.keys(dayData).forEach(logId => {
                                const logEntry = dayData[logId];
                                const dateTime = new Date(`${year}-${month}-${day}T${logEntry.time || '00:00:00'}`);
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
            
            // Sort by latest date and time
            formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLogs(formattedData);
            
        } catch (err) {
            setError('Failed to fetch logs. Please try again.');
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Client-side filtering with memoization
    const filteredLogs = useMemo(() => {
        let filtered = logs;

        if (deviceId) {
            const deviceIdLower = deviceId.toLowerCase();
            filtered = filtered.filter(log => 
                (deviceMappings[log.deviceId] || log.deviceId).toLowerCase().includes(deviceIdLower)
            );
        }

        if (query) {
            const queryLower = query.toLowerCase();
            filtered = filtered.filter(log => 
                log.query.toLowerCase().includes(queryLower)
            );
        }

        if (searchType) {
            filtered = filtered.filter(log => log.searchType === searchType);
        }

        return filtered;
    }, [logs, deviceId, query, searchType, deviceMappings]);

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
        setCurrentPage(1); // Reset to first page when filtering
        fetchLogs(fromDate, toDate);
    }, [fromDate, toDate, fetchLogs]);

    const handleSort = useCallback((key: SortKey) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
        setCurrentPage(1); // Reset to first page when sorting
    }, []);

    const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            handleFilter();
        }
    }, [handleFilter]);

    // Load initial data
    useEffect(() => {
        fetchLogs(fromDate, toDate);
    }, []); // Only run once on mount

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        return (
            <div className="flex justify-center items-center mt-6 space-x-2">
                <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                >
                    Previous
                </button>
                
                <span className="px-4 py-2">
                    Page {currentPage} of {totalPages} ({sortedLogs.length} total results)
                </span>
                
                <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
                >
                    Next
                </button>
            </div>
        );
    };

    return (
        <div className="container mx-auto px-6 py-8">
            {/* Navbar */}
            <nav className="flex flex-col md:flex-row items-center justify-between p-4 bg-blue-600 shadow-lg rounded-lg mb-6">
                <div className="flex items-center mb-2 md:mb-0">
                    {user && (
                        <span className="text-white font-semibold underline">
                            User: {user.displayName || 'User'}
                        </span>
                    )}
                </div>
                <div className="flex items-center mb-2 md:mb-0">
                    <h1 className="text-2xl md:text-3xl text-white font-extrabold text-center">Search Logs</h1>
                </div>
                <div className="flex items-center">
                    <LogoutButton />
                </div>
            </nav>

            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-3">
                <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="From Date"
                />
                <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="To Date"
                />
                <input
                    type="text"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Device ID (Value)"
                />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Query"
                />
                <select
                    value={searchType}
                    onChange={(e) => setSearchType(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                    <option value="">All</option>
                    <option value="web">Web</option>
                    <option value="images">Images</option>
                </select>
                <button
                    onClick={handleFilter}
                    disabled={loading}
                    className="p-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-400"
                >
                    {loading ? 'Loading...' : 'Filter'}
                </button>
                <Link to="/config" className="text-blue-600 underline hover:text-blue-800">Search Settings</Link>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    {error}
                </div>
            )}

            {/* Loading Indicator */}
            {loading && (
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading logs...</p>
                </div>
            )}

            {/* Logs Table */}
            {!loading && (
                <>
                    <div className="overflow-x-auto">
                        <table className="min-w-full bg-white shadow-lg rounded-lg">
                            <thead>
                                <tr>
                                    <th 
                                        className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                                        onClick={() => handleSort('date')}
                                    >
                                        Date {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th 
                                        className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                                        onClick={() => handleSort('deviceId')}
                                    >
                                        Device ID {sortConfig.key === 'deviceId' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th 
                                        className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100" 
                                        onClick={() => handleSort('query')}
                                    >
                                        Query {sortConfig.key === 'query' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Search Type</th>
                                    <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">User Agent</th>
                                    <th className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">Results</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-100">
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">{formatDateTime(log.date)}</td>
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">{deviceMappings[log.deviceId] || log.deviceId}</td>
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">{log.query}</td>
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">{log.searchType}</td>
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">{log.userAgent}</td>
                                        <td className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">
                                            <div className={log.searchType === 'web' ? 'max-h-48 overflow-y-auto' : 'flex flex-wrap gap-3'}>
                                                {log.results?.map((result, index) => (
                                                    <div key={index} className="mb-2">
                                                        {log.searchType === 'images' ? (
                                                            <a href={result.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                                                <img src={result.contentUrl} alt={result.name} className="max-w-xs max-h-24 rounded shadow-md hover:opacity-80" />
                                                            </a>
                                                        ) : (
                                                            <div>
                                                                <a href={result.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-700">
                                                                    {result.name}
                                                                </a>
                                                                <p className="text-gray-600">{result.snippet}</p>
                                                                <p className="text-sm text-gray-500">{result.displayUrl}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )) ?? <p>No results found</p>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {renderPagination()}
                </>
            )}

            {/* No Results Message */}
            {!loading && sortedLogs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                    No logs found for the selected criteria.
                </div>
            )}
        </div>
    );
};

export default SearchLogsTable;