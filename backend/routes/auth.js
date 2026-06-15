import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import { env } from '../config/env.js'
const router = express.Router()
import { loginWithCredentials } from '../services/authService.js'
import {
    hashRefreshToken,
    verifyRefreshToken,
} from '../lib/refreshTokenHash.js'

const REFRESH_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    maxAge: env.cookie.maxAge,
    path: '/',
}

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

        //auto login
        const accessToken = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        )

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        )
        user.refreshToken = hashRefreshToken(refreshToken)

        await user.save()

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)

        res.status(201).json({
            message: 'User registered successfully',
            user: { id: user._id, username: user.username, email: user.email },
            accessToken,
        })
    } catch (error) {
        console.error('Registration error: ', error)
        res.status(500).json({ message: 'Server error' })
    }
})

//login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        const { accessToken, refreshToken, user } =
            await loginWithCredentials({ email, password })

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS)

        //return tokens
        res.json({
            accessToken,
            user: { id: user._id, username: user.username, email: user.email }
        })
    } catch (error) {
        if (error.message === 'MISSING_CREDENTIALS') {
            return res.status(400).json({ message: 'Please provide email and password' });
        }
        if (error.message === 'INVALID_CREDENTIALS') {
            return res.status(400).json({ message: 'Invalid email or password' });
        }

        console.error('Login error: ', error);
        res.status(500).json({ message: 'Server error' })
    }
})

router.post('/demo-login', async (req, res) => {
    try {
        const email = process.env.DEMO_USER_EMAIL
        const password = process.env.DEMO_USER_PASSWORD

        if (!email || !password) {
            console.error('Demo account env not configured');
            return res.status(500).json({ message: 'Demo account not configured' });
        }
        const { accessToken, refreshToken, user } =
            await loginWithCredentials({ email, password });

        res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTIONS);

        res.json({
            accessToken,
            user: { id: user._id, username: user.username, email: user.email },
            demo: true,
        });
    } catch (error) {
        console.error('Demo login error:', error);
        res.status(500).json({ message: 'Demo login failed' });
    }
})

//refresh
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refreshToken //read token from cookie
    if (!refreshToken) {
        return res.status(401).json({ message: 'No refresh token' })
    }

    try {
        //verify refreshToken
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)

        //constant-time hash comparison against stored hash
        const user = await User.findById(decoded.userId)
        if (!user || !verifyRefreshToken(refreshToken, user.refreshToken)) {
            return res.status(403).json({ message: 'Invalid refresh token' })
        }

        //rotate: issue new access token and new refresh token
        const newAccessToken = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: '15m' }
        )
        const newRefreshToken = jwt.sign(
            { userId: user._id },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: '7d' }
        )

        user.refreshToken = hashRefreshToken(newRefreshToken)
        await user.save()

        res.cookie('refreshToken', newRefreshToken, REFRESH_COOKIE_OPTIONS)
        res.json({ accessToken: newAccessToken, user: { id: user._id, username: user.username, email: user.email } })
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(403).json({ message: 'Refresh token expired' })
        }
        return res.status(403).json({ message: 'Invalid refresh token' })
    }
})

//logout
router.post('/logout', async (req, res) => {
    const token = req.cookies?.refreshToken;

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: env.cookie.secure,
        sameSite: env.cookie.sameSite,
        path: '/',
    });

    if (token) {
        await User.updateOne(
            { refreshToken: hashRefreshToken(token) },
            { $set: { refreshToken: null } }
        );
    }

    res.json({ message: 'Logged out successfully' });
})
export default router