import axios from "axios";
import { store } from "../redux/store";
import { login, logout, updateAccessToken } from "../redux/slices/authSlice";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { 'Content-Type': 'application/json' },
})

let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (token) prom.resolve(token)
        else prom.reject(error)
    })
    failedQueue = []
}

api.interceptors.request.use(
    (config) => {
        const { accessToken } = store.getState().auth
        if (accessToken) {
            config.headers.Authorization = `Bearer ${accessToken}`
        }
        return config
    },
    (error) => Promise.reject(error)
)

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`
                    return api(originalRequest)
                }).catch((err) => {
                    Promise.reject(err)
                })
            }
            originalRequest._retry = true
            isRefreshing = true

            try {
                const { refreshToken } = store.getState().auth
                if (!refreshToken) throw new Error('No refresh token available')
                const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/refresh`, {
                    refreshToken,
                })
                const { accessToken: newAccessToken } = response.data
                store.dispatch(updateAccessToken(newAccessToken))
                processQueue(null, newAccessToken)
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return api(originalRequest)
            } catch (refreshError) {
                processQueue(refreshError, null)
                store.dispatch(logout())
                return Promise.reject(refreshError)
            } finally {
                isRefreshing = false
            }
        }
        return Promise.reject(error)
    }
)

export default api;