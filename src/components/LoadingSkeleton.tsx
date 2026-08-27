import React from 'react';
import './LoadingSkeleton.css';

interface LoadingSkeletonProps {
    count?: number;
}

export const SessionListSkeleton: React.FC<LoadingSkeletonProps> = ({ count = 3 }) => {
    return (
        <div className="skeleton-container">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="skeleton-session-card">
                    <div className="skeleton-header">
                        <div className="skeleton-status-icon"></div>
                        <div className="skeleton-title"></div>
                    </div>
                    <div className="skeleton-progress-bar"></div>
                    <div className="skeleton-footer">
                        <div className="skeleton-text small"></div>
                        <div className="skeleton-text small"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const SessionDetailSkeleton: React.FC = () => {
    return (
        <div className="skeleton-detail">
            <div className="skeleton-detail-header">
                <div className="skeleton-title large"></div>
            </div>
            <div className="skeleton-stats-grid">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="skeleton-stat-card">
                        <div className="skeleton-text small"></div>
                        <div className="skeleton-text large"></div>
                    </div>
                ))}
            </div>
            <div className="skeleton-phases">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="skeleton-phase-card">
                        <div className="skeleton-phase-badge"></div>
                        <div className="skeleton-phase-content">
                            <div className="skeleton-text"></div>
                            <div className="skeleton-progress-bar small"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
