import { useState, useMemo } from 'react'
import './SessionGrid.css'

interface Phase {
    id: string
    name: string
    status: string
    progress: number
}

interface Session {
    id: string
    operationName: string
    status: string
    overallProgress: number
    completedPhases: number
    totalPhases: number
    failedPhases: number
    startTime: number | null
    duration: number | null
    phases: Phase[]
}

interface SessionGridProps {
    sessions: Session[]
    onSessionSelect?: (session: Session) => void
    selectedSessionId?: string
}

type SortOption = 'newest' | 'oldest' | 'name' | 'progress' | 'status'
type ViewMode = 'grid' | 'compact'

export default function SessionGrid({ sessions, onSessionSelect, selectedSessionId }: SessionGridProps) {
    const [sortBy, setSortBy] = useState<SortOption>('newest')
    const [viewMode, setViewMode] = useState<ViewMode>('grid')
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress' | 'completed' | 'failed'>('all')

    // Sort sessions
    const sortedSessions = useMemo(() => {
        const filtered = sessions.filter(s =>
            filterStatus === 'all' || s.status === filterStatus
        )

        return [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return (b.startTime || 0) - (a.startTime || 0)
                case 'oldest':
                    return (a.startTime || 0) - (b.startTime || 0)
                case 'name':
                    return a.operationName.localeCompare(b.operationName)
                case 'progress':
                    return b.overallProgress - a.overallProgress
                case 'status':
                    return a.status.localeCompare(b.status)
                default:
                    return 0
            }
        })
    }, [sessions, sortBy, filterStatus])

    // Get status icon
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return '⏸️'
            case 'in-progress': return '⚡'
            case 'completed': return '✅'
            case 'failed': return '❌'
            default: return '📋'
        }
    }

    // Format duration
    const formatDuration = (ms: number | null) => {
        if (!ms) return '-'
        if (ms < 1000) return `${ms}ms`
        const seconds = Math.floor(ms / 1000)
        if (seconds < 60) return `${seconds}s`
        const minutes = Math.floor(seconds / 60)
        const remainingSeconds = seconds % 60
        return `${minutes}m ${remainingSeconds}s`
    }

    // Status counts
    const statusCounts = {
        all: sessions.length,
        pending: sessions.filter(s => s.status === 'pending').length,
        'in-progress': sessions.filter(s => s.status === 'in-progress').length,
        completed: sessions.filter(s => s.status === 'completed').length,
        failed: sessions.filter(s => s.status === 'failed').length
    }

    return (
        <div className="session-grid-container">
            {/* Header with controls */}
            <div className="grid-header">
                <div className="grid-controls">
                    {/* View mode toggle */}
                    <div className="view-mode-toggle">
                        <button
                            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                            onClick={() => setViewMode('grid')}
                            title="Grid view"
                        >
                            🔲 Grid
                        </button>
                        <button
                            className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
                            onClick={() => setViewMode('compact')}
                            title="Compact view"
                        >
                            ☰ Compact
                        </button>
                    </div>

                    {/* Status filter */}
                    <select
                        className="grid-filter"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                        title="Filter by status"
                    >
                        <option value="all">All Status ({statusCounts.all})</option>
                        <option value="pending">⏸️ Pending ({statusCounts.pending})</option>
                        <option value="in-progress">⚡ In Progress ({statusCounts['in-progress']})</option>
                        <option value="completed">✅ Completed ({statusCounts.completed})</option>
                        <option value="failed">❌ Failed ({statusCounts.failed})</option>
                    </select>

                    {/* Sort dropdown */}
                    <select
                        className="grid-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as SortOption)}
                        title="Sort sessions"
                    >
                        <option value="newest">🕐 Newest First</option>
                        <option value="oldest">🕑 Oldest First</option>
                        <option value="name">🔤 Name (A-Z)</option>
                        <option value="progress">📊 Progress (High-Low)</option>
                        <option value="status">🏷️ Status</option>
                    </select>
                </div>

                {/* Stats */}
                <div className="grid-stats">
                    <span className="grid-stat">
                        Showing {sortedSessions.length} of {sessions.length} sessions
                    </span>
                </div>
            </div>

            {/* Session grid/list */}
            <div className={`session-grid ${viewMode}`}>
                {sortedSessions.length === 0 ? (
                    <div className="grid-empty">
                        <div className="empty-icon">📋</div>
                        <div className="empty-text">
                            {sessions.length === 0
                                ? 'No sessions available'
                                : 'No sessions match your filters'}
                        </div>
                        {sessions.length > 0 && (
                            <button
                                className="reset-filter-btn"
                                onClick={() => setFilterStatus('all')}
                            >
                                Show All Sessions
                            </button>
                        )}
                    </div>
                ) : (
                    sortedSessions.map(session => (
                        <div
                            key={session.id}
                            className={`session-card ${session.status} ${selectedSessionId === session.id ? 'selected' : ''}`}
                            onClick={() => onSessionSelect?.(session)}
                        >
                            {/* Card header */}
                            <div className="card-header">
                                <span className="card-status-icon">
                                    {getStatusIcon(session.status)}
                                </span>
                                <span className="card-title">{session.operationName}</span>
                            </div>

                            {/* Progress bar */}
                            <div className="card-progress">
                                <div className="progress-bar">
                                    <div
                                        className="progress-fill"
                                        style={{ width: `${session.overallProgress}%` }}
                                    ></div>
                                </div>
                                <span className="progress-text">
                                    {session.overallProgress.toFixed(0)}%
                                </span>
                            </div>

                            {/* Card stats */}
                            <div className="card-stats">
                                <div className="card-stat">
                                    <span className="stat-label">Status</span>
                                    <span className={`stat-value status-${session.status}`}>
                                        {session.status}
                                    </span>
                                </div>
                                <div className="card-stat">
                                    <span className="stat-label">Phases</span>
                                    <span className="stat-value">
                                        {session.completedPhases}/{session.totalPhases}
                                    </span>
                                </div>
                                {session.duration && (
                                    <div className="card-stat">
                                        <span className="stat-label">Duration</span>
                                        <span className="stat-value">
                                            {formatDuration(session.duration)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Phase indicators */}
                            {viewMode === 'grid' && (
                                <div className="card-phases">
                                    {session.phases.slice(0, 6).map((phase) => (
                                        <div
                                            key={phase.id}
                                            className={`phase-indicator status-${phase.status}`}
                                            title={`${phase.name}: ${phase.status}`}
                                        ></div>
                                    ))}
                                    {session.phases.length > 6 && (
                                        <div className="phase-indicator-more">
                                            +{session.phases.length - 6}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
