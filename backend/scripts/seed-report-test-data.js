/**
 * This script seeds realistic note data for testing weekly/monthly report generation.
 * It intentionally simulates human-like writing patterns and time distribution.
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/User.js"
import Note from "../models/Note.js"
import { getWeeklyKey, getMonthlyKey, parseMonthlyPeriod, parseWeeklyPeriod } from "../utils/period.js"

dotenv.config()

const MONGO_URI = process.env.MONGO_URI

async function run() {
    console.log("Seeding report test data...");

    await mongoose.connect(MONGO_URI)

    /**
     * 1️⃣ Create / reuse test user
     */
    const TEST_PASSWORD = process.env.TEST_USER_PASSWORD;

    let user = await User.findOne({ email: process.env.TEST_USER_EMAIL });
    if (!user) {
        const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

        user = await User.create({
            username: "report_test_user",
            email: process.env.TEST_USER_EMAIL,
            password: hashedPassword,
        });
        console.log("   Created test user");
        console.log("   Login with:");
        console.log(`   email: ${process.env.TEST_USER_EMAIL}`);
        console.log(`   password: ${process.env.TEST_USER_PASSWORD}`);
    } else {
        console.log("Reusing existing test user");
    }

    /**
     * 2️⃣ Clear existing notes for this user
     */
    await Note.deleteMany({ userId: user._id });
    console.log("Cleared old notes");
    const now = new Date()

    /**
    * ---------- Weekly period (last week) ----------
    */
    const lastWeekKey = getWeeklyKey(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    );
    console.log("weeklyKey", lastWeekKey)
    const { start: lastWeekStart } = parseWeeklyPeriod(lastWeekKey);

    /**
     * ---------- Monthly period (last month) ----------
     */
    const lastMonthKey = getMonthlyKey(
        new Date(now.getFullYear(), now.getMonth() - 1, 1)
    );
    console.log("monthlyKey", lastMonthKey)
    const { start: lastMonthStart } = parseMonthlyPeriod(lastMonthKey);

    const notes = [];

    const weeklyNotes = [
        {
            rawContent: "Spent the morning refactoring the report page. Initially felt overwhelmed by the state logic, but after splitting concerns, things became much clearer.",
            summary: "Refactored the report page and simplified complex state management.",
            keywords: ["refactor", "frontend", "state"],
        },
        {
            rawContent: "Struggled with React Query cache behavior today. Took some time to read the docs again and finally understood staleTime vs cacheTime.",
            summary: "Clarified React Query caching behavior after revisiting documentation.",
            keywords: ["react-query", "cache", "learning"],
        },
        {
            rawContent: "Implemented available periods API and wired it to the frontend. Felt satisfying to see backend and frontend align.",
            summary: "Connected available periods API to the frontend successfully.",
            keywords: ["backend", "api", "integration"],
        },
        {
            rawContent: "Hit a bug where reports didn’t load when no data existed. Realized empty states are just as important as happy paths.",
            summary: "Handled empty report states more carefully after discovering a bug.",
            keywords: ["bug", "edge-case", "ux"],
        },
        {
            rawContent: "Reviewed the report feature as a whole and started thinking how to explain it in interviews. Confidence is slowly building.",
            summary: "Reflected on the report feature and began preparing interview explanations.",
            keywords: ["interview", "reflection", "confidence"],
        },
    ];


    const monthlyNotes = [
        {
            rawContent: "This month I focused on rebuilding the report system from scratch. It was slower than expected, but I finally understand why structure matters.",
            summary: "Rebuilt the report system and gained a deeper understanding of structure.",
            keywords: ["architecture", "report", "learning"],
        },
        {
            rawContent: "There were moments I doubted whether I was ready to apply for jobs, but finishing this feature gave me concrete confidence.",
            summary: "Overcame self-doubt by completing a meaningful feature.",
            keywords: ["confidence", "career", "growth"],
        },
        {
            rawContent: "Learned how frontend and backend decisions affect each other. This project made me more comfortable calling myself full-stack.",
            summary: "Developed a stronger full-stack mindset through hands-on work.",
            keywords: ["fullstack", "experience", "perspective"],
        },
    ];


    const safeNow = new Date(now.getTime() - 2 * 86400000);

    weeklyNotes.forEach((note, i) => {
        notes.push({
            userId: user._id,
            rawContent: note.rawContent,
            content: note.rawContent,
            title: `Weekly Reflection ${i + 1}`,
            summary: note.summary,
            keywords: note.keywords,
            category: "study",
            status: "completed",
            createdAt: generateCreatedAtForPeriod({
                periodStart: lastWeekStart,
                periodDays: 7,
                index: i,
                safeNow,
            }),
        });
    });

    monthlyNotes.forEach((note, i) => {
        notes.push({
            userId: user._id,
            rawContent: note.rawContent,
            content: note.rawContent,
            title: `Monthly Reflection ${i + 1}`,
            summary: note.summary,
            keywords: note.keywords,
            category: "study",
            status: "completed",
            createdAt: generateCreatedAtForPeriod({
                periodStart: lastMonthStart,
                periodDays: 28,
                index: i,
                safeNow,
            }),
        });
    });

    /**
    * Current week note (should NOT appear in reports)
    */
    notes.push({
        userId: user._id,
        rawContent: "This note belongs to the current week",
        content: "Ongoing work that should not be included in last reports",
        title: "Current Activity",
        summary: "Working on current tasks.",
        keywords: ["current"],
        category: "study",
        status: "completed",
        createdAt: now,
    });

    // insertMany allows manual createdAt override even with timestamps enabled
    await Note.insertMany(notes);

    console.log(`Inserted ${notes.length} notes`);
    console.log("Report test data seeded successfully");

    await mongoose.disconnect();
    process.exit(0);
}

run().catch((err) => {
    console.error("Failed to seed report test data", err);
    process.exit(1);
});

/**
 * Generate a safe createdAt within a given period
 *
 * @param periodStart Date - start of week/month
 * @param periodDays number - total days in period (7 for week, ~30 for month)
 * @param index number - index of note in array
 * @param safeNow Date - latest allowed time (usually now - 1~2 days)
 */
function generateCreatedAtForPeriod({
    periodStart,
    periodDays,
    index,
    safeNow,
}) {
    // distribute notes inside period
    const baseOffset = Math.floor((periodDays / 5) * index);
    const dayOffset = Math.min(baseOffset, periodDays - 1);

    const candidate = new Date(
        periodStart.getTime() + dayOffset * 86400000
    );

    // add natural hour variation (9:00–18:00)
    candidate.setHours(9 + Math.floor(Math.random() * 10));
    candidate.setMinutes(Math.floor(Math.random() * 60));

    // never exceed safeNow
    if (candidate > safeNow) {
        return new Date(safeNow);
    }

    return candidate;
}
