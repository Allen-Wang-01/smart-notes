import jwt from 'jsonwebtoken'

const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization
        if (!authHeader || !authHeader.startWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' })
        }
        const token = authHeader.split(' ')[1]

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        req.user = { userId: decoded.userId, username: decoded.username }
        next()
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' })
        }
        return res.status(401).json({ message: 'Invalid token' })
    }
}

export default authMiddleware;