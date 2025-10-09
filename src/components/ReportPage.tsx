import React, { useState, useEffect } from "react";
import styles from "../styles/Report.module.scss"
import DateNavigator from "./DateNavigator";
import dayjs from "dayjs";

// === 配置 ===
const USE_MOCK = true //切换mock / 实际API

// === 类型定义 ===

interface NoteSample {
    id: string;
    summary: string;
    createdAt: string;
}

interface MostActive {
    label: string;
    count: number;
}

interface ReportData {
    range: "week" | "month" | "year";
    start: string;
    totalNotes: number;
    mostActive: MostActive;
    keywords: string[];
    sampleNotes: NoteSample[];
    aiSummary: string;
    highlight: string;
}

type Range = "week" | "month"

// === Mock 数据 ===
const mockReport: ReportData = {
    range: "month",
    start: "2025-03-01",
    totalNotes: 53,
    mostActive: { label: "2025-03-12", count: 8 },
    keywords: ["React", "AI 项目", "算法", "东京生活", "笔记", "TS", "SCSS", "前端"],
    sampleNotes: [
        { id: "n1", summary: "学习 React 的状态管理", createdAt: "2025-03-12" },
        { id: "n2", summary: "实现登录页面，完成 JWT 流程", createdAt: "2025-03-10" },
        { id: "n3", summary: "探索 AI 数据分析方法", createdAt: "2025-03-08" },
    ],
    aiSummary: "本月你主要集中在 React 学习和项目开发，整体产出稳定增长。",
    highlight: "在忙碌与期待之间，你正一步步靠近新的开始。",
};

// === 工具函数 ===
const formatDate = (date: Date): string =>
    date.toISOString().split("T")[0];

const ReportPage: React.FC = () => {
    const [range, setRange] = useState<"week" | "month" | "year">("month")
    const [startDate, setStartDate] = useState<string>(dayjs().format("YYYY-MM-DD"));
    const [report, setReport] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reportData, setReportData] = useState<any>(null);

    // === API 调用 ===
    const fetchReport = async () => {
        setLoading(true)
        setError(null)

        try {
            let data: ReportData;
            if (USE_MOCK) {
                await new Promise((r) => setTimeout(r, 500)) //模拟延迟
                data = { ...mockReport, range }
            } else {
                const res = await fetch(`/api/reports?range=${range}&`);
                if (!res.ok) throw new Error(`网络错误: ${res.status}`);
                data = await res.json();
            }
            setReport(data)
        } catch (err: any) {
            setError(err.message || "unknown error")
        } finally {
            setLoading(false)
        }
    }

    // === 初始加载 ===
    useEffect(() => {
        fetchReport();
    }, []);

    const getTitle = () => {
        return range === "week" ? "笔记周报" : "笔记月报";
    };

    return (
        <div className={styles.reportPage}>
            <h1 className={styles.title}>{getTitle()}</h1>
            {/* 控制区 */}
            <div className={styles.controls}>
                <div className={styles.controlGroup}>
                    <label htmlFor="range">报告范围:</label>
                    <select
                        className={styles.select}
                        value={range}
                        onChange={(e) => setRange(e.target.value as Range)}
                    >
                        <option value="week">周</option>
                        <option value="month">月</option>
                    </select>
                </div>

                <DateNavigator
                    range={range}
                    startDate={startDate}
                    onDateChange={(date) => setStartDate(date)}
                />


                {/* 生成报告按钮 */}
                <button className={styles.button} >
                    生成报告
                </button>
            </div>

            {/* 占位内容 */}
            {!reportData && (
                <div className={styles.placeholder}>
                    "Your notes journey starts here ✨ Keep recording your thoughts."
                </div>
            )}

            {/* 状态处理 */}
            {loading && <div className={styles.spinner}>加载中...</div>}
            {error && <div className={styles.error}>{error}</div>}
            {!loading && !error && report && (
                <div className={styles.reportContent}>
                    {/* 概览卡片 */}
                    <div className={styles.card}>
                        <h2>总笔记数</h2>
                        <p className={styles.large}>{report.totalNotes}</p>
                    </div>

                    <div className={styles.card}>
                        <h2>最活跃日期</h2>
                        <p>{report.mostActive.label}</p>
                        <p>笔记数: {report.mostActive.count}</p>
                    </div>

                    {/* 关键词标签 */}
                    <div className={styles.card}>
                        <h2>高频关键词</h2>
                        <div className={styles.tags}>
                            {report.keywords.slice(0, 8).map((kw) => (
                                <span
                                    key={kw}
                                    className={styles.tag}
                                    title={`关键词: ${kw}`}
                                >
                                    {kw}
                                </span>
                            ))}
                        </div>
                    </div>


                    {/* AI 总结 */}
                    <div className={styles.card}>
                        <h2>AI 总结</h2>
                        <p>{report.aiSummary}</p>
                        <blockquote>{report.highlight}</blockquote>
                    </div>

                    {/* 数据不足提示 */}
                    {report.totalNotes < 5 && (
                        <div className={styles.warning}>
                            数据不足，建议选择更长周期或继续记录笔记。
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ReportPage