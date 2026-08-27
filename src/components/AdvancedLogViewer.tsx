import { useState, useEffect, useRef } from 'react'
import './AdvancedLogViewer.css'

interface LogEntry {
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
}

interface Phase {
    id: string
    name: string
    status: string
    logs?: LogEntry[]
}

interface AdvancedLogViewerProps {
    phases: Phase[]
    autoScroll?: boolean
}

export default function AdvancedLogViewer({ phases, autoScroll = true }: AdvancedLogViewerProps) {
    // Filter state
    const [searchTerm, setSearchTerm] = useState('')
    const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all')
    const [phaseFilter, setPhaseFilter] = useState<'all' | string>('all')
    const [followMode, setFollowMode] = useState(autoScroll)

    // Export state
    const [showExportMenu, setShowExportMenu] = useState(false)

    // Refs
    const logContainerRef = useRef<HTMLDivElement>(null)
    const bottomRef = useRef<HTMLDivElement>(null)

    // Collect all logs from all phases
    const allLogs: Array<LogEntry & { phaseId: string; phaseName: string; lineNumber: number }> = []
    let lineNumber = 1

    phases.forEach(phase => {
        if (phase.logs && phase.logs.length > 0) {
            phase.logs.forEach(log => {
                allLogs.push({
                    ...log,
                    phaseId: phase.id,
                    phaseName: phase.name,
                    lineNumber: lineNumber++
                })
            })
        }
    })

    // Filter logs
    const filteredLogs = allLogs.filter(log => {
        // Level filter
        if (levelFilter !== 'all' && log.level !== levelFilter) return false

        // Phase filter
        if (phaseFilter !== 'all' && log.phaseId !== phaseFilter) return false

        // Search filter
        if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false

        return true
    })

    // Auto-scroll effect
    useEffect(() => {
        if (followMode && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [filteredLogs, followMode])

    // Export functions
    const exportAsJSON = () => {
        const data = JSON.stringify(filteredLogs, null, 2)
        downloadFile(data, 'logs.json', 'application/json')
    }

    const exportAsText = () => {
        const text = filteredLogs.map(log =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.phaseName}] ${log.message}`
        ).join('\n')
        downloadFile(text, 'logs.txt', 'text/plain')
    }

    const exportAsCSV = () => {
        const headers = 'Line,Timestamp,Level,Phase,Message\n'
        const rows = filteredLogs.map(log =>
            `${log.lineNumber},"${log.timestamp}","${log.level}","${log.phaseName}","${log.message.replace(/"/g, '""')}"`
        ).join('\n')
        downloadFile(headers + rows, 'logs.csv', 'text/csv')
    }

    const downloadFile = (content: string, filename: string, mimeType: string) => {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
        setShowExportMenu(false)
    }

    // Get log level icon and color
    const getLogIcon = (level: string) => {
        switch (level) {
            case 'error': return '❌'
            case 'warn': return '⚠️'
            case 'info': return 'ℹ️'
            case 'debug': return '🔍'
            default: return '📝'
        }
    }

    // Count logs by level
    const logCounts = {
        total: allLogs.length,
        info: allLogs.filter(l => l.level === 'info').length,
        warn: allLogs.filter(l => l.level === 'warn').length,
        error: allLogs.filter(l => l.level === 'error').length,
        debug: allLogs.filter(l => l.level === 'debug').length
    }

    return (
        <div className="advanced-log-viewer">
            {/* Header with filters */}
            <div className="log-viewer-header">
                <div className="log-filters">
                    {/* Search */}
                    <div className="filter-group">
                        <input
                            type="text"
                            className="log-search"
                            placeholder="🔍 Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Level filter */}
                    <div className="filter-group">
                        <select
                            className="log-level-filter"
                            value={levelFilter}
                            onChange={(e) => setLevelFilter(e.target.value as typeof levelFilter)}
                            title="Filter logs by level"
                        >
                            <option value="all">All Levels ({logCounts.total})</option>
                            <option value="info">ℹ️ Info ({logCounts.info})</option>
                            <option value="warn">⚠️ Warn ({logCounts.warn})</option>
                            <option value="error">❌ Error ({logCounts.error})</option>
                            <option value="debug">🔍 Debug ({logCounts.debug})</option>
                        </select>
                    </div>

                    {/* Phase filter */}
                    <div className="filter-group">
                        <select
                            className="log-phase-filter"
                            value={phaseFilter}
                            onChange={(e) => setPhaseFilter(e.target.value)}
                            title="Filter logs by phase"
                        >
                            <option value="all">All Phases</option>
                            {phases.map(phase => (
                                <option key={phase.id} value={phase.id}>
                                    {phase.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="log-actions">
                    {/* Follow mode toggle */}
                    <button
                        className={`log-action-btn ${followMode ? 'active' : ''}`}
                        onClick={() => setFollowMode(!followMode)}
                        title="Auto-scroll to bottom"
                    >
                        {followMode ? '📌 Following' : '📌 Follow'}
                    </button>

                    {/* Export menu */}
                    <div className="export-menu-container">
                        <button
                            className="log-action-btn"
                            onClick={() => setShowExportMenu(!showExportMenu)}
                        >
                            💾 Export
                        </button>
                        {showExportMenu && (
                            <div className="export-menu">
                                <button onClick={exportAsJSON}>📄 JSON</button>
                                <button onClick={exportAsText}>📝 Text</button>
                                <button onClick={exportAsCSV}>📊 CSV</button>
                            </div>
                        )}
                    </div>

                    {/* Clear filters */}
                    {(searchTerm || levelFilter !== 'all' || phaseFilter !== 'all') && (
                        <button
                            className="log-action-btn clear-btn"
                            onClick={() => {
                                setSearchTerm('')
                                setLevelFilter('all')
                                setPhaseFilter('all')
                            }}
                        >
                            🗑️ Clear Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Log stats */}
            <div className="log-stats">
                <span className="log-stat">
                    Showing {filteredLogs.length} of {allLogs.length} logs
                </span>
                {filteredLogs.length < allLogs.length && (
                    <span className="log-stat filtered">
                        ({allLogs.length - filteredLogs.length} filtered out)
                    </span>
                )}
            </div>

            {/* Log container */}
            <div className="log-container" ref={logContainerRef}>
                {filteredLogs.length === 0 ? (
                    <div className="log-empty">
                        {allLogs.length === 0 ? (
                            <>
                                <div className="empty-icon">📋</div>
                                <div className="empty-text">No logs available</div>
                            </>
                        ) : (
                            <>
                                <div className="empty-icon">🔍</div>
                                <div className="empty-text">No logs match your filters</div>
                                <button
                                    className="reset-filters-btn"
                                    onClick={() => {
                                        setSearchTerm('')
                                        setLevelFilter('all')
                                        setPhaseFilter('all')
                                    }}
                                >
                                    Reset Filters
                                </button>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="log-entries">
                        {filteredLogs.map((log, index) => (
                            <div key={index} className={`log-entry log-${log.level}`}>
                                <span className="log-line-number">{log.lineNumber}</span>
                                <span className="log-timestamp">{log.timestamp}</span>
                                <span className={`log-level level-${log.level}`}>
                                    {getLogIcon(log.level)} {log.level.toUpperCase()}
                                </span>
                                <span className="log-phase">[{log.phaseName}]</span>
                                <span className="log-message">{log.message}</span>
                            </div>
                        ))}
                        <div ref={bottomRef}></div>
                    </div>
                )}
            </div>
        </div>
    )
}
