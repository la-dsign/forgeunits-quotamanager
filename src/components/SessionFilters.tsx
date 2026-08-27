import { useState } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import './SessionFilters.css';

export interface FilterOptions {
    search: string;
    status: 'all' | 'pending' | 'in-progress' | 'completed' | 'failed';
}

interface SessionFiltersProps {
    filters: FilterOptions;
    onFilterChange: (filters: FilterOptions) => void;
    sessionCount: number;
    filteredCount: number;
}

export const SessionFilters: React.FC<SessionFiltersProps> = ({
    filters,
    onFilterChange,
    sessionCount,
    filteredCount
}) => {
    // Local state for immediate UI update
    const [searchInput, setSearchInput] = useState(filters.search)

    // Debounced value that updates after 300ms
    const debouncedSearch = useDebounce(searchInput, 300)

    // Update parent when debounced value changes
    useState(() => {
        if (debouncedSearch !== filters.search) {
            onFilterChange({ ...filters, search: debouncedSearch })
        }
    })

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchInput(e.target.value)
    };

    const handleStatusChange = (status: FilterOptions['status']) => {
        onFilterChange({ ...filters, status });
    };

    const clearFilters = () => {
        setSearchInput('')
        onFilterChange({ search: '', status: 'all' });
    };

    const hasActiveFilters = searchInput !== '' || filters.status !== 'all';

    return (
        <div className="session-filters">
            <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Search sessions..."
                    value={searchInput}
                    onChange={handleSearchChange}
                    className="search-input"
                />
                {searchInput && (
                    <button
                        className="clear-search"
                        onClick={() => {
                            setSearchInput('')
                            onFilterChange({ ...filters, search: '' })
                        }}
                        title="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>

            <div className="status-filters">
                <button
                    className={`filter-btn ${filters.status === 'all' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('all')}
                >
                    All ({sessionCount})
                </button>
                <button
                    className={`filter-btn ${filters.status === 'pending' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('pending')}
                >
                    ⏸️ Pending
                </button>
                <button
                    className={`filter-btn ${filters.status === 'in-progress' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('in-progress')}
                >
                    ⚡ Active
                </button>
                <button
                    className={`filter-btn ${filters.status === 'completed' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('completed')}
                >
                    ✅ Done
                </button>
                <button
                    className={`filter-btn ${filters.status === 'failed' ? 'active' : ''}`}
                    onClick={() => handleStatusChange('failed')}
                >
                    ❌ Failed
                </button>
            </div>

            <div className="filter-info">
                {hasActiveFilters && (
                    <>
                        <span className="results-count">
                            Showing {filteredCount} of {sessionCount}
                        </span>
                        <button className="clear-filters" onClick={clearFilters}>
                            Clear filters
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
