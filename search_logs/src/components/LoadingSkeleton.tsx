import React from 'react';

// Animated placeholder cards shown while data loads, instead of a bare spinner.
const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
    return (
        <div className="space-y-4" aria-busy="true" aria-label="Loading content">
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="bg-white rounded-xl shadow p-5 border border-gray-100 animate-pulse">
                    <div className="flex items-center justify-between mb-3">
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                    <div className="h-3 bg-gray-200 rounded w-2/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
            ))}
        </div>
    );
};

export default LoadingSkeleton;
