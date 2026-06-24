import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { FlaggedSearch, FlaggedReason } from './types';
import NavBar from './components/NavBar';
import LoadingSkeleton from './components/LoadingSkeleton';
import { Link } from 'react-router-dom';

// JST helpers (match SearchLogsTable behavior).
const toJST = (date: Date): Date => {
    const jstOffset = 9 * 60;
    const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return new Date(utcDate.getTime() + jstOffset * 60000);
};

const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const REASON_LABEL: Record<FlaggedReason, string> = {
    inappropriate: 'Inappropriate query',
    filtered: 'All results filtered',
    device_blocked: 'Device blocked',
};

const REASON_BADGE: Record<FlaggedReason, string> = {
    inappropriate: 'bg-red-100 text-red-800 border-red-200',
    filtered: 'bg-amber-100 text-amber-800 border-amber-200',
    device_blocked: 'bg-gray-100 text-gray-700 border-gray-200',
};

// "inappropriate" is the most serious; used for the severity sort and banner emphasis.
const REASON_SEVERITY: Record<FlaggedReason, number> = {
    inappropriate: 3,
    device_blocked: 2,
    filtered: 1,
};

interface DeviceData {
    deviceName: string;
    googleUser?: { name: string | null; email: string | null };
}

const exportToCSV = (data: FlaggedSearch[], deviceMappings: { [key: string]: string }) => {
    const headers = ['Date', 'Student / Device', 'Query', 'Reason', 'Search Type', 'Email'];
    const csvContent = [
        headers.join(','),
        ...data.map(f =>
            [
                `"${f.date}"`,
                `"${f.googleName || deviceMappings[f.deviceId] || f.deviceId}"`,
                `"${(f.query || '').replace(/"/g, '""')}"`,
                f.reason,
                f.searchType,
                `"${f.googleEmail || ''}"`,
            ].join(',')
        ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `flagged_searches_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const FlaggedSearchesTable: React.FC = () => {
    const [flagged, setFlagged] = useState<FlaggedSearch[]>([]);
    const [deviceMappings, setDeviceMappings] = useState<{ [key: string]: string }>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [fromDate, setFromDate] = useState(() => {
        const d = toJST(new Date());
        d.setDate(d.getDate() - 7);
        return formatDateForInput(d);
    });
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));
    const [userSearch, setUserSearch] = useState('');
    const [reasonFilter, setReasonFilter] = useState<'' | FlaggedReason>('');
    const [view, setView] = useState<'list' | 'byStudent'>('byStudent');

    // Load device -> friendly-name mappings once.
    useEffect(() => {
        (async () => {
            try {
                const snapshot = await get(ref(databaseLog, 'deviceRegistry'));
                if (snapshot.exists()) {
                    const registry = snapshot.val();
                    const mappings: { [key: string]: string } = {};
                    Object.keys(registry).forEach(deviceId => {
                        const device: DeviceData = registry[deviceId];
                        mappings[deviceId] = device.googleUser?.name || device.deviceName || deviceId;
                    });
                    setDeviceMappings(mappings);
                }
            } catch (err) {
                console.error('Error loading device mappings:', err);
            }
        })();
    }, []);

    const fetchFlagged = useCallback(async (fromStr: string, toStr: string) => {
        setLoading(true);
        setError(null);
        try {
            const fromDateTime = toJST(new Date(fromStr));
            const toDateTime = toJST(new Date(toStr));
            fromDateTime.setHours(0, 0, 0, 0);
            toDateTime.setHours(23, 59, 59, 999);

            const collected: FlaggedSearch[] = [];
            const promises: Promise<unknown>[] = [];
            const current = new Date(fromDateTime);

            while (current <= toDateTime) {
                const year = current.getFullYear();
                const month = String(current.getMonth() + 1).padStart(2, '0');
                const day = String(current.getDate()).padStart(2, '0');
                const dayRef = ref(databaseLog, `flaggedSearches/${year}/${month}/${day}`);
                promises.push(
                    get(dayRef)
                        .then(snapshot => {
                            if (snapshot.exists()) {
                                const dayData = snapshot.val();
                                Object.keys(dayData).forEach(id => {
                                    collected.push({
                                        id,
                                        ...dayData[id],
                                        storagePath: `flaggedSearches/${year}/${month}/${day}/${id}`,
                                    });
                                });
                            }
                        })
                        .catch(err => console.warn(`Error fetching flagged ${year}-${month}-${day}:`, err))
                );
                current.setDate(current.getDate() + 1);
            }

            await Promise.all(promises);
            collected.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            setFlagged(collected);
        } catch (err) {
            console.error('Error fetching flagged searches:', err);
            setError('Failed to fetch flagged searches. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFlagged(fromDate, toDate);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filtered = useMemo(() => {
        let list = flagged;
        if (reasonFilter) list = list.filter(f => f.reason === reasonFilter);
        if (userSearch) {
            const term = userSearch.toLowerCase();
            list = list.filter(f => {
                const name = (f.googleName || deviceMappings[f.deviceId] || f.deviceId).toLowerCase();
                return (
                    name.includes(term) ||
                    f.deviceId.toLowerCase().includes(term) ||
                    (f.googleEmail || '').toLowerCase().includes(term) ||
                    (f.query || '').toLowerCase().includes(term)
                );
            });
        }
        return list;
    }, [flagged, reasonFilter, userSearch, deviceMappings]);

    // Aggregate by student/device for the "by student" view.
    const byStudent = useMemo(() => {
        const groups: {
            [key: string]:             {
                key: string;
                name: string;
                email?: string;
                deviceId: string;
                total: number;
                reasons: Record<string, number>;
                maxSeverity: number;
                lastDate: string;
                lastTs: number;
                samples: string[];
            };
        } = {};
        for (const f of filtered) {
            const key = f.googleEmail || f.deviceId;
            if (!groups[key]) {
                groups[key] = {
                    key,
                    name: f.googleName || deviceMappings[f.deviceId] || f.deviceId,
                    email: f.googleEmail,
                    deviceId: f.deviceId,
                    total: 0,
                    reasons: {},
                    maxSeverity: 0,
                    lastDate: f.date,
                    lastTs: f.timestamp || 0,
                    samples: [],
                };
            }
            const g = groups[key];
            g.total += 1;
            g.reasons[f.reason] = (g.reasons[f.reason] || 0) + 1;
            g.maxSeverity = Math.max(g.maxSeverity, REASON_SEVERITY[f.reason] || 0);
            if ((f.timestamp || 0) > g.lastTs) {
                g.lastTs = f.timestamp || 0;
                g.lastDate = f.date;
            }
            if (g.samples.length < 5 && f.query) g.samples.push(f.query);
        }
        return Object.values(groups).sort(
            (a, b) => b.maxSeverity - a.maxSeverity || b.total - a.total
        );
    }, [filtered, deviceMappings]);

    // "Today" count (JST) across all flagged, emphasizing inappropriate.
    const todayStats = useMemo(() => {
        const todayStr = formatDateForInput(toJST(new Date()));
        let total = 0;
        let serious = 0;
        for (const f of flagged) {
            const d = f.date ? new Date(f.date) : null;
            const dStr = d && !isNaN(d.getTime()) ? formatDateForInput(toJST(d)) : '';
            if (dStr === todayStr) {
                total += 1;
                if (f.reason === 'inappropriate') serious += 1;
            }
        }
        return { total, serious };
    }, [flagged]);

    const handleFilter = () => fetchFlagged(fromDate, toDate);

    return (
        <div className="container mx-auto px-6 py-8">
            <NavBar title="Flagged Searches" />

            {/* Today banner */}
            <div className={`mb-6 p-4 rounded-xl border ${todayStats.serious > 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
                <p className="text-gray-800">
                    <span className="font-bold text-lg">{todayStats.total}</span> flagged attempt{todayStats.total === 1 ? '' : 's'} today
                    {todayStats.serious > 0 && (
                        <span className="ml-2 font-semibold text-red-700">({todayStats.serious} inappropriate)</span>
                    )}
                </p>
            </div>

            {/* Filters */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">From Date</label>
                        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">To Date</label>
                        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Student / Query</label>
                        <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name, email, query..." className="w-full p-3 border border-gray-300 rounded-lg" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">Reason</label>
                        <select value={reasonFilter} onChange={e => setReasonFilter(e.target.value as '' | FlaggedReason)} className="w-full p-3 border border-gray-300 rounded-lg">
                            <option value="">All Reasons</option>
                            <option value="inappropriate">Inappropriate query</option>
                            <option value="filtered">All results filtered</option>
                            <option value="device_blocked">Device blocked</option>
                        </select>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={handleFilter} disabled={loading} className="p-3 bg-rose-600 text-white rounded-lg shadow-md hover:bg-rose-700 disabled:bg-gray-400 transition-colors">
                        {loading ? 'Loading...' : 'Filter'}
                    </button>
                    <button onClick={() => exportToCSV(filtered, deviceMappings)} disabled={loading || filtered.length === 0} className="p-3 bg-green-600 text-white rounded-lg shadow-md hover:bg-green-700 disabled:bg-gray-400 transition-colors">
                        Export CSV
                    </button>
                    <div className="ml-auto flex rounded-lg overflow-hidden border border-gray-200">
                        <button onClick={() => setView('byStudent')} className={`px-4 py-2 text-sm ${view === 'byStudent' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700'}`}>By Student</button>
                        <button onClick={() => setView('list')} className={`px-4 py-2 text-sm ${view === 'list' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700'}`}>All Attempts</button>
                    </div>
                </div>
            </div>

            {error && <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">{error}</div>}

            {loading && (
                <div className="py-4">
                    <p className="mb-4 text-gray-500 text-sm text-center">Loading flagged searches...</p>
                    <LoadingSkeleton rows={4} />
                </div>
            )}

            {!loading && filtered.length === 0 && (
                <div className="text-center py-16">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No flagged searches</h3>
                    <p className="text-gray-600">Nothing was blocked or filtered in this range. That's a good thing!</p>
                </div>
            )}

            {/* By-student aggregation */}
            {!loading && view === 'byStudent' && filtered.length > 0 && (
                <div className="space-y-4">
                    {byStudent.map(g => (
                        <div key={g.key} className="bg-white rounded-xl shadow-lg p-5 border border-gray-100">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
                                    {g.email && <p className="text-sm text-gray-500">{g.email}</p>}
                                    <p className="text-xs text-gray-400 mt-1">Last: {g.lastDate}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-rose-600">{g.total}</div>
                                    <div className="text-xs text-gray-500">attempts</div>
                                    <Link to={`/student/${encodeURIComponent(g.deviceId)}`} className="text-xs text-blue-600 hover:underline">View profile</Link>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-3">
                                {Object.entries(g.reasons).map(([reason, count]) => (
                                    <span key={reason} className={`px-2 py-1 rounded-full text-xs font-medium border ${REASON_BADGE[reason as FlaggedReason] || 'bg-gray-100 text-gray-700'}`}>
                                        {REASON_LABEL[reason as FlaggedReason] || reason}: {count}
                                    </span>
                                ))}
                            </div>
                            {g.samples.length > 0 && (
                                <div className="mt-3 text-sm text-gray-600">
                                    <span className="font-medium">Examples:</span> {g.samples.map(s => `"${s}"`).join(', ')}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Flat list */}
            {!loading && view === 'list' && filtered.length > 0 && (
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="text-left px-4 py-3">Date</th>
                                <th className="text-left px-4 py-3">Student / Device</th>
                                <th className="text-left px-4 py-3">Query</th>
                                <th className="text-left px-4 py-3">Reason</th>
                                <th className="text-left px-4 py-3">Type</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(f => (
                                <tr key={f.id} className="border-t border-gray-100">
                                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{f.date}</td>
                                    <td className="px-4 py-3">{f.googleName || deviceMappings[f.deviceId] || f.deviceId}</td>
                                    <td className="px-4 py-3 font-medium text-gray-900">{f.query}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${REASON_BADGE[f.reason] || 'bg-gray-100 text-gray-700'}`}>
                                            {REASON_LABEL[f.reason] || f.reason}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{f.searchType}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default FlaggedSearchesTable;
