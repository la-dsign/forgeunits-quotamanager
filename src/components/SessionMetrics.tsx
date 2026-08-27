import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import './SessionMetrics.css'

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend
)

interface Session {
    id: string
    operationName: string
    status: string
    progress?: number  // Optional for compatibility with App.tsx
    overallProgress?: number  // Alternative name
    phases: Phase[]
    completedPhases?: number
    failedPhases?: number
    totalPhases?: number
    startTime?: string | number | null
    endTime?: string | number | null
    duration?: number | null
}

interface Phase {
    id: string
    name: string
    status: string
    progress: number
    duration?: number
    startTime?: string
    endTime?: string
}

interface SessionMetricsProps {
    sessions: Session[]
}

export default function SessionMetrics({ sessions }: SessionMetricsProps) {
    // Calculate metrics
    const totalSessions = sessions.length
    const completedSessions = sessions.filter(s => s.status === 'completed').length
    const failedSessions = sessions.filter(s => s.status === 'failed').length
    const inProgressSessions = sessions.filter(s => s.status === 'in-progress').length
    const pendingSessions = sessions.filter(s => s.status === 'pending').length

    const successRate = totalSessions > 0
        ? Math.round((completedSessions / totalSessions) * 100)
        : 0

    const avgDuration = sessions
        .filter(s => s.duration)
        .reduce((acc, s) => acc + (s.duration || 0), 0) / (completedSessions || 1)

    // Status distribution chart
    const statusData = {
        labels: ['Completed', 'Failed', 'In Progress', 'Pending'],
        datasets: [
            {
                label: 'Sessions by Status',
                data: [completedSessions, failedSessions, inProgressSessions, pendingSessions],
                backgroundColor: [
                    'rgba(0, 208, 132, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(100, 108, 255, 0.8)',
                    'rgba(156, 163, 175, 0.8)',
                ],
                borderColor: [
                    'rgba(0, 208, 132, 1)',
                    'rgba(239, 68, 68, 1)',
                    'rgba(100, 108, 255, 1)',
                    'rgba(156, 163, 175, 1)',
                ],
                borderWidth: 2,
            },
        ],
    }

    // Duration timeline (last 10 sessions)
    const recentSessions = sessions.slice(-10)
    const durationData = {
        labels: recentSessions.map(s =>
            s.operationName.length > 15
                ? s.operationName.substring(0, 15) + '...'
                : s.operationName
        ),
        datasets: [
            {
                label: 'Duration (seconds)',
                data: recentSessions.map(s => (s.duration || 0) / 1000),
                backgroundColor: 'rgba(100, 108, 255, 0.6)',
                borderColor: 'rgba(100, 108, 255, 1)',
                borderWidth: 2,
            },
        ],
    }

    // Phase completion rate
    const allPhases = sessions.flatMap(s => s.phases)
    const completedPhases = allPhases.filter(p => p.status === 'completed').length
    const failedPhases = allPhases.filter(p => p.status === 'failed').length
    const phaseCompletionRate = allPhases.length > 0
        ? Math.round((completedPhases / allPhases.length) * 100)
        : 0

    const phaseData = {
        labels: ['Completed', 'Failed', 'In Progress', 'Pending'],
        datasets: [
            {
                label: 'Phases',
                data: [
                    completedPhases,
                    failedPhases,
                    allPhases.filter(p => p.status === 'in-progress').length,
                    allPhases.filter(p => p.status === 'pending').length,
                ],
                backgroundColor: [
                    'rgba(0, 208, 132, 0.6)',
                    'rgba(239, 68, 68, 0.6)',
                    'rgba(100, 108, 255, 0.6)',
                    'rgba(156, 163, 175, 0.6)',
                ],
            },
        ],
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    color: '#9ca3af',
                    font: {
                        size: 11,
                    },
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)',
                },
                ticks: {
                    color: '#9ca3af',
                },
            },
            x: {
                grid: {
                    color: 'rgba(156, 163, 175, 0.1)',
                },
                ticks: {
                    color: '#9ca3af',
                },
            },
        },
    }

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right' as const,
                labels: {
                    color: '#9ca3af',
                    font: {
                        size: 11,
                    },
                },
            },
        },
    }

    return (
        <div className="session-metrics">
            <h2>📊 Metrics Dashboard</h2>

            {/* Summary Stats */}
            <div className="metrics-summary">
                <div className="metric-card">
                    <div className="metric-icon">📈</div>
                    <div className="metric-content">
                        <div className="metric-label">Total Sessions</div>
                        <div className="metric-value">{totalSessions}</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon">✅</div>
                    <div className="metric-content">
                        <div className="metric-label">Success Rate</div>
                        <div className="metric-value">{successRate}%</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon">⏱️</div>
                    <div className="metric-content">
                        <div className="metric-label">Avg Duration</div>
                        <div className="metric-value">{(avgDuration / 1000).toFixed(1)}s</div>
                    </div>
                </div>

                <div className="metric-card">
                    <div className="metric-icon">🎯</div>
                    <div className="metric-content">
                        <div className="metric-label">Phase Completion</div>
                        <div className="metric-value">{phaseCompletionRate}%</div>
                    </div>
                </div>
            </div>

            {/* Charts Grid */}
            <div className="charts-grid">
                <div className="chart-container">
                    <h3>Session Status Distribution</h3>
                    <div className="chart-wrapper">
                        <Doughnut data={statusData} options={doughnutOptions} />
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Recent Session Durations</h3>
                    <div className="chart-wrapper">
                        <Bar data={durationData} options={chartOptions} />
                    </div>
                </div>

                <div className="chart-container">
                    <h3>Phase Completion Stats</h3>
                    <div className="chart-wrapper">
                        <Bar data={phaseData} options={chartOptions} />
                    </div>
                </div>
            </div>
        </div>
    )
}
