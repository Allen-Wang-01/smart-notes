import React, { useState } from "react"

import dayjs from "dayjs"
import styles from "../styles/DateNavigator.module.scss"

export type RangeType = "week" | "month" | "year"

interface DateNavigatorProps {
    range: RangeType;
    startDate?: string;
    onDateChange: (date: string) => void;
}

const DateNavigator: React.FC<DateNavigatorProps> = ({
    range,
    startDate,
    onDateChange
}) => {
    const [currentDate, setCurrentDate] = useState(startDate ? dayjs(startDate) : dayjs())

    const changeDate = (direction: "prev" | "next") => {
        let newDate = currentDate
        if (range === "week") {
            newDate
                = direction === "prev"
                    ? currentDate.subtract(1, "week")
                    : currentDate.add(1, "week")
        } else if (range === "month") {
            newDate =
                direction === "prev"
                    ? currentDate.subtract(1, "month")
                    : currentDate.add(1, "month")
        } else if (range === "year") {
            newDate =
                direction === "prev"
                    ? currentDate.subtract(1, "year")
                    : currentDate.add(1, "year")
        }
        setCurrentDate(newDate)
    }

    const formatLabel = () => {
        if (range === "week") {
            const startOfWeek = currentDate.startOf("week").format("YYYY-MM-DD")
            const endOfWeek = currentDate.endOf("week").format("YYYY-MM-DD")
            return `${startOfWeek} ~ ${endOfWeek}`
        } else if (range === "month") {
            return currentDate.format("YYYY-MM")
        } else if (range === "year") {
            return currentDate.format("YYYY")
        }
        return currentDate.format("YYYY-MM-DD")
    }


    return (
        <div className={styles.navigator}>
            <button
                aria-label="上一周期"
                onClick={() => changeDate("prev")}
                className={styles.navButton}
            >
                ←
            </button>
            <span className={styles.label}>{formatLabel()}</span>
            <button
                aria-label="下一周期"
                onClick={() => changeDate("next")}
                className={styles.navButton}
            >
                →
            </button>
        </div>
    );
}

export default DateNavigator