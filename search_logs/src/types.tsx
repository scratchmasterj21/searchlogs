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
