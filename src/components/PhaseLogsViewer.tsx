import React, { useState } from 'react';
import './PhaseLogsViewer.css';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'warning' | 'error' | 'debug';
    message: string;
}

interface Phase {
    id: string;
    name: string;
    status: string;
    progress: number;
    duration?: number;
    logs?: LogEntry[];
}

interface PhaseLogsViewerProps {
    phase: Phase;
}

export const PhaseLogsViewer: React.FC<PhaseLogsViewerProps> = ({ phase }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'info': return 'ℹ️';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            case 'debug': return '🔍';
            default: return '•';
        }
    };

    const getLevelClass = (level: string) => {
        return `log-level-${level}`;
    };

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    // Mock logs if none provided (for demo purposes)
    const logs = phase.logs || [
        { timestamp: new Date().toISOString(), level: 'info' as const, message: `Started ${phase.name}` },
        { timestamp: new Date().toISOString(), level: 'debug' as const, message: `Processing phase logic...` },
        { timestamp: new Date().toISOString(), level: 'info' as const, message: `Progress: ${phase.progress}%` }
    ];

    return (
        <div className="phase-logs-viewer">
            <button
                className="logs-toggle"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <span className="toggle-icon">{isExpanded ? '▼' : '▶'}</span>
                <span className="toggle-text">
                    {isExpanded ? 'Hide' : 'Show'} Logs ({logs.length})
                </span>
            </button>

            {isExpanded && (
                <div className="logs-container">
                    {logs.length === 0 ? (
                        <div className="logs-empty">
                            <span className="empty-icon">📋</span>
                            <p>No logs available for this phase</p>
                        </div>
                    ) : (
                        <div className="logs-content">
                            {logs.map((log, index) => (
                                <div key={index} className={`log-entry ${getLevelClass(log.level)}`}>
                                    <span className="log-timestamp">{formatTimestamp(log.timestamp)}</span>
                                    <span className="log-level-icon">{getLevelIcon(log.level)}</span>
                                    <span className="log-message">{log.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
