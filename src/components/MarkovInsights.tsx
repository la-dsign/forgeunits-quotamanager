// MarkovInsights.tsx - Markov Intelligence Predictions Panel
// Shows real-time predictions from the Markov Intelligence system

import React, { useState, useEffect } from 'react';
import './MarkovInsights.css';

interface Prediction {
    value: string | number | string[];
    confidence: number;
}

interface MarkovPredictions {
    duration: Prediction;
    quality: Prediction;
    features: Prediction;
    anomalyRisk: Prediction;
}

interface MarkovStats {
    models: {
        [key: string]: {
            trained: boolean;
            patterns: number;
            accuracy: number;
        };
    };
    totalPatterns: number;
    lastTraining: number;
}

interface MarkovInsightsProps {
    apiUrl?: string;
    refreshInterval?: number;
}

export const MarkovInsights: React.FC<MarkovInsightsProps> = ({
    apiUrl = 'http://localhost:3000/api',
    refreshInterval = 30000
}) => {
    const [predictions, setPredictions] = useState<MarkovPredictions | null>(null);
    const [stats, setStats] = useState<MarkovStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [predRes, statsRes] = await Promise.all([
                    fetch(`${apiUrl}/intelligence/predictions`),
                    fetch(`${apiUrl}/intelligence/markov/stats`)
                ]);

                if (predRes.ok) {
                    const predData = await predRes.json();
                    setPredictions(predData.predictions);
                }

                if (statsRes.ok) {
                    const statsData = await statsRes.json();
                    setStats(statsData);
                }

                setError(null);
            } catch (e) {
                setError('Failed to fetch Markov data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
    }, [apiUrl, refreshInterval]);

    const formatConfidence = (confidence: number) => {
        return `${(confidence * 100).toFixed(0)}%`;
    };

    const getAnomalyColor = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'low': return '#10b981';
            case 'medium': return '#f59e0b';
            case 'high': return '#ef4444';
            default: return '#6b7280';
        }
    };

    if (loading) {
        return (
            <div className="markov-insights loading">
                <div className="panel-title">🧠 Markov Intelligence</div>
                <div className="loading-skeleton">Loading predictions...</div>
            </div>
        );
    }

    return (
        <div className="markov-insights">
            <div className="panel-title">
                🧠 Markov Intelligence
                {stats && (
                    <span className="pattern-count">{stats.totalPatterns} patterns</span>
                )}
            </div>

            {error && <div className="error-message">{error}</div>}

            {predictions && (
                <div className="predictions-grid">
                    {/* Duration Prediction */}
                    <div className="prediction-card">
                        <div className="prediction-icon">⏱️</div>
                        <div className="prediction-content">
                            <div className="prediction-label">Estimated Duration</div>
                            <div className="prediction-value">
                                {typeof predictions.duration.value === 'string'
                                    ? predictions.duration.value
                                    : `${predictions.duration.value}s`}
                            </div>
                            <div className="prediction-confidence">
                                <div
                                    className="confidence-bar"
                                    style={{ width: formatConfidence(predictions.duration.confidence) }}
                                />
                                <span>{formatConfidence(predictions.duration.confidence)} confidence</span>
                            </div>
                        </div>
                    </div>

                    {/* Quality Prediction */}
                    <div className="prediction-card">
                        <div className="prediction-icon">⭐</div>
                        <div className="prediction-content">
                            <div className="prediction-label">Predicted Quality</div>
                            <div className="prediction-value quality-score">
                                {typeof predictions.quality.value === 'number'
                                    ? predictions.quality.value.toFixed(3)
                                    : predictions.quality.value}
                            </div>
                            <div className="prediction-confidence">
                                <div
                                    className="confidence-bar"
                                    style={{ width: formatConfidence(predictions.quality.confidence) }}
                                />
                                <span>{formatConfidence(predictions.quality.confidence)} confidence</span>
                            </div>
                        </div>
                    </div>

                    {/* Feature Recommendations */}
                    <div className="prediction-card">
                        <div className="prediction-icon">💡</div>
                        <div className="prediction-content">
                            <div className="prediction-label">Recommended Features</div>
                            <div className="prediction-value features">
                                {Array.isArray(predictions.features.value)
                                    ? predictions.features.value.map((f, i) => (
                                        <span key={i} className="feature-tag">+{f}</span>
                                    ))
                                    : predictions.features.value}
                            </div>
                            <div className="prediction-confidence">
                                <span>{formatConfidence(predictions.features.confidence)} success rate</span>
                            </div>
                        </div>
                    </div>

                    {/* Anomaly Risk */}
                    <div className="prediction-card">
                        <div className="prediction-icon">🛡️</div>
                        <div className="prediction-content">
                            <div className="prediction-label">Anomaly Risk</div>
                            <div
                                className="prediction-value risk"
                                style={{ color: getAnomalyColor(String(predictions.anomalyRisk.value)) }}
                            >
                                {String(predictions.anomalyRisk.value).toUpperCase()}
                            </div>
                            <div className="prediction-confidence">
                                <span>{formatConfidence(predictions.anomalyRisk.confidence)} confidence</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stats && (
                <div className="model-stats">
                    <div className="stats-title">Model Performance</div>
                    <div className="models-grid">
                        {Object.entries(stats.models).slice(0, 4).map(([name, model]) => (
                            <div key={name} className="model-item">
                                <div className="model-name">
                                    {name.replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                <div className="model-accuracy">
                                    {(model.accuracy * 100).toFixed(0)}%
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarkovInsights;
