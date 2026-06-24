// types.ts
export interface SearchResult {
    contentUrl: string;
    displayUrl: string;
    faviconUrl: string;
    name: string;
    snippet: string;
    thumbnailUrl: string;
    url: string;
}

export interface SearchLog {
    id: string;
    date: string;
    deviceId: string;
    query: string;
    results: SearchResult[];
    timestamp: number;
    userAgent: string;
    searchType: string;
    // RTDB path this entry was read from (searchLogs/YYYY/MM/DD/<id>), used for deletion.
    storagePath?: string;
}

// Flagged (blocked/filtered) search attempt, for safeguarding review.
export type FlaggedReason = 'inappropriate' | 'filtered' | 'device_blocked';

export interface FlaggedSearch {
    id: string;
    date: string;
    deviceId: string;
    query: string;
    searchType: string;
    reason: FlaggedReason;
    timestamp: number;
    userAgent: string;
    googleId?: string;
    googleEmail?: string;
    googleName?: string;
    storagePath?: string;
}

// AI Chat Log types
export interface AIChatSource {
    citationNumber: number;
    domain: string;
    snippet: string;
    title: string;
    url: string;
}

export interface AIChatLog {
    id: string;
    date: string;
    deviceId: string;
    userMessage: string;
    aiResponse: string;
    aiModel: string;
    confidence: number;
    processingTime: number;
    tokensUsed: number;
    timestamp: number;
    userAgent: string;
    sources?: AIChatSource[];
    sourcesCount?: number;
    relatedQuestions?: string[];
    conversationId?: string;
    conversationLength?: number;
    messageNumber?: number;
    hasConversationHistory?: boolean;
    wasRegenerated?: boolean;
    wasRefused?: boolean;
}
