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
import { formatPeriodLabel } from "../utils/formatPeriodLabel";

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
            ? availablePeriods.periods?.weekly?.latest
            : availablePeriods.periods?.monthly?.latest
        setSelectedPeriod(latest)

        setSelectedPeriod(latest ?? "")
    }, [viewType, availablePeriods])

    const isInProgress = (status?: string) =>
        status === 'pending' || status === 'processing'

    const { data, isLoading } = useQuery<ReportData>({
        queryKey: ["report", viewType, selectedPeriod],
        queryFn: () => {
            if (!selectedPeriod) {
                return Promise.reject('No selectedPeriod')
            }
            return api.get(`/reports/${viewType}`, {
                params:
                    viewType === 'weekly'
                        ? { selectedWeekPeriod: selectedPeriod }
                        : { selectedMonthPeriod: selectedPeriod },
            }).then((res) => res.data)
        },
        enabled: !!selectedPeriod, // ensure selectedPeriod is ready
        retry: 1,
        staleTime: 1000 * 60 * 60 * 24,
        // poll every 5s while report is pending/processing 
        // so user doesn't need to manually refresh
        refetchInterval: (query) =>
            isInProgress(query.state.data?.report?.status) ? 5000 : false,
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

    // Boundary checks for navigation
    const earliest = viewType === 'weekly'
        ? availablePeriods?.periods?.weekly?.earliest
        : availablePeriods?.periods?.monthly?.earliest

    const latest = viewType === 'weekly'
        ? availablePeriods?.periods?.weekly?.latest
        : availablePeriods?.periods?.monthly?.latest

    const isAtEarliest = !!earliest && !!selectedPeriod && selectedPeriod <= earliest
    const isAtLatest = !!latest && !!selectedPeriod && selectedPeriod >= latest

    const goPrev = () => {
        if (!selectedPeriod || isAtEarliest) return
        setSelectedPeriod(getPreviousPeriodKey(selectedPeriod))
    }

    const goNext = () => {
        if (!selectedPeriod || isAtLatest) return
        setSelectedPeriod(getNextPeriodKey(selectedPeriod))
    }

    // const generateTest = () => {
    //     api.post('/reports/generate', {
    //         type: "weekly",
    //         periodKey: "2026-W13"
    //     })
    // }

    return (
        <div className={styles.container}>
            <div className={styles.tabs}>
                <button className={viewType === 'weekly' ? styles.active : ''}
                    onClick={() => {
                        setSelectedPeriod("")
                        setViewType('weekly')
                    }}>
                    Weekly
                </button>

                <button className={viewType === 'monthly' ? styles.active : ''}
                    onClick={() => {
                        setSelectedPeriod("")
                        setViewType('monthly')
                    }}
                >
                    Monthly
                </button>
            </div>

            {/* <button onClick={generateTest}>
                generate test button
            </button> */}

            {/* period navigator */}
            {selectedPeriod && (
                <div className={styles.navigator}>
                    <button
                        className={styles.navButton}
                        onClick={goPrev}
                        disabled={isLoading || isAtEarliest}>
                        Previous
                    </button>
                    <span className={styles.currentPeriod}>
                        {formatPeriodLabel(selectedPeriod)}
                    </span>
                    <button
                        className={styles.navButton}
                        onClick={goNext}
                        disabled={isLoading || isAtLatest}
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
            {isLoading && isInProgress(report?.status) && (
                <div className={styles.placeholder}>
                    <p>Generating your {viewType} report...</p>
                    <p>This page will update automatically.</p>
                </div>
            )}


            {/* Failed */}
            {!isLoading && report?.status === 'failed' && (
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
            {!isLoading && !report && (
                <div className={styles.empty}>
                    <p>No report for this period.</p>
                    <p>Start writing notes to see insights here.</p>
                </div>
            )}

            {/* Completed */}
            {!isLoading && report?.status === 'completed' && (
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