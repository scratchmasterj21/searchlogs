import React, { useEffect, useState, useCallback } from 'react';
import { ref, get } from 'firebase/database';
import { databaseLog } from './firebaseConfig';
import { SearchLog, AIChatLog, FlaggedSearch } from './types';
import NavBar from './components/NavBar';
import { useParams } from 'react-router-dom';

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

// Fetch all entries for a collection across a JST date range, filtered to one device.
async function fetchByDevice<T extends { deviceId: string; timestamp?: number }>(
    collection: 'searchLogs' | 'aiChatLogs' | 'flaggedSearches',
    deviceId: string,
    fromStr: string,
    toStr: string
): Promise<T[]> {
    const fromDateTime = toJST(new Date(fromStr));
    const toDateTime = toJST(new Date(toStr));
    fromDateTime.setHours(0, 0, 0, 0);
    toDateTime.setHours(23, 59, 59, 999);

    const collected: T[] = [];
    const promises: Promise<unknown>[] = [];
    const current = new Date(fromDateTime);

    while (current <= toDateTime) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        const dayRef = ref(databaseLog, `${collection}/${year}/${month}/${day}`);
        promises.push(
            get(dayRef)
                .then(snapshot => {
                    if (snapshot.exists()) {
                        const dayData = snapshot.val();
                        Object.keys(dayData).forEach(id => {
                            const entry = dayData[id];
                            if (entry.deviceId === deviceId) {
                                collected.push({ id, ...entry });
                            }
                        });
                    }
                })
                .catch(() => {})
        );
        current.setDate(current.getDate() + 1);
    }

    await Promise.all(promises);
    collected.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return collected;
}

const StudentProfile: React.FC = () => {
    const { deviceId = '' } = useParams<{ deviceId: string }>();

    const [name, setName] = useState<string>(deviceId);
    const [email, setEmail] = useState<string | null>(null);
    const [searches, setSearches] = useState<SearchLog[]>([]);
    const [chats, setChats] = useState<AIChatLog[]>([]);
    const [flags, setFlags] = useState<FlaggedSearch[]>([]);
    const [loading, setLoading] = useState(false);

    const [fromDate, setFromDate] = useState(() => {
        const d = toJST(new Date());
        d.setDate(d.getDate() - 14);
        return formatDateForInput(d);
    });
    const [toDate, setToDate] = useState(() => formatDateForInput(toJST(new Date())));

    useEffect(() => {
        (async () => {
            try {
                const snap = await get(ref(databaseLog, `deviceRegistry/${deviceId}`));
                if (snap.exists()) {
                    const d = snap.val();
                    setName(d.googleUser?.name || d.deviceName || deviceId);
                    setEmail(d.googleUser?.email || null);
                }
            } catch { /* ignore */ }
        })();
    }, [deviceId]);

    const load = useCallback(async () => {
        if (!deviceId) return;
        setLoading(true);
        try {
            const [s, c, f] = await Promise.all([
                fetchByDevice<SearchLog>('searchLogs', deviceId, fromDate, toDate),
                fetchByDevice<AIChatLog>('aiChatLogs', deviceId, fromDate, toDate),
                fetchByDevice<FlaggedSearch>('flaggedSearches', deviceId, fromDate, toDate),
            ]);
            setSearches(s);
            setChats(c);
            setFlags(f);
        } finally {
            setLoading(false);
        }
    }, [deviceId, fromDate, toDate]);

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deviceId]);

    return (
        <div className="container mx-auto px-6 py-8">
            <NavBar title="Student Profile" />

            {/* Identity */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">{name}</h2>
                {email && <p className="text-gray-500">{email}</p>}
                <p className="text-xs text-gray-400 mt-1 font-mono">{deviceId}</p>
                <div className="flex flex-wrap gap-3 mt-4">
                    <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg" />
                    <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="p-2 border border-gray-300 rounded-lg" />
                    <button onClick={load} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors">
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl shadow p-5 border border-gray-100 text-center">
                    <div className="text-3xl font-bold text-blue-600">{searches.length}</div>
                    <div className="text-sm text-gray-500">Searches</div>
                </div>
                <div className="bg-white rounded-xl shadow p-5 border border-gray-100 text-center">
                    <div className="text-3xl font-bold text-purple-600">{chats.length}</div>
                    <div className="text-sm text-gray-500">AI chats</div>
                </div>
                <div className="bg-white rounded-xl shadow p-5 border border-gray-100 text-center">
                    <div className="text-3xl font-bold text-rose-600">{flags.length}</div>
                    <div className="text-sm text-gray-500">Flagged attempts</div>
                </div>
            </div>

            {/* Flagged attempts (most important first) */}
            <Section title="Flagged attempts" accent="text-rose-600">
                {flags.length === 0 ? <Empty text="No flagged attempts in this range." /> : (
                    <ul className="divide-y divide-gray-100">
                        {flags.map(f => (
                            <li key={f.id} className="py-2 flex items-center justify-between">
                                <span className="font-medium text-gray-900">{f.query}</span>
                                <span className="text-xs text-gray-500">{f.reason} - {f.date}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* Searches */}
            <Section title="Recent searches" accent="text-blue-600">
                {searches.length === 0 ? <Empty text="No searches in this range." /> : (
                    <ul className="divide-y divide-gray-100">
                        {searches.slice(0, 100).map(s => (
                            <li key={s.id} className="py-2 flex items-center justify-between">
                                <span className="font-medium text-gray-900">{s.query}</span>
                                <span className="text-xs text-gray-500">{s.searchType} - {s.results?.length || 0} results</span>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>

            {/* AI chats */}
            <Section title="AI chats" accent="text-purple-600">
                {chats.length === 0 ? <Empty text="No AI chats in this range." /> : (
                    <ul className="divide-y divide-gray-100">
                        {chats.slice(0, 100).map(c => (
                            <li key={c.id} className="py-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900">{c.userMessage}</span>
                                    {c.wasRefused && <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 border border-red-200">Refused</span>}
                                </div>
                                <p className="text-sm text-gray-600 line-clamp-2 mt-1">{c.aiResponse}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </div>
    );
};

const Section: React.FC<{ title: string; accent: string; children: React.ReactNode }> = ({ title, accent, children }) => (
    <div className="mb-6 bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className={`text-lg font-bold mb-3 ${accent}`}>{title}</h3>
        {children}
    </div>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-sm text-gray-500 py-2">{text}</p>
);

export default StudentProfile;
