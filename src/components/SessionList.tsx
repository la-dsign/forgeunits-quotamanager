import './SessionList.css'

interface Session {
    id: string
    operationName: string
    status: string
    overallProgress: number
    completedPhases: number
    totalPhases: number
}

interface SessionListProps {
    sessions: Session[]
    selectedId: string | null
    onSelect: (id: string) => void
}

function SessionList({ sessions, selectedId, onSelect }: SessionListProps) {
    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return '⏸️'
            case 'in-progress': return '⚡'
            case 'completed': return '✅'
            case 'failed': return '❌'
            default: return '❓'
        }
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'pending': return 'status-pending'
            case 'in-progress': return 'status-progress'
            case 'completed': return 'status-completed'
            case 'failed': return 'status-failed'
            default: return ''
        }
    }

    return (
        <div className="session-list">
            {sessions.length === 0 ? (
                <div className="empty-sessions">
                    <div className="empty-icon">📭</div>
                    <p>No sessions found</p>
                    <small>Try adjusting your filters or create a new session via the API</small>
                </div>
            ) : (
                sessions.map(session => (
                    <div
                        key={session.id}
                        className={`session-card ${selectedId === session.id ? 'selected' : ''} ${getStatusClass(session.status)}`}
                        onClick={() => onSelect(session.id)}
                    >
                        <div className="session-header">
                            <span className="status-icon">{getStatusIcon(session.status)}</span>
                            <span className="operation-name">{session.operationName}</span>
                        </div>
                        <div className="session-progress">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${session.overallProgress}%` }}
                                ></div>
                            </div>
                            <span className="progress-text">{session.overallProgress.toFixed(0)}%</span>
                        </div>
                        <div className="session-footer">
                            <small>{session.completedPhases}/{session.totalPhases} phases</small>
                            <small className={`status-badge ${getStatusClass(session.status)}`}>
                                {session.status}
                            </small>
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

export default SessionList
