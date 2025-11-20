import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { getWeeklyKey, getMonthlyKey, getPreviousPeriodKey } from "../utils/period";
import styles from '../styles/Report.module.scss'
import ReportHeader from "./ReportHeader";
import ReportStats from "./ReportStats";
import ReportSummary from "./ReportSummary";
import ReportPoetic from "./ReportPoetic";
import { useState, useEffect } from "react";

type ViewType = 'weekly' | 'monthly'

const ReportPage = () => {
    const [viewType, setViewType] = useState<ViewType>('weekly')

    //By default, display the latest report
    const today = new Date()
    const defaultWeeklyKey = getPreviousPeriodKey(getWeeklyKey(today)) //last week
    const defaultMonthlyKey = getPreviousPeriodKey(getMonthlyKey(today)) //last month

    const [selectedPeriod, setSelectdPeriod] = useState<string>(
        viewType === 'weekly' ? defaultWeeklyKey : defaultMonthlyKey
    )

    const fetchReport = (type: 'weekly' | 'monthly', params: any) => {
        return api.get(`/reports/${type}`, { params });
    };

    // load the lastest report automatically when switch between weekly/monthly
    useEffect(() => {
        setSelectdPeriod(viewType === 'weekly' ? defaultWeeklyKey : defaultMonthlyKey)
    }, [viewType, defaultWeeklyKey, defaultMonthlyKey])

    const getParams = () => {
        if (viewType === 'weekly') {
            const year = selectedPeriod.split('-W')[0]
            const week = selectedPeriod.split('-W')[1]
            const jan4 = new Date(parseInt(year), 0, 4)
            const start = new Date(jan4)
            start.setDate(jan4.getDate() + (parseInt(week) - 1) * 7 - jan4.getDay() + 1)
            return { date: start.toISOString().split('T')[0] }
        } else {
            const year = selectedPeriod.split('-M')[0]
            const month = selectedPeriod.split('-M')[1]
            return { year: parseInt(year), month: parseInt(month) }
        }
    }

    const { data, isLoading, error } = useQuery({
        queryKey: ['report', viewType, selectedPeriod],
        queryFn: () => fetchReport(viewType, getParams()),
        staleTime: 1000 * 60 * 60 * 24, //catched for 1 day, so it's fresh in 1 day
        retry: 1,
    })

    const report = data?.data?.report
    const streamUrl = data?.data?.streamUrl

    const goPrev = () => setSelectdPeriod(getPreviousPeriodKey(selectedPeriod))
    const goNext = () => {
        const next = getPreviousPeriodKey(getPreviousPeriodKey(selectedPeriod)) // next is the opposite
        const current = viewType === 'weekly' ? getWeeklyKey() : getMonthlyKey()
        // not allow to go beyond the current period
        if (next < current) setSelectdPeriod(getPreviousPeriodKey(selectedPeriod))
    }

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

            {/* period navigator */}
            <div className={styles.navigator}>
                <button onClick={goPrev} disabled={isLoading}>
                    Previous
                </button>
                <span className={styles.currentPeriod}>
                    {viewType === 'weekly'
                        ? `Week ${selectedPeriod.split('-W')[1]} · ${selectedPeriod.split('-')[0]}`
                        : `${selectedPeriod.replace('-M', ' / ')}`
                    }
                </span>
                <button onClick={goNext} disabled={isLoading ||
                    selectedPeriod === (viewType === 'weekly' ?
                        getPreviousPeriodKey(getWeeklyKey()) :
                        getPreviousPeriodKey(getMonthlyKey())
                    )}>
                    Next
                </button>
            </div>

            {isLoading && !streamUrl && (
                <div className={styles.placeholder}>
                    <p>Loading your reflection...</p>
                </div>
            )}

            {streamUrl && (
                <div className={styles.placeholder}>
                    <p>Crafting your {viewType} growth story...</p>
                </div>
            )}

            {!report && !isLoading && !streamUrl && (
                <div className={styles.empty}>
                    <p>No notes yet for this period.</p>
                    <p>Start writting today - your future self will thank you.</p>
                </div>
            )}

            {report && (
                <>
                    <ReportHeader type={viewType} period={report.periodKey} />
                    <ReportStats stats={report.stats} />
                    <ReportSummary sentences={report.content} streamUrl={streamUrl} reportId={report.id} />
                    {report.poeticLine && <ReportPoetic line={report.poeticLine} />}
                </>
            )}
        </div>
    )
}

export default ReportPage;