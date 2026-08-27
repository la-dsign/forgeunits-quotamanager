// ProviderStatus.tsx - LLM Providers Status Panel
// Shows real-time status of all configured LLM providers

import React, { useState, useEffect } from 'react';
import './ProviderStatus.css';

interface ProviderQuota {
    used: number;
    limit: number | string;
    remaining: number | string;
}

interface Provider {
    name: string;
    status: 'active' | 'limited' | 'standby' | 'offline';
    quota: ProviderQuota;
    latency: number | null;
}

interface ProvidersData {
    providers: {
        [key: string]: Provider;
    };
    fallbackOrder: string[];
    totalCapacity: number;
}

interface ProviderStatusProps {
    apiUrl?: string;
    refreshInterval?: number;
    compact?: boolean;
}

export const ProviderStatus: React.FC<ProviderStatusProps> = ({
    apiUrl = 'http://localhost:3000/api',
    refreshInterval = 30000,
    compact = false
}) => {
    const [data, setData] = useState<ProvidersData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch(`${apiUrl}/providers/health`);
                if (res.ok) {
                    const jsonData = await res.json();
                    setData(jsonData);
                    setError(null);
                } else {
                    throw new Error('Failed to fetch provider status');
                }
            } catch (e) {
                setError('Unable to fetch provider status');
                // Set default data
                setData({
                    providers: {
                        gemini: { name: 'Gemini', status: 'active', quota: { used: 0, limit: 200, remaining: 200 }, latency: null },
                        groq: { name: 'Groq', status: 'active', quota: { used: 0, limit: 14400, remaining: 14400 }, latency: null },
                        mistral: { name: 'Mistral', status: 'active', quota: { used: 0, limit: 33000, remaining: 33000 }, latency: null },
                        deepseek: { name: 'DeepSeek', status: 'standby', quota: { used: 0, limit: 'variable', remaining: 'variable' }, latency: null }
                    },
                    fallbackOrder: ['gemini', 'groq', 'mistral', 'deepseek'],
                    totalCapacity: 47600
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [apiUrl, refreshInterval]);

    const getProviderIcon = (key: string) => {
        switch (key) {
            case 'gemini': return '🔷';
            case 'groq': return '⚡';
            case 'mistral': return '🌀';
            case 'deepseek': return '🔗';
            case 'openai': return '🟢';
            default: return '🔌';
        }
    };

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'active': return 'status-active';
            case 'limited': return 'status-limited';
            case 'standby': return 'status-standby';
            case 'offline': return 'status-offline';
            default: return '';
        }
    };

    const formatQuota = (quota: ProviderQuota) => {
        if (typeof quota.limit === 'string') return quota.limit;
        return `${quota.remaining.toLocaleString()}/${quota.limit.toLocaleString()}`;
    };

    if (loading) {
        return (
            <div className={`provider-status ${compact ? 'compact' : ''}`}>
                <div className="panel-title">🔌 LLM Providers</div>
                <div className="loading-state">Loading...</div>
            </div>
        );
    }

    return (
        <div className={`provider-status ${compact ? 'compact' : ''}`}>
            <div className="panel-header">
                <div className="panel-title">🔌 LLM Providers</div>
                {data && (
                    <div className="total-capacity">
                        <span className="capacity-label">Total Capacity</span>
                        <span className="capacity-value">{data.totalCapacity.toLocaleString()}/day</span>
                    </div>
                )}
            </div>

            {error && <div className="error-banner">{error}</div>}

            <div className="provider-list">
                {data && Object.entries(data.providers).map(([key, provider]) => (
                    <div key={key} className="provider-item">
                        <div className="provider-main">
                            <div className="provider-icon">{getProviderIcon(key)}</div>
                            <div className="provider-info">
                                <div className="provider-name">{provider.name}</div>
                                <div className="provider-quota">{formatQuota(provider.quota)}</div>
                            </div>
                        </div>
                        <div className="provider-status-badge">
                            <span className={`status-badge ${getStatusClass(provider.status)}`}>
                                {provider.status}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {data && !compact && (
                <div className="fallback-order">
                    <span className="fallback-label">Fallback Order:</span>
                    <div className="fallback-chain">
                        {data.fallbackOrder.map((provider, index) => (
                            <React.Fragment key={provider}>
                                <span className="fallback-item">{provider}</span>
                                {index < data.fallbackOrder.length - 1 && (
                                    <span className="fallback-arrow">→</span>
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProviderStatus;
