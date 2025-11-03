import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './db.js'
import authRoutes from './routes/auth.js'
import cookieParser from 'cookie-parser';
import noteRouter from './routes/note.js'
dotenv.config();

const app = express();
app.use(cookieParser());
app.use(cors({
    origin: 'http://localhost:3005',
    credentials: true,
}))
app.use(express.json());

connectDB()

app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRouter)

app.get('/', (req, res) => {
    res.send('Auth Backend is running')
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});