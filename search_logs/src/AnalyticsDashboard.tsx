import React, { useEffect, useState, useContext, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { SearchLog } from './types';
import LogoutButton from './Logout.tsx';
import { AuthContext } from './AuthProvider';
import { Link } from 'react-router-dom';

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

const AnalyticsDashboard: React.FC = () => {
    const [logs, setLogs] = useState<SearchLog[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));
    
    const { user } = useContext(AuthContext);

    // Load device mappings
    useEffect(() => {
        const loadDeviceMappings = async () => {
            try {
                const deviceRegistryRef = ref(databaseLog, 'deviceRegistry');
                const snapshot = await get(deviceRegistryRef);
                if (snapshot.exists()) {
                    const deviceRegistry = snapshot.val();
                    // Convert deviceRegistry to deviceMappings format
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

    // Fetch logs data
    const fetchLogs = async (fromDateStr: string, toDateStr: string) => {
        setLoading(true);
        setError(null);
        
        try {
            const fromDateTime = toJST(new Date(fromDateStr));
            const toDateTime = toJST(new Date(toDateStr));
            fromDateTime.setHours(0, 0, 0, 0);
            toDateTime.setHours(23, 59, 59, 999);

            const formattedData: SearchLog[] = [];
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
            formattedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setLogs(formattedData);
            
        } catch (err) {
            setError('Failed to fetch logs. Please try again.');
            console.error('Error fetching logs:', err);
        } finally {
            setLoading(false);
        }
    };

    // Load initial data
    useEffect(() => {
        fetchLogs(fromDate, toDate);
    }, []);

    // Analytics calculations
    const analytics = useMemo(() => {
        if (logs.length === 0) return null;

        // Search type distribution
        const searchTypeCounts = logs.reduce((acc, log) => {
            acc[log.searchType] = (acc[log.searchType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Device usage
        const deviceCounts = logs.reduce((acc, log) => {
            const deviceName = deviceMappings[log.deviceId] || log.deviceId;
            acc[deviceName] = (acc[deviceName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Daily search trends
        const dailyTrends = logs.reduce((acc, log) => {
            const date = new Date(log.date).toISOString().split('T')[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Hourly distribution
        const hourlyDistribution = logs.reduce((acc, log) => {
            const hour = new Date(log.date).getHours();
            acc[hour] = (acc[hour] || 0) + 1;
            return acc;
        }, {} as Record<number, number>);

        // Top queries
        const queryCounts = logs.reduce((acc, log) => {
            const query = log.query.toLowerCase().trim();
            acc[query] = (acc[query] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topQueries = Object.entries(queryCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        // Average results per search
        const avgResults = logs.reduce((sum, log) => sum + (log.results?.length || 0), 0) / logs.length;

        return {
            totalSearches: logs.length,
            searchTypeCounts,
            deviceCounts,
            dailyTrends,
            hourlyDistribution,
            topQueries,
            avgResults: Math.round(avgResults * 10) / 10
        };
    }, [logs, deviceMappings]);

    const handleDateChange = () => {
        fetchLogs(fromDate, toDate);
    };

    // Simple chart components
    const BarChart: React.FC<{ data: Record<string, number>; title: string; color?: string }> = ({ data, title, color = 'blue' }) => {
        const maxValue = Math.max(...Object.values(data));
        const entries = Object.entries(data).sort(([,a], [,b]) => b - a);

        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
                <div className="space-y-3">
                    {entries.slice(0, 8).map(([key, value]) => (
                        <div key={key} className="flex items-center">
                            <div className="w-24 text-sm text-gray-600 truncate mr-3" title={key}>
                                {key}
                            </div>
                            <div className="flex-1 bg-gray-200 rounded-full h-4 mr-3">
                                <div 
                                    className={`h-4 rounded-full bg-${color}-500`}
                                    style={{ width: `${(value / maxValue) * 100}%` }}
                                ></div>
                            </div>
                            <div className="w-12 text-sm font-medium text-gray-900 text-right">
                                {value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const LineChart: React.FC<{ data: Record<string, number>; title: string }> = ({ data, title }) => {
        const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
        const maxValue = Math.max(...Object.values(data));

        return (
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
                <div className="h-64 flex items-end space-x-1">
                    {entries.map(([date, value]) => (
                        <div key={date} className="flex-1 flex flex-col items-center">
                            <div 
                                className="w-full bg-blue-500 rounded-t"
                                style={{ height: `${(value / maxValue) * 200}px` }}
                                title={`${date}: ${value} searches`}
                            ></div>
                            <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-top-left">
                                {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const MetricCard: React.FC<{ title: string; value: string | number; subtitle?: string; icon?: React.ReactNode }> = ({ title, value, subtitle, icon }) => (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <p className="text-3xl font-bold text-gray-900">{value}</p>
                    {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
                </div>
                {icon && (
                    <div className="p-3 bg-blue-100 rounded-full">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );

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
                                    Analytics Dashboard
                                </h1>
                                <p className="text-blue-100 text-sm mt-1">
                                    Search Analytics & Insights
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
                            <LogoutButton />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Date Range Filter */}
            <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Date Range
                </h2>
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleDateChange}
                            disabled={loading}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 disabled:bg-gray-400 transition-colors duration-200"
                        >
                            {loading ? 'Loading...' : 'Update Analytics'}
                        </button>
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
                    <p className="mt-4 text-gray-600 text-lg">Loading analytics...</p>
                </div>
            )}

            {/* Analytics Content */}
            {!loading && analytics && (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <MetricCard
                            title="Total Searches"
                            value={analytics.totalSearches}
                            subtitle="in selected period"
                            icon={
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Avg Results per Search"
                            value={analytics.avgResults}
                            subtitle="search result quality"
                            icon={
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Active Devices"
                            value={Object.keys(analytics.deviceCounts).length}
                            subtitle="unique devices"
                            icon={
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Search Types"
                            value={Object.keys(analytics.searchTypeCounts).length}
                            subtitle="different types"
                            icon={
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            }
                        />
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <BarChart 
                            data={analytics.searchTypeCounts} 
                            title="Search Type Distribution" 
                            color="blue"
                        />
                        <BarChart 
                            data={analytics.deviceCounts} 
                            title="Device Usage" 
                            color="green"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <LineChart 
                            data={analytics.dailyTrends} 
                            title="Daily Search Trends"
                        />
                        <BarChart 
                            data={analytics.hourlyDistribution} 
                            title="Hourly Distribution" 
                            color="purple"
                        />
                    </div>

                    {/* Top Queries */}
                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Search Queries</h3>
                        <div className="space-y-3">
                            {analytics.topQueries.map(([query, count], index) => (
                                <div key={query} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                            <span className="text-blue-600 font-semibold text-sm">{index + 1}</span>
                                        </div>
                                        <span className="font-medium text-gray-900">{query}</span>
                                    </div>
                                    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                                        {count} searches
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* No Data Message */}
            {!loading && (!analytics || analytics.totalSearches === 0) && (
                <div className="text-center py-16">
                    <div className="max-w-md mx-auto">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Analytics Data</h3>
                        <p className="text-gray-600 mb-6">
                            No search logs found for the selected date range. Try adjusting your date range or check back later.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalyticsDashboard;

