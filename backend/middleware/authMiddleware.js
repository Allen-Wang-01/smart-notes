import jwt from 'jsonwebtoken'

const authMiddleware = async (req, res, next) => {
    try {
        //if event-stream, only verify refresh token
        if (req.path.endsWith("/stream")) {
            const refreshToken = req.cookies.refreshToken

            if (!refreshToken) {
                return res.status(401).send("Refresh Token missing")
            }

            try {
                const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET)
                req.user = { userId: decoded.userId }
                return next()
            } catch (err) {
                console.error("SSE Refresh token invalid:", err.message);
                return res.status(401).send("Invalid refresh token");
            }
        }

        // other routers, verify access token
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' })
        }
        const token = authHeader.split(' ')[1]

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        req.user = { userId: decoded.userId, username: decoded.username }
        next()
    } catch (error) {
        console.error("Auth Middleware Error:", error.message)
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' })
        }
        return res.status(401).json({ message: 'Invalid token' })
    }
}

export default authMiddleware;