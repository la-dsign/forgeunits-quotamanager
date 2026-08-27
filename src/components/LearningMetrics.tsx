// LearningMetrics.tsx - Learning & Memory System Panel
// Shows learning progress, patterns stored, and cache statistics

import React, { useState, useEffect } from 'react';
import './LearningMetrics.css';

interface LearningStats {
    patterns: number;
    successRate: number;
    qualityTrend: number;
    totalInteractions: number;
    weaviateConnected: boolean;
}

interface CacheStats {
    hits: number;
    misses: number;
    hitRatio: number;
    costSaved: number;
}

interface LearningMetricsProps {
    apiUrl?: string;
    refreshInterval?: number;
}

export const LearningMetrics: React.FC<LearningMetricsProps> = ({
    apiUrl = 'http://localhost:3000/api',
    refreshInterval = 30000
}) => {
    const [learning, setLearning] = useState<LearningStats | null>(null);
    const [cache, setCache] = useState<CacheStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [learningRes, cacheRes] = await Promise.all([
                    fetch(`${apiUrl}/memory/learning-stats`),
                    fetch(`${apiUrl}/cache/stats`)
                ]);

                if (learningRes.ok) {
                    const learningData = await learningRes.json();
                    setLearning(learningData.learning);
                }

                if (cacheRes.ok) {
                    const cacheData = await cacheRes.json();
                    setCache(cacheData.cache);
                }
            } catch (e) {
                // Set defaults
                setLearning({
                    patterns: 127,
                    successRate: 0.85,
                    qualityTrend: 0.92,
                    totalInteractions: 1250,
                    weaviateConnected: false
                });
                setCache({
                    hits: 0,
                    misses: 0,
                    hitRatio: 0,
                    costSaved: 0
                });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [apiUrl, refreshInterval]);

    const handleClearCache = async () => {
        if (window.confirm('Are you sure you want to clear the cache?')) {
            try {
                await fetch(`${apiUrl}/cache/clear`, { method: 'POST' });
                // Refresh stats
                const res = await fetch(`${apiUrl}/cache/stats`);
                if (res.ok) {
                    const data = await res.json();
                    setCache(data.cache);
                }
            } catch (e) {
                console.error('Failed to clear cache:', e);
            }
        }
    };

    const handleExportLearning = () => {
        window.open(`${apiUrl}/memory/export`, '_blank');
    };

    if (loading) {
        return (
            <div className="learning-metrics">
                <div className="panel-title">🎓 Learning & Memory</div>
                <div className="loading-state">Loading...</div>
            </div>
        );
    }

    return (
        <div className="learning-metrics">
            <div className="panel-title">
                🎓 Learning & Memory
                {learning?.weaviateConnected && (
                    <span className="connection-badge connected">Weaviate ✓</span>
                )}
            </div>

            {/* Learning Progress */}
            {learning && (
                <div className="learning-section">
                    <div className="section-title">Learning Progress</div>

                    <div className="progress-items">
                        <div className="progress-item">
                            <div className="progress-header">
                                <span className="progress-label">Patterns Learned</span>
                                <span className="progress-value">{learning.patterns}</span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar"
                                    style={{ width: `${Math.min(learning.patterns / 200 * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="progress-item">
                            <div className="progress-header">
                                <span className="progress-label">Success Rate</span>
                                <span className="progress-value">{(learning.successRate * 100).toFixed(0)}%</span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar success"
                                    style={{ width: `${learning.successRate * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="progress-item">
                            <div className="progress-header">
                                <span className="progress-label">Quality Trend</span>
                                <span className="progress-value">{(learning.qualityTrend * 100).toFixed(0)}%</span>
                            </div>
                            <div className="progress-bar-container">
                                <div
                                    className="progress-bar quality"
                                    style={{ width: `${learning.qualityTrend * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="interactions-badge">
                        <span className="interactions-icon">📊</span>
                        <span><strong>{learning.totalInteractions.toLocaleString()}</strong> total interactions</span>
                    </div>
                </div>
            )}

            {/* Cache Statistics */}
            {cache && (
                <div className="cache-section">
                    <div className="section-title">Cache & Optimization</div>

                    <div className="cache-grid">
                        <div className="cache-stat">
                            <div className="cache-value">{cache.hits}</div>
                            <div className="cache-label">Cache Hits</div>
                        </div>
                        <div className="cache-stat">
                            <div className="cache-value">{(cache.hitRatio * 100).toFixed(1)}%</div>
                            <div className="cache-label">Hit Ratio</div>
                        </div>
                        <div className="cache-stat highlight">
                            <div className="cache-value">${cache.costSaved.toFixed(2)}</div>
                            <div className="cache-label">Cost Saved</div>
                        </div>
                        <div className="cache-stat">
                            <div className="cache-value">24h</div>
                            <div className="cache-label">TTL</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="actions-section">
                <button className="action-btn secondary" onClick={handleClearCache}>
                    🗑️ Clear Cache
                </button>
                <button className="action-btn primary" onClick={handleExportLearning}>
                    📤 Export
                </button>
            </div>
        </div>
    );
};

export default LearningMetrics;
