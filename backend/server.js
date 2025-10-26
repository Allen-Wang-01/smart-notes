import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './db.js'

dotenv.config();

const app = express();
app.use(cors())
app.use(express.json());

connectDB()

app.use('/api/auth', authRoutes);
app.get('/', (req, res) => {
    res.send('Auth Backend is running')
})

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});