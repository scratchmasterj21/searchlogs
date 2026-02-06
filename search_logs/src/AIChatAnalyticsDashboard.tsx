import React, { useEffect, useState, useContext, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { AIChatLog } from './types';
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

const AIChatAnalyticsDashboard: React.FC = () => {
    const [logs, setLogs] = useState<AIChatLog[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fromDate, setFromDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [selectedDevice, setSelectedDevice] = useState<string>('');
    const [showPerDevice, setShowPerDevice] = useState(false);
    const [showDeviceModal, setShowDeviceModal] = useState(false);
    
    const { user } = useContext(AuthContext);

    // Load device mappings
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

    // Fetch logs data
    const fetchLogs = async (fromDateStr: string, toDateStr: string) => {
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

        // AI Model distribution
        const aiModelCounts = logs.reduce((acc, log) => {
            acc[log.aiModel] = (acc[log.aiModel] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Device usage
        const deviceCounts = logs.reduce((acc, log) => {
            const deviceName = deviceMappings[log.deviceId] || log.deviceId;
            acc[deviceName] = (acc[deviceName] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Daily chat trends
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
            const query = log.userMessage.toLowerCase().trim();
            acc[query] = (acc[query] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const topQueries = Object.entries(queryCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10);

        // Average metrics
        const avgConfidence = logs.reduce((sum, log) => sum + log.confidence, 0) / logs.length;
        const avgProcessingTime = logs.reduce((sum, log) => sum + log.processingTime, 0) / logs.length;
        const avgTokensUsed = logs.reduce((sum, log) => sum + log.tokensUsed, 0) / logs.length;

        // Confidence distribution
        const confidenceDistribution = logs.reduce((acc, log) => {
            const range = log.confidence >= 0.7 ? 'High (0.7-1.0)' : 
                         log.confidence >= 0.4 ? 'Medium (0.4-0.7)' : 
                         'Low (0-0.4)';
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Processing time distribution (in ranges)
        const processingTimeRanges = logs.reduce((acc, log) => {
            const time = log.processingTime;
            const range = time < 1000 ? '<1s' :
                         time < 2000 ? '1-2s' :
                         time < 3000 ? '2-3s' :
                         time < 5000 ? '3-5s' : '>5s';
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Token usage distribution
        const tokenRanges = logs.reduce((acc, log) => {
            const tokens = log.tokensUsed;
            const range = tokens < 200 ? '<200' :
                         tokens < 500 ? '200-500' :
                         tokens < 1000 ? '500-1000' :
                         tokens < 2000 ? '1000-2000' : '>2000';
            acc[range] = (acc[range] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // Per-device analytics
        const perDeviceAnalytics = Object.keys(deviceCounts).map(deviceName => {
            const deviceLogs = logs.filter(log => (deviceMappings[log.deviceId] || log.deviceId) === deviceName);
            
            const deviceAiModels = deviceLogs.reduce((acc, log) => {
                acc[log.aiModel] = (acc[log.aiModel] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const deviceDailyTrends = deviceLogs.reduce((acc, log) => {
                const date = new Date(log.date).toISOString().split('T')[0];
                acc[date] = (acc[date] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const deviceHourlyDistribution = deviceLogs.reduce((acc, log) => {
                const hour = new Date(log.date).getHours();
                acc[hour] = (acc[hour] || 0) + 1;
                return acc;
            }, {} as Record<number, number>);

            const deviceQueries = deviceLogs.reduce((acc, log) => {
                const query = log.userMessage.toLowerCase().trim();
                acc[query] = (acc[query] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            const deviceTopQueries = Object.entries(deviceQueries)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5);

            const deviceAvgConfidence = deviceLogs.reduce((sum, log) => sum + log.confidence, 0) / deviceLogs.length;
            const deviceAvgProcessingTime = deviceLogs.reduce((sum, log) => sum + log.processingTime, 0) / deviceLogs.length;
            const deviceAvgTokens = deviceLogs.reduce((sum, log) => sum + log.tokensUsed, 0) / deviceLogs.length;

            const deviceId = Object.keys(deviceMappings).find(id => deviceMappings[id] === deviceName) || deviceName;

            return {
                deviceId,
                deviceName,
                totalChats: deviceLogs.length,
                aiModelCounts: deviceAiModels,
                dailyTrends: deviceDailyTrends,
                hourlyDistribution: deviceHourlyDistribution,
                topQueries: deviceTopQueries,
                avgConfidence: Math.round(deviceAvgConfidence * 100) / 100,
                avgProcessingTime: Math.round(deviceAvgProcessingTime),
                avgTokens: Math.round(deviceAvgTokens),
                firstChat: deviceLogs.length > 0 ? Math.min(...deviceLogs.map(log => new Date(log.date).getTime())) : 0,
                lastChat: deviceLogs.length > 0 ? Math.max(...deviceLogs.map(log => new Date(log.date).getTime())) : 0
            };
        }).sort((a, b) => b.totalChats - a.totalChats);

        return {
            totalChats: logs.length,
            aiModelCounts,
            deviceCounts,
            dailyTrends,
            hourlyDistribution,
            topQueries,
            avgConfidence: Math.round(avgConfidence * 100) / 100,
            avgProcessingTime: Math.round(avgProcessingTime),
            avgTokensUsed: Math.round(avgTokensUsed),
            confidenceDistribution,
            processingTimeRanges,
            tokenRanges,
            perDeviceAnalytics
        };
    }, [logs, deviceMappings]);

    const handleDateChange = () => {
        fetchLogs(fromDate, toDate);
    };

    const handleViewDeviceDetails = (deviceId: string) => {
        setSelectedDevice(deviceId);
        setShowDeviceModal(true);
    };

    const handleCloseModal = () => {
        setShowDeviceModal(false);
        setSelectedDevice('');
    };

    // Chart components
    const BarChart: React.FC<{ data: Record<string, number>; title: string; color?: string }> = ({ data, title, color = 'purple' }) => {
        const maxValue = Math.max(...Object.values(data));
        const entries = Object.entries(data).sort(([,a], [,b]) => b - a);

        const colorMap: Record<string, string> = {
            purple: 'bg-purple-500',
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            orange: 'bg-orange-500',
            red: 'bg-red-500'
        };

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
                                    className={`h-4 rounded-full ${colorMap[color] || colorMap.purple}`}
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
                                className="w-full bg-purple-500 rounded-t"
                                style={{ height: `${(value / maxValue) * 200}px` }}
                                title={`${date}: ${value} chats`}
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
                    <div className="p-3 bg-purple-100 rounded-full">
                        {icon}
                    </div>
                )}
            </div>
        </div>
    );

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
                                    AI Chat Analytics
                                </h1>
                                <p className="text-purple-100 text-sm mt-1">
                                    AI Conversation Insights & Metrics
                                </p>
                            </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                            <Link 
                                to="/ai-chats" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                AI Chat Logs
                            </Link>
                            <Link 
                                to="/" 
                                className="px-4 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-colors duration-200"
                            >
                                Search Logs
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

            {/* Date Range Filter */}
            <div className="mb-8 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent transition-colors"
                        />
                    </div>
                    <div className="flex items-end space-x-4">
                        <button
                            onClick={handleDateChange}
                            disabled={loading}
                            className="px-6 py-3 bg-purple-600 text-white rounded-lg shadow-md hover:bg-purple-700 focus:ring-2 focus:ring-purple-400 disabled:bg-gray-400 transition-colors duration-200"
                        >
                            {loading ? 'Loading...' : 'Update Analytics'}
                        </button>
                        <button
                            onClick={() => setShowPerDevice(!showPerDevice)}
                            className={`px-6 py-3 rounded-lg shadow-md transition-colors duration-200 ${
                                showPerDevice 
                                    ? 'bg-green-600 text-white hover:bg-green-700' 
                                    : 'bg-gray-600 text-white hover:bg-gray-700'
                            }`}
                        >
                            {showPerDevice ? 'Hide Per-Device' : 'Show Per-Device'}
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
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-200 border-t-purple-600"></div>
                    <p className="mt-4 text-gray-600 text-lg">Loading analytics...</p>
                </div>
            )}

            {/* Analytics Content */}
            {!loading && analytics && (
                <>
                    {/* Key Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <MetricCard
                            title="Total AI Chats"
                            value={analytics.totalChats}
                            subtitle="in selected period"
                            icon={
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Avg Confidence"
                            value={analytics.avgConfidence}
                            subtitle="response confidence"
                            icon={
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Avg Processing Time"
                            value={`${analytics.avgProcessingTime}ms`}
                            subtitle="response time"
                            icon={
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            }
                        />
                        <MetricCard
                            title="Avg Tokens Used"
                            value={analytics.avgTokensUsed}
                            subtitle="per conversation"
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
                            data={analytics.aiModelCounts} 
                            title="AI Model Distribution" 
                            color="purple"
                        />
                        <BarChart 
                            data={analytics.deviceCounts} 
                            title="Device Usage" 
                            color="blue"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <BarChart 
                            data={analytics.confidenceDistribution} 
                            title="Confidence Distribution" 
                            color="green"
                        />
                        <BarChart 
                            data={analytics.processingTimeRanges} 
                            title="Processing Time Distribution" 
                            color="blue"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <LineChart 
                            data={analytics.dailyTrends} 
                            title="Daily Chat Trends"
                        />
                        <BarChart 
                            data={analytics.hourlyDistribution} 
                            title="Hourly Distribution" 
                            color="orange"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                        <BarChart 
                            data={analytics.tokenRanges} 
                            title="Token Usage Distribution" 
                            color="red"
                        />
                        {/* Top Queries */}
                        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top User Queries</h3>
                            <div className="space-y-3">
                                {analytics.topQueries.slice(0, 8).map(([query, count], index) => (
                                    <div key={query} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center flex-1 min-w-0 mr-3">
                                            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                                <span className="text-purple-600 font-semibold text-xs">{index + 1}</span>
                                            </div>
                                            <span className="font-medium text-gray-900 text-sm truncate" title={query}>{query}</span>
                                        </div>
                                        <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded-full flex-shrink-0">
                                            {count}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Per-Device Analytics */}
                    {showPerDevice && (
                        <div className="mt-8">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Per-Device AI Chat Analytics</h2>
                                <p className="text-gray-600">Detailed AI chat analytics for each individual device</p>
                            </div>

                            {/* Device Overview Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                                {analytics.perDeviceAnalytics.map((device) => (
                                    <div key={device.deviceId} className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-gray-900 truncate" title={device.deviceName}>
                                                {device.deviceName}
                                            </h3>
                                            <button
                                                onClick={() => handleViewDeviceDetails(device.deviceId)}
                                                className="px-3 py-1 rounded-full text-xs font-medium transition-colors bg-purple-100 text-purple-700 hover:bg-purple-200"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Total Chats:</span>
                                                <span className="font-semibold text-gray-900">{device.totalChats}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Avg Confidence:</span>
                                                <span className="font-semibold text-gray-900">{device.avgConfidence}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Avg Time (ms):</span>
                                                <span className="font-semibold text-gray-900">{device.avgProcessingTime}</span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-600">Avg Tokens:</span>
                                                <span className="font-semibold text-gray-900">{device.avgTokens}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* No Data Message */}
            {!loading && (!analytics || analytics.totalChats === 0) && (
                <div className="text-center py-16">
                    <div className="max-w-md mx-auto">
                        <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No AI Chat Data</h3>
                        <p className="text-gray-600 mb-6">
                            No AI chat logs found for the selected date range. Try adjusting your date range or check back later.
                        </p>
                    </div>
                </div>
            )}

            {/* Device Details Modal */}
            {showDeviceModal && selectedDevice && (() => {
                const device = analytics?.perDeviceAnalytics.find(d => d.deviceId === selectedDevice);
                if (!device) return null;

                return (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                        <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-900">{device.deviceName}</h2>
                                        <p className="text-gray-600">Detailed AI Chat Analytics</p>
                                    </div>
                                    <button
                                        onClick={handleCloseModal}
                                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    >
                                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <MetricCard
                                        title="Total Chats"
                                        value={device.totalChats}
                                        subtitle="in selected period"
                                        icon={
                                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                            </svg>
                                        }
                                    />
                                    <MetricCard
                                        title="Avg Confidence"
                                        value={device.avgConfidence}
                                        subtitle="response confidence"
                                        icon={
                                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        }
                                    />
                                    <MetricCard
                                        title="Avg Time"
                                        value={`${device.avgProcessingTime}ms`}
                                        subtitle="processing time"
                                        icon={
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        }
                                    />
                                    <MetricCard
                                        title="Avg Tokens"
                                        value={device.avgTokens}
                                        subtitle="tokens per chat"
                                        icon={
                                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                        }
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <BarChart 
                                        data={device.aiModelCounts} 
                                        title={`${device.deviceName} - AI Models Used`} 
                                        color="purple"
                                    />
                                    <BarChart 
                                        data={device.hourlyDistribution} 
                                        title={`${device.deviceName} - Hourly Usage`} 
                                        color="blue"
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <LineChart 
                                        data={device.dailyTrends} 
                                        title={`${device.deviceName} - Daily Trends`}
                                    />
                                    <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Queries</h3>
                                        <div className="space-y-3">
                                            {device.topQueries.map(([query, count], index) => (
                                                <div key={query} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                    <div className="flex items-center flex-1 min-w-0 mr-3">
                                                        <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                                                            <span className="text-purple-600 font-semibold text-xs">{index + 1}</span>
                                                        </div>
                                                        <span className="font-medium text-gray-900 text-sm truncate" title={query}>{query}</span>
                                                    </div>
                                                    <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded-full flex-shrink-0">
                                                        {count}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl">
                                <div className="flex justify-end">
                                    <button
                                        onClick={handleCloseModal}
                                        className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default AIChatAnalyticsDashboard;

