import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { getPreviousPeriodKey, getNextPeriodKey } from "../utils/period";
import styles from '../styles/Report.module.scss'
import { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { formatPeriodLabel } from "../utils/formatPeriodLabel";
import { useSelector } from "react-redux";

interface ReportLetter {
    id: string;
    periodKey: string;                          // e.g. "2026-W17"
    status: "pending" | "processing" | "completed" | "failed";
    paragraphs: string[];                       // 2-4 body paragraphs from LLM
    generatedAt?: string;                       // ISO timestamp
    errorMessage?: string;
}

interface ReportData {
    report?: ReportLetter;
    status?: string;
    message?: string;
}


interface AvailablePeriods {
    weekly: { earliest: string; latest: string };
}

// ---- Mock data for preview --------------------------------------------------
// To preview the design, swap the real query for MOCK_LETTER:
//   const data: ReportData = { report: MOCK_LETTER };
// Remove this once the backend is wired up.
export const MOCK_LETTER: ReportLetter = {
    id: "mock-letter-1",
    periodKey: "2026-W17",
    status: "completed",
    paragraphs: [
        "You wrote 12 notes this week. Across three days, your thinking on the career change moved from 'maybe in another six months' to 'updating my résumé tomorrow'.",
        "I noticed something — you used the word 'uncertain' three times. But each time, the next note contained the word 'decided' or 'tomorrow'. You seem to be using writing itself to convert uncertainty into resolve.",
        "The heaviest note this week was the 800-word entry on Wednesday night. It was the first time you placed 'engineering honesty' and 'agent culture' next to each other on the page.",
        "One more thing — you haven't mentioned 'the Tokyo job' in four weeks now. But this week, you mentioned 'remote' three times.",
    ],
    generatedAt: "2026-04-28T03:00:00Z",
};

const ReportPage = () => {
    const queryClient = useQueryClient()

    // Get the user name from Redux. Fallback to "you" so the greeting still
    // reads naturally for unauthenticated edge cases.
    const username = useSelector(
        (state: any) => state?.auth?.user?.username as string | undefined
    );
    const greetingName = username || "you";

    // ---- Available periods (weekly only) ----------------------------------
    const { data: availablePeriods } = useQuery<{ periods: AvailablePeriods }>({
        queryKey: ["available-periods"],
        queryFn: async () =>
            api.get("/reports/available-periods").then((res) => res.data),
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const [selectedPeriod, setSelectedPeriod] = useState<string>("");

    // Default to the latest weekly period when it becomes known.
    useEffect(() => {
        if (!availablePeriods) return;
        const latest = availablePeriods.periods?.weekly?.latest;
        setSelectedPeriod(latest ?? "");
    }, [availablePeriods]);

    // ---- Fetch the letter for the selected week --------------------------
    const isInProgress = (status?: string) =>
        status === 'pending' || status === 'processing'

    const { data, isLoading } = useQuery<ReportData>({
        queryKey: ["report", "weekly", selectedPeriod],
        queryFn: () => {
            if (!selectedPeriod) return Promise.reject("No selectedPeriod");
            return api
                .get(`/reports/weekly`, {
                    params: { selectedWeekPeriod: selectedPeriod },
                })
                .then((res) => res.data);
        },

        enabled: !!selectedPeriod, // ensure selectedPeriod is ready
        retry: 1,
        staleTime: 1000 * 60 * 60 * 24,
        // Keep polling while the letter is being written so the user doesn't
        // have to refresh manually.
        refetchInterval: (query) =>
            isInProgress(query.state.data?.report?.status) ? 5000 : false,
    })

    const report = data?.report

    // ---- Retry on failure -------------------------------------------------
    const retryReport = async () => {
        if (!report?.id) return;
        try {
            await api.post(`/reports/retry/${report.id}`);
            queryClient.invalidateQueries({
                queryKey: ["report", "weekly", selectedPeriod],
            });
        } catch (err) {
            console.error(err);
            toast.error("Couldn't retry — please try again later");
        }
    };

    // ---- Boundary checks for prev/next navigation ------------------------
    const earliest = availablePeriods?.periods?.weekly?.earliest;
    const latest = availablePeriods?.periods?.weekly?.latest;

    const isAtEarliest =
        !!earliest && !!selectedPeriod && selectedPeriod <= earliest;
    const isAtLatest =
        !!latest && !!selectedPeriod && selectedPeriod >= latest;

    const goPrev = () => {
        if (!selectedPeriod || isAtEarliest) return;
        setSelectedPeriod(getPreviousPeriodKey(selectedPeriod));
    };

    const goNext = () => {
        if (!selectedPeriod || isAtLatest) return;
        setSelectedPeriod(getNextPeriodKey(selectedPeriod));
    };

    // ---- Derived display values ------------------------------------------
    const periodLabel = useMemo(
        () => (selectedPeriod ? formatPeriodLabel(selectedPeriod) : ""),
        [selectedPeriod]
    );

    const generatedLabel = useMemo(() => {
        if (!report?.generatedAt) return "";
        const d = new Date(report.generatedAt);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }, [report?.generatedAt]);

    // const generateTest = () => {
    //     api.post('/reports/generate', {
    //         type: "weekly",
    //         periodKey: "2026-W13"
    //     })
    // }

    // ---- Render -----------------------------------------------------------
    return (
        <div className={styles.page}>
            <div className={styles.shell}>
                {/* Period navigator — like flipping pages of a journal */}
                <PeriodNavigator
                    label={periodLabel}
                    onPrev={goPrev}
                    onNext={goNext}
                    canPrev={!isLoading && !isAtEarliest && !!selectedPeriod}
                    canNext={!isLoading && !isAtLatest && !!selectedPeriod}
                />

                {/* Body — one of: loading, generating, failed, empty, letter */}
                <ReportBody
                    isLoading={isLoading}
                    report={MOCK_LETTER}
                    greetingName={greetingName}
                    generatedLabel={generatedLabel}
                    onRetry={retryReport}
                />
            </div>
        </div>
    );
}

// ---- Period navigator -------------------------------------------------------
interface PeriodNavigatorProps {
    label: string;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}

const PeriodNavigator = ({
    label,
    onPrev,
    onNext,
    canPrev,
    canNext,
}: PeriodNavigatorProps) => (
    <nav className={styles.navigator} aria-label="Letter navigation">
        <button
            type="button"
            onClick={onPrev}
            disabled={!canPrev}
            className={styles.navButton}
            aria-label="Previous week"
        >
            <ChevronLeft />
            <span>Previous</span>
        </button>

        <div className={styles.navLabel}>
            <span className={styles.navCaption}>Letter for</span>
            <span className={styles.navPeriod}>{label || "—"}</span>
        </div>

        <button
            type="button"
            onClick={onNext}
            disabled={!canNext}
            className={`${styles.navButton} ${styles.navButtonRight}`}
            aria-label="Next week"
        >
            <span>Next</span>
            <ChevronRight />
        </button>
    </nav>
);

// ---- Body dispatcher (renders the right state) -----------------------------
interface ReportBodyProps {
    isLoading: boolean;
    report?: ReportLetter;
    greetingName: string;
    generatedLabel: string;
    onRetry: () => void;
}

const ReportBody = ({
    isLoading,
    report,
    greetingName,
    generatedLabel,
    onRetry,
}: ReportBodyProps) => {
    // 1. Initial loading: no data yet, query is fetching.
    if (isLoading && !report) {
        return <LoadingState message="Pulling out the page..." />;
    }

    // 2. Generation in progress (pending / processing).
    if (report && (report.status === "pending" || report.status === "processing")) {
        return <GeneratingState />;
    }

    // 3. Generation failed.
    if (report?.status === "failed") {
        return <FailedState onRetry={onRetry} message={report.errorMessage} />;
    }

    // 4. No report exists for this period (fresh week, not enough notes, etc.).
    if (!report) {
        return <EmptyState />;
    }

    // 5. Completed letter.
    return (
        <Letter
            greetingName={greetingName}
            paragraphs={report.paragraphs}
            generatedLabel={generatedLabel}
        />
    );
};


// ---- The Letter itself -----------------------------------------------------
interface LetterProps {
    greetingName: string;
    paragraphs: string[];
    generatedLabel: string;
}

const Letter = ({
    greetingName,
    paragraphs,
    generatedLabel,
}: LetterProps) => (
    <>
        <article className={styles.letter}>
            <p className={styles.greeting}>Dear {greetingName},</p>

            <div className={styles.body}>
                {paragraphs.map((p, i) => (
                    <p key={i} className={styles.paragraph}>
                        {p}
                    </p>
                ))}
            </div>

            <p className={styles.closing}>See you next week.</p>
        </article>

        {generatedLabel && (
            <div className={styles.postmark}>Generated {generatedLabel}</div>
        )}
    </>
);

// ---- State views -----------------------------------------------------------
const LoadingState = ({ message }: { message: string }) => (
    <div className={styles.stateCenter} role="status">
        <div className={styles.dots} aria-hidden="true">
            <span /><span /><span />
        </div>
        <p className={styles.stateMuted}>{message}</p>
    </div>
);

const GeneratingState = () => (
    <article className={`${styles.letter} ${styles.letterCenteredContent}`} aria-live="polite">
        <div className={styles.dots} aria-hidden="true">
            <span /><span /><span />
        </div>
        <p className={styles.generatingTitle}>Your letter is being written...</p>
        <p className={styles.generatingHint}>This page will update automatically.</p>
    </article>
);


const FailedState = ({
    onRetry,
    message,
}: {
    onRetry: () => void;
    message?: string;
}) => (
    <div className={styles.stateCenter}>
        <p className={styles.stateTitle}>The letter didn't make it through.</p>
        <p className={styles.stateMuted}>
            Something went wrong while writing this week's letter.
        </p>
        {message && <p className={styles.stateError}>{message}</p>}
        <button
            type="button"
            onClick={onRetry}
            className={styles.retryButton}
        >
            <RetryIcon />
            <span>Try again</span>
        </button>
    </div>
);

const EmptyState = () => (
    <div className={styles.stateCenter}>
        <div className={styles.emptyIcon} aria-hidden="true">
            <EnvelopeIcon />
        </div>
        <p className={styles.stateTitle}>This week's letter isn't ready yet.</p>
        <p className={styles.stateMuted}>
            Keep writing — there's still time this week.
        </p>
    </div>
);

// ---- Icons -----------------------------------------------------------------
const ChevronLeft = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M10 4l-4 4 4 4" />
    </svg>
);

const ChevronRight = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M6 4l4 4-4 4" />
    </svg>
);

const EnvelopeIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="24"
        height="24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 8l9 6 9-6" />
    </svg>
);

const RetryIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="13"
        height="13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M14 8a6 6 0 1 1-1.5-4" />
        <path d="M14 3v4h-4" />
    </svg>
);

export default ReportPage;