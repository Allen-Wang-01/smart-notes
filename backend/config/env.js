import dotenv from 'dotenv'
dotenv.config()

export const env = {
    nodeEnv: process.env.NODE_ENV ?? "development",

    clientOrigin: process.env.CLIENT_ORIGIN ?? "",

    cookie: {
        secure: process.env.COOKIE_SECURE === "true",
        sameSite: process.env.COOKIE_SAMESITE ?? "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    },
};
