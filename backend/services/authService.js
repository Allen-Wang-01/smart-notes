import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function loginWithCredentials({ email, password }) {
    if (!email || !password) {
        throw new Error('MISSING_CREDENTIALS')
    }

    const user = await User.findOne({ email });
    if (!user) {
        throw new Error('INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
        throw new Error('INVALID_CREDENTIALS')
    }

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

    // persist refresh token 
    user.refreshToken = refreshToken;
    await user.save()

    return {
        accessToken,
        refreshToken,
        user,
    }
}