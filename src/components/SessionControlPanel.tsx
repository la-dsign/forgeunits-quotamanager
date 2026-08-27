import './SessionControlPanel.css'

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
    phases: Phase[]
}

interface SessionControlPanelProps {
    session: Session
    onStartSession?: (sessionId: string) => void
    onPauseSession?: (sessionId: string) => void
    onResumeSession?: (sessionId: string) => void
    onCancelSession?: (sessionId: string) => void
    onRestartSession?: (sessionId: string) => void
}

export default function SessionControlPanel({
    session,
    onStartSession,
    onPauseSession,
    onResumeSession,
    onCancelSession,
    onRestartSession
}: SessionControlPanelProps) {
    const handleStart = () => {
        if (onStartSession) onStartSession(session.id)
    }

    const handlePause = () => {
        if (onPauseSession) onPauseSession(session.id)
    }

    const handleResume = () => {
        if (onResumeSession) onResumeSession(session.id)
    }

    const handleCancel = () => {
        if (confirm('Are you sure you want to cancel this session?')) {
            if (onCancelSession) onCancelSession(session.id)
        }
    }

    const handleRestart = () => {
        if (confirm('Are you sure you want to restart this session?')) {
            if (onRestartSession) onRestartSession(session.id)
        }
    }

    const isPending = session.status === 'pending'
    const isInProgress = session.status === 'in-progress'
    const isCompleted = session.status === 'completed'
    const isFailed = session.status === 'failed'
    const canStart = isPending
    const canPause = isInProgress
    const canResume = false // Pausado no implementado en backend aún
    const canCancel = isInProgress
    const canRestart = isCompleted || isFailed

    return (
        <div className="control-panel">
            <h3>🎮 Session Controls</h3>

            <div className="control-buttons">
                {canStart && (
                    <button
                        className="control-btn start"
                        onClick={handleStart}
                        title="Start session execution"
                    >
                        ▶️ Start
                    </button>
                )}

                {canPause && (
                    <button
                        className="control-btn pause"
                        onClick={handlePause}
                        disabled
                        title="Pause not implemented yet"
                    >
                        ⏸️ Pause
                    </button>
                )}

                {canResume && (
                    <button
                        className="control-btn resume"
                        onClick={handleResume}
                        title="Resume paused session"
                    >
                        ▶️ Resume
                    </button>
                )}

                {canCancel && (
                    <button
                        className="control-btn cancel"
                        onClick={handleCancel}
                        title="Cancel running session"
                    >
                        ⏹️ Cancel
                    </button>
                )}

                {canRestart && (
                    <button
                        className="control-btn restart"
                        onClick={handleRestart}
                        title="Restart session from beginning"
                    >
                        🔄 Restart
                    </button>
                )}
            </div>

            <div className="control-info">
                <p className="control-status">
                    <span className="label">Status:</span>
                    <span className={`value status-${session.status}`}>
                        {session.status.replace('-', ' ')}
                    </span>
                </p>
                <p className="control-phases">
                    <span className="label">Phases:</span>
                    <span className="value">
                        {session.phases.filter(p => p.status === 'completed').length} / {session.phases.length} completed
                    </span>
                </p>
            </div>
        </div>
    )
}
