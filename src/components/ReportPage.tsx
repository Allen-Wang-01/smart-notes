import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axios";
import { getPreviousPeriodKey, getNextPeriodKey } from "../utils/period";
import styles from '../styles/Report.module.scss'
import ReportHeader from "./ReportHeader";
import ReportStats from "./ReportStats";
import ReportSummary from "./ReportSummary";
import ReportPoetic from "./ReportPoetic";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

interface ReportData {
    report?: any;
    status?: string;
    message?: string;
}


interface AvailablePeriods {
    weekly: { earliest: string; latest: string };
    monthly: { earliest: string; latest: string };
}

type ViewType = 'weekly' | 'monthly'

const ReportPage = () => {
    const [viewType, setViewType] = useState<ViewType>('weekly')
    const queryClient = useQueryClient()

    const { data: availablePeriods } = useQuery<{
        periods: AvailablePeriods;
    }>({
        queryKey: ["available-periods"],
        queryFn: async () =>
            api.get("/reports/available-periods").then((res) => res.data),
        staleTime: 1000 * 60 * 60, // 1 hour
    })
    const [selectedPeriod, setSelectedPeriod] = useState<string>("");

    useEffect(() => {
        if (!availablePeriods) return

        const latest = viewType === 'weekly'
            ? availablePeriods.periods.weekly.latest
            : availablePeriods.periods.monthly.latest
        setSelectedPeriod(latest)

        if (!latest) {
            setSelectedPeriod("");
            return;
        }
    }, [viewType, availablePeriods])

    const { data, isLoading } = useQuery<ReportData>({
        queryKey: ["report", viewType, selectedPeriod],
        queryFn: () => api.get(`/reports/${viewType}`, { params: { selectedWeekPeriod: selectedPeriod } })
            .then((res) => res.data),
        enabled: !!selectedPeriod, // ensure selectedPeriod is ready
        retry: 1,
        staleTime: 1000 * 60 * 60 * 24,
    })

    const report = data?.report

    const retryReport = async () => {
        if (!report?.id) return
        try {
            await api.post(`/reports/retry/${report.id}`)
            // refresh
            queryClient.invalidateQueries({ queryKey: ['report', viewType, selectedPeriod] })
        } catch (err) {
            console.error(err)
            toast.error("Retry failed")
        }
    }

    const goPrev = () => {
        if (!availablePeriods || !selectedPeriod) return

        const prev = getPreviousPeriodKey(selectedPeriod)
        const earliest =
            viewType === 'weekly'
                ? availablePeriods.periods.weekly.earliest
                : availablePeriods.periods.monthly.earliest

        if (earliest && prev < earliest) return
        setSelectedPeriod(prev)
    }

    const goNext = () => {
        if (!availablePeriods || !selectedPeriod) return

        const next = getNextPeriodKey(selectedPeriod)
        const latest =
            viewType === 'weekly'
                ? availablePeriods.periods.weekly.latest
                : availablePeriods.periods.monthly.latest

        if (latest && next > latest) return
        setSelectedPeriod(next)
    }

    // const generateTest = () => {
    //     api.post('/reports/generate', {
    //         type: "weekly",
    //         periodKey: "2025-W50"
    //     })
    // }

    return (
        <div className={styles.container}>
            <div className={styles.tabs}>
                <button className={viewType === 'weekly' ? styles.active : ''}
                    onClick={() => setViewType('weekly')}>
                    Weekly
                </button>

                <button className={viewType === 'monthly' ? styles.active : ''}
                    onClick={() => setViewType('monthly')}
                >
                    Monthly
                </button>
            </div>

            {/* <button onClick={generateTest}>
                generate test button
            </button> */}

            {/* period navigator */}
            {report && (
                <div className={styles.navigator}>
                    <button
                        className={styles.navButton}
                        onClick={goPrev}
                        disabled={isLoading}>
                        Previous
                    </button>
                    <span className={styles.currentPeriod}>
                        {selectedPeriod.replace('-', " ")}
                    </span>
                    <button
                        className={styles.navButton}
                        onClick={goNext}
                        disabled={isLoading}
                    >
                        Next
                    </button>
                </div>
            )}


            {isLoading && (
                <div className={styles.placeholder}>
                    <p>Loading your reflection...</p>
                </div>
            )}

            {/* Pending / processing */}
            {report?.status === 'pending' || report?.status === 'processing' ? (
                <div className={styles.placeholder}>
                    <p>Generating your {viewType} report...</p>
                    <p>Please check back in a moment.</p>
                </div>
            ) : null}


            {/* Failed */}
            {report?.status === 'failed' && (
                <div className={styles.empty}>
                    <p>Report generation failed.</p>
                    <p>You may retry later.</p>
                    <button
                        onClick={retryReport}
                        className={styles.retryButton}
                    >
                        Retry
                    </button>
                    {report.errorMessage && <p className={styles.errorMessage}>{report.errorMessage}</p>}
                </div>
            )}

            {/* No report */}
            {!report && (
                <div className={styles.empty}>
                    <p>No report for this period.</p>
                    <p>Start writing notes to see insights!</p>
                    <p>Report will be shown when it's ready!</p>
                </div>
            )}

            {/* Completed */}
            {report && report.status === 'completed' && (
                <>
                    <ReportHeader type={viewType} period={report.periodKey} />
                    <ReportStats stats={report.stats} />
                    <ReportSummary sentences={report.content} />
                    {report.poeticLine && <ReportPoetic line={report.poeticLine} />}
                </>
            )}
        </div>
    )
}

export default ReportPage;