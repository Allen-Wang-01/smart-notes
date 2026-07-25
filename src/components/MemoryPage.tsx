import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import styles from '../styles/MemoryPage.module.scss'

// ---- Types -----------------------------------------------------------------

interface TopicSummary {
    topic: string
    count: number
    lastUpdated: string
}

interface TopicsResponse {
    topicCount: number
    topics: TopicSummary[]
}

interface MemoryEntry {
    content: string
    source: 'user' | 'claude'
    tags: string[]
    createdAt: string
}

interface TopicEntriesResponse {
    topic: string
    entryCount: number
    entries: MemoryEntry[]
}

// ---- Helpers ---------------------------------------------------------------

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

// ---- Sub-components --------------------------------------------------------

function LoadingState() {
    return (
        <div className={styles.stateCenter}>
            <div className={styles.dots}>
                <span /><span /><span />
            </div>
            <p className={styles.stateMuted}>Loading memories…</p>
        </div>
    )
}

function ErrorState({ message }: { message: string }) {
    return (
        <div className={styles.stateCenter}>
            <p className={styles.stateTitle}>Something went wrong</p>
            <p className={styles.stateError}>{message}</p>
        </div>
    )
}

function EmptyTopicsState() {
    return (
        <div className={styles.stateCenter}>
            <div className={styles.emptyIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
            </div>
            <p className={styles.stateTitle}>No memories yet</p>
            <p className={styles.stateMuted}>
                Ask Claude to remember something, or save a note manually.
            </p>
        </div>
    )
}

// ---- Topic list view -------------------------------------------------------

interface TopicListProps {
    data: TopicsResponse
    onSelect: (topic: string) => void
}

function TopicList({ data, onSelect }: TopicListProps) {
    if (data.topicCount === 0) return <EmptyTopicsState />

    return (
        <div className={styles.topicList}>
            {data.topics.map((t) => (
                <button
                    key={t.topic}
                    className={styles.topicCard}
                    onClick={() => onSelect(t.topic)}
                >
                    <span className={styles.topicName}>{t.topic}</span>
                    <span className={styles.topicMeta}>
                        <span className={styles.topicCount}>
                            {t.count} {t.count === 1 ? 'entry' : 'entries'}
                        </span>
                        <span className={styles.topicArrow}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                        </span>
                    </span>
                </button>
            ))}
        </div>
    )
}

// ---- Topic detail view -----------------------------------------------------

interface TopicDetailProps {
    topic: string
    onBack: () => void
}

function TopicDetail({ topic, onBack }: TopicDetailProps) {
    const { data, isLoading, isError, error } = useQuery<TopicEntriesResponse>({
        queryKey: ['saved-memory-topic', topic],
        queryFn: () =>
            api.get(`/saved-memories/topics/${encodeURIComponent(topic)}`).then((r) => r.data),
        staleTime: 30_000,
    })

    return (
        <>
            <button className={styles.backButton} onClick={onBack}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                </svg>
                All topics
            </button>

            {isLoading && <LoadingState />}

            {isError && (
                <ErrorState message={(error as Error)?.message ?? 'Failed to load entries'} />
            )}

            {data && (
                <>
                    <div className={styles.detailHeader}>
                        <h2 className={styles.detailTitle}>{data.topic}</h2>
                        <p className={styles.detailMeta}>
                            {data.entryCount} {data.entryCount === 1 ? 'entry' : 'entries'}
                        </p>
                    </div>

                    {data.entryCount === 0 ? (
                        <div className={styles.stateCenter}>
                            <p className={styles.stateMuted}>No entries under this topic.</p>
                        </div>
                    ) : (
                        <div className={styles.entryList}>
                            {data.entries.map((entry, i) => (
                                <div
                                    key={`${entry.createdAt}-${i}`}
                                    className={styles.entryCard}
                                    style={{ animationDelay: `${i * 30}ms` }}
                                >
                                    <div className={styles.entryHeader}>
                                        <span className={styles.entryDate}>
                                            {formatDate(entry.createdAt)}
                                        </span>
                                        <span
                                            className={`${styles.sourceBadge} ${
                                                entry.source === 'user'
                                                    ? styles.sourceBadgeUser
                                                    : styles.sourceBadgeClaude
                                            }`}
                                        >
                                            {entry.source === 'user' ? 'You' : 'Claude'}
                                        </span>
                                    </div>

                                    <p className={styles.entryContent}>{entry.content}</p>

                                    {entry.tags.length > 0 && (
                                        <div className={styles.entryTags}>
                                            {entry.tags.map((tag) => (
                                                <span key={tag} className={styles.tag}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </>
    )
}

// ---- Page root -------------------------------------------------------------

export default function MemoryPage() {
    const [selectedTopic, setSelectedTopic] = useState<string | null>(null)

    const { data, isLoading, isError, error } = useQuery<TopicsResponse>({
        queryKey: ['saved-memory-topics'],
        queryFn: () => api.get('/saved-memories/topics').then((r) => r.data),
        staleTime: 60_000,
    })

    return (
        <div className={styles.page}>
            <div className={styles.shell}>
                {!selectedTopic && (
                    <div className={styles.header}>
                        <h1 className={styles.title}>Memory</h1>
                        <p className={styles.subtitle}>
                            Things you or Claude have chosen to remember
                        </p>
                    </div>
                )}

                {selectedTopic ? (
                    <TopicDetail
                        topic={selectedTopic}
                        onBack={() => setSelectedTopic(null)}
                    />
                ) : isLoading ? (
                    <LoadingState />
                ) : isError ? (
                    <ErrorState message={(error as Error)?.message ?? 'Failed to load topics'} />
                ) : data ? (
                    <TopicList data={data} onSelect={setSelectedTopic} />
                ) : null}
            </div>
        </div>
    )
}
