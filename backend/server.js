import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './db.js'
import authRoutes from './routes/auth.js'
import cookieParser from 'cookie-parser';
import noteRouter from './routes/note.js'
import reportRoutes from './routes/reports.js'
import './workers/aiWorker.js'
import './workers/reportWorker.js';
import { apiRateLimiter, authRateLimiter } from './middleware/rateLimiters.js'
import { env } from './config/env.js'
dotenv.config();

const app = express();

/**
 * Trust the first proxy (required when running behind Fly.io, Vercel, Nginx, etc.)
 * This must be set BEFORE any middleware that relies on client IP,
 * such as rate limiting or authentication.
 */
app.set("trust proxy", 1);

app.use(cookieParser());
app.use(cors({
    origin: env.clientOrigin,
    credentials: true,
}))
app.use(express.json({ limit: '1mb' }));

connectDB()

app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/notes', noteRouter)
app.use('/api/reports', apiRateLimiter, reportRoutes)

app.use((err, req, res, next) => {
    res.status(500).json({ message: "Internal Server Error" });
})

app.get('/', (req, res) => {
    res.send('Auth Backend is running')
})



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('AI Worker started. Ready to process notes.');

    // NOW safe to start background jobs
    import('./jobs/generateWeeklyReports.js');
    import('./jobs/generateMonthlyReports.js');
    console.log('[Server] Cron jobs loaded: weekly (Sun 00:00), monthly (1st 00:05) JST');
});

