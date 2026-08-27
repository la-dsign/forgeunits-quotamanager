import './SessionDetail.css'
import { PhaseLogsViewer } from './PhaseLogsViewer'
import SessionControlPanel from './SessionControlPanel'
import AdvancedLogViewer from './AdvancedLogViewer'

interface Phase {
    id: string
    name: string
    status: string
    progress: number
    duration?: number
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

interface SessionDetailProps {
    session: Session
    onToast?: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void
}

function SessionDetail({ session, onToast }: SessionDetailProps) {
    // Event handlers for session control
    const handleStartSession = async (sessionId: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/start`, {
                method: 'POST'
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            onToast?.('success', 'Session started successfully')
        } catch (error) {
            console.error('Failed to start session:', error)
            onToast?.('error', 'Failed to start session')
        }
    }

    const handleCancelSession = async (sessionId: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/cancel`, {
                method: 'POST'
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            onToast?.('success', 'Session cancelled')
        } catch (error) {
            console.error('Failed to cancel session:', error)
            onToast?.('error', 'Failed to cancel session')
        }
    }

    const handleRestartSession = async (sessionId: string) => {
        try {
            const response = await fetch(`http://localhost:3000/api/sessions/${sessionId}/restart`, {
                method: 'POST'
            })
            if (!response.ok) throw new Error(`HTTP ${response.status}`)
            onToast?.('success', 'Session restarted')
        } catch (error) {
            console.error('Failed to restart session:', error)
            onToast?.('error', 'Failed to restart session')
        }
    }

    const getPhaseIcon = (status: string) => {
        switch (status) {
            case 'pending': return '⏸️'
            case 'in-progress': return '⚡'
            case 'completed': return '✅'
            case 'failed': return '❌'
            case 'skipped': return '⏭️'
            default: return '❓'
        }
    }

    const formatDuration = (ms: number | null | undefined) => {
        if (!ms) return '-'
        if (ms < 1000) return `${ms}ms`
        return `${(ms / 1000).toFixed(1)}s`
    }

    const formatTime = (timestamp: number | null) => {
        if (!timestamp) return '-'
        return new Date(timestamp).toLocaleTimeString()
    }

    return (
        <div className="session-detail">
            <div className="detail-header">
                <h2>{session.operationName}</h2>
                <div className="session-stats">
                    <div className="stat">
                        <span className="stat-label">Status</span>
                        <span className={`stat-value status-${session.status}`}>
                            {session.status}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Progress</span>
                        <span className="stat-value">{session.overallProgress.toFixed(0)}%</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Phases</span>
                        <span className="stat-value">
                            {session.completedPhases}/{session.totalPhases}
                        </span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Duration</span>
                        <span className="stat-value">{formatDuration(session.duration)}</span>
                    </div>
                    <div className="stat">
                        <span className="stat-label">Start Time</span>
                        <span className="stat-value">{formatTime(session.startTime)}</span>
                    </div>
                </div>
            </div>

            {/* Session Control Panel */}
            <SessionControlPanel
                session={session}
                onStartSession={handleStartSession}
                onCancelSession={handleCancelSession}
                onRestartSession={handleRestartSession}
            />

            <div className="phases-container">
                <h3>Phases</h3>
                <div className="phases-list">
                    {session.phases.map((phase, index) => (
                        <div key={phase.id} className={`phase-card status-${phase.status}`}>
                            <div className="phase-header">
                                <span className="phase-number">{index + 1}</span>
                                <span className="phase-icon">{getPhaseIcon(phase.status)}</span>
                                <span className="phase-name">{phase.name}</span>
                                <span className="phase-duration">{formatDuration(phase.duration)}</span>
                            </div>
                            {phase.status === 'in-progress' && (
                                <div className="phase-progress">
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${phase.progress}%` }}
                                        ></div>
                                    </div>
                                    <span className="progress-text">{phase.progress.toFixed(0)}%</span>
                                </div>
                            )}
                            {(phase.status === 'completed' || phase.status === 'failed' || phase.status === 'in-progress') && (
                                <PhaseLogsViewer phase={phase} />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Advanced Log Viewer */}
            <div className="logs-section">
                <h3>Session Logs</h3>
                <AdvancedLogViewer phases={session.phases} autoScroll={true} />
            </div>
        </div>
    )
}

export default SessionDetail
