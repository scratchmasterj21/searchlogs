import React, { useEffect, useState, useContext } from 'react';
import { ref, onValue } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { SearchLog } from './types';
import LogoutButton from './Logout.tsx';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

type SortKey = keyof Pick<SearchLog, 'date' | 'deviceId' | 'query'>;

const SearchLogsTable: React.FC = () => {
    const [logs, setLogs] = useState<SearchLog[]>([]);
    const [filteredLogs, setFilteredLogs] = useState<SearchLog[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [deviceId, setDeviceId] = useState('');
    const [query, setQuery] = useState('');
    const [searchType, setSearchType] = useState('');
    const { user } = useContext(AuthContext);

    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'date', direction: 'asc' });

    useEffect(() => {
        const fetchLogs = () => {
            const logsRef = ref(databaseLog, 'searchLogs');
            const deviceMappingsRef = ref(databaseLog, 'deviceid');
            function toJST(date: Date): Date {
                const jstOffset = 9 * 60; // JST is UTC+9
                const utcDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000));
                return new Date(utcDate.getTime() + (jstOffset * 60000));
            }
            // Add date filtering when fetching logs
            const fromDateTime = fromDate ? toJST(new Date(fromDate)) : toJST(new Date()); // Default to today in JST
            const toDateTime = toDate ? toJST(new Date(toDate)) : toJST(new Date()); // Default to tomorrow in JST

            fromDateTime.setHours(0, 0, 0, 0); // Set to start of the day
            toDateTime.setHours(23, 59, 59, 999); // Set to end of the day
            setFromDate(formatDateForInput(fromDateTime));
            setToDate(formatDateForInput(toDateTime));
            
            onValue(logsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const formattedData: SearchLog[] = [];
    
                    Object.keys(data).forEach(year => {
                        Object.keys(data[year]).forEach(month => {
                            Object.keys(data[year][month]).forEach(day => {
                                const logDate = new Date(`${year}-${month}-${day}`);
                                if (logDate >= fromDateTime && logDate <= toDateTime) {
                                    Object.keys(data[year][month][day]).forEach(logId => {
                                        const logEntry = data[year][month][day][logId];
                                        const dateTime = new Date(`${year}-${month}-${day}T${logEntry.time || '00:00:00'}`);
                                        formattedData.push({
                                            id: logId,
                                            date: dateTime.toISOString(),
                                            ...logEntry
                                        });
                                    });
                                }
                            });
                        });
                    });
    
                    // Sort by latest date and time
                    formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setLogs(formattedData);
                    setFilteredLogs(formattedData);
                }
            });
    
            onValue(deviceMappingsRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    setDeviceMappings(data);
                }
            });
        };
    
        fetchLogs();
    }, [fromDate, toDate]);
    
    const formatDateForInput = (date: Date): string => {
        // Ensure it's in JST, and then format the date as yyyy-mm-dd
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
    const handleFilter = () => {
        let filtered = logs;

        if (fromDate) {
            const fromDateTime = new Date(fromDate);
            fromDateTime.setHours(0, 0, 0, 0); // Set to start of the day
            filtered = filtered.filter(log => new Date(log.date) >= fromDateTime);
        }

        if (toDate) {
            const toDateTime = new Date(toDate);
            toDateTime.setHours(23, 59, 59, 999); // Set to end of the day
            filtered = filtered.filter(log => new Date(log.date) <= toDateTime);
        }

        if (deviceId) {
            filtered = filtered.filter(log => (deviceMappings[log.deviceId] || log.deviceId).includes(deviceId));
        }

        if (query) {
            filtered = filtered.filter(log => log.query.includes(query));
        }

        if (searchType) {
            filtered = filtered.filter(log => log.searchType === searchType);
        }

        setFilteredLogs(filtered);
    };

    const handleSort = (key: SortKey) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }

        const sortedLogs = [...filteredLogs].sort((a, b) => {
            if (key === 'deviceId') {
                const deviceA = deviceMappings[a.deviceId] || a.deviceId;
                const deviceB = deviceMappings[b.deviceId] || b.deviceId;
                if (deviceA < deviceB) {
                    return direction === 'asc' ? -1 : 1;
                }
                if (deviceA > deviceB) {
                    return direction === 'asc' ? 1 : -1;
                }
                return 0;
            } else if (key === 'date') {
                if (new Date(a.date) < new Date(b.date)) {
                    return direction === 'asc' ? -1 : 1;
                }
                if (new Date(a.date) > new Date(b.date)) {
                    return direction === 'asc' ? 1 : -1;
                }
                return 0;
            } else {
                if (a[key] < b[key]) {
                    return direction === 'asc' ? -1 : 1;
                }
                if (a[key] > b[key]) {
                    return direction === 'asc' ? 1 : -1;
                }
                return 0;
            }
        });

        setSortConfig({ key, direction });
        setFilteredLogs(sortedLogs);
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            handleFilter();
        }
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
                className="p-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-400"
            >
                Filter
            </button>
            <Link to="/config" className="text-blue-600 underline hover:text-blue-800">Search Settings</Link>
        </div>
    
        {/* Logs Table */}
        <div className="overflow-x-auto">
            <table className="min-w-full bg-white shadow-lg rounded-lg">
                <thead>
                    <tr>
                        <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                        <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('deviceId')}>Device ID</th>
                        <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('query')}>Query</th>
                        <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">Search Type</th>
                        <th className="px-4 py-3 border-b-2 border-gray-200 bg-gray-50 text-left text-sm font-medium text-gray-600 uppercase tracking-wider">User Agent</th>
                        <th className="px-4 py-4 whitespace-no-wrap border-b border-gray-200">Results</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredLogs.map((log) => (
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
    </div>
    
    );
};

export default SearchLogsTable;
