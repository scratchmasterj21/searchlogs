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
}
