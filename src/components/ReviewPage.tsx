import { useContext, useEffect, useState } from "react";
import NoteContext from "../context/NoteContext";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Tooltip, Legend } from "recharts";
import styles from '../styles/ReviewPage.module.scss'

const ReviewPage = () => {
    const noteContext = useContext(NoteContext)
    if (!noteContext) return null
    const { state } = noteContext

    const [summary, setSummary] = useState("")

    //统计数据
    const totalNotes = state.notes.length
    const categoryCount = state.notes.reduce((acc, note) => {
        acc[note.category] = (acc[note.category] || 0) + 1
        return acc
    }, {} as Record<string, number>)
    const topTopics = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1])
        .map(([key]) => key)
        .join(", ")

    const monthlyData = state.notes.reduce((acc, note) => {
        const month = new Date(note.date).getMonth() + 1
        acc[month] = (acc[month] || 0) + 1
        return acc
    }, {} as Record<number, number>)
    const chartData = Object.entries(monthlyData).map(([month, count]) => ({
        name: `${month}月`,
        count,
    }));
    const peakMonth = chartData.sort((a, b) => b.count - a.count)[0]?.name || "无";

    // 模拟关键词（后续用 Hugging Face 替换）
    const topKeywords = "优化, 挑战"; // 占位

    useEffect(() => {
        // 调用 Hugging Face API 生成总结
        const fetchSummary = async () => {
            const text = await generateSummary(totalNotes, topTopics, topKeywords, peakMonth);
            setSummary(text);
        };
        fetchSummary();
    }, []);

    return (
        <div className={styles.reviewPage}>
            <h1>2025 年度复盘</h1>
            <div className={styles.stats}>
                <p>总笔记数: {totalNotes}</p>
                <p>热门主题: {topTopics}</p>
                <p>关键词: {topKeywords}</p>
                <p>最高频月份: {peakMonth}</p>
            </div>
            <BarChart width={600} height={300} data={chartData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10a37f" />
            </BarChart>
            <div className={styles.summary}>
                <h2>你的年度总结</h2>
                <p>{summary || "生成中..."}</p>
            </div>
        </div>
    );
}

export default ReviewPage;