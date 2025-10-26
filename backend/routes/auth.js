import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const router = express.Router()

//register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body

        //check the input
        if (!username || !email || !password) {
            return res.status(400).json({ message: 'Please provide username, email and password' })
        }

        //check if the user exists
        const existingUser = await User.findOne({ $or: [{ email }, { username }] })
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' })
        }
        // hash the password
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt)
        //create new user
        const user = new User({
            username,
            email,
            password: hashedPassword,
        })
        //save user data to the database
        await user.save()
        res.status(201).json({ message: 'User registered successfully' })
    } catch (error) {
        console.error('Registration error: ', error)
        res.status(500).json({ message: 'Server error' })
    }
})

//login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({ message: 'Please provide email and password' })
        }

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password' })
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid email or password' })
        }

        const accessToken = jwt.sign(
            { userId: user._id, username: user.name },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        )

        //save refreshToken to database
        user.refreshToken = refreshToken;
        await user.save()

        //return tokens
        res.json({
            accessToken,
            refreshToken,
            user: { id: user._id, username: username, email: user.email }
        })
    } catch (error) {
        console.error('Login error: ', error);
        res.status(500).json({ message: 'Server error' })
    }
})

//refresh
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body
        if (!refreshToken) {
            return res.status(401).json({ message: 'No refresh token provided' })
        }

        //verify refreshToken
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)

        //compare with the refreshToken in database
        const user = await User.findById(decoded.userId)
        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' })
        }

        //generate a new access token
        const newAccessToken = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        )
        res.json({ accessToken: newAccessToken })
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Refresh token expired' })
        }
        return res.status(403).json({ message: 'Invalid refresh token' })
    }
})

//logout
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId)
        if (!user) {
            return res.status(404).json({ message: 'User not found' })
        }

        //clear refreshToken 
        user.refreshToken = null
        await user.save()

        res.json({ message: 'Logged out successfully' })
    } catch (error) {
        console.error('Logout error: ', error)
        res.status(500).json({ message: 'Server error' })
    }
})
export default router