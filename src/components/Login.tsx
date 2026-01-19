import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../redux/hooks';
import { login } from '../redux/slices/authSlice';
import api from '../api/axios';
import styles from '../styles/Login.module.scss'
import toast from 'react-hot-toast';
import { useAppSelector } from '../redux/hooks';
import LoadingScreen from './LoadingScreen';

const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("")
    const [errors, setErrors] = useState<{ email?: string; password?: string; server?: string; }>({})
    const dispatch = useAppDispatch()
    const navigate = useNavigate()
    const { isAuthenticated, isLoading } = useAppSelector(state => state.auth)

    useEffect(() => {
        if (!isLoading && isAuthenticated) {
            navigate('/', { replace: true });
        }
    }, [isAuthenticated, navigate, isLoading,]);

    const validateEmail = (value: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(value)
    }

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        let newErrors: typeof errors = {}
        if (!validateEmail(email)) {
            newErrors.email = "Please enter the valid email"
        }

        if (!password.trim()) {
            newErrors.password = "please enter the password"
        }

        setErrors(newErrors)

        if (Object.keys(newErrors).length === 0) {
            try {
                const response = await api.post(`/auth/login`, {
                    email,
                    password,
                })
                const { user, accessToken } = response.data
                dispatch(login({ user, accessToken }))
                navigate('/')
            } catch (error: any) {
                const errorMessage = error.response?.data?.message || 'Login failed. Please try again'
                setErrors({ server: errorMessage })
                toast.error(errorMessage)
            }
        }
    }

    const handleDemoLogin = async () => {
        try {
            const response = await api.post(`/auth/demo-login`)
            const { user, accessToken } = response.data
            dispatch(login({ user, accessToken }))
            navigate('/')
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Demo Login failed. Please try again'
            setErrors({ server: errorMessage })
            toast.error(errorMessage)
        }
    }

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (!isAuthenticated) {
        return (
            <div className={styles.loginPage}>
                <div className={styles.loginCard}>
                    <h2 className={styles.loginTitle}>Login</h2>
                    {errors.server && <p className={styles.errorMessage}>{errors.server}</p>}
                    <form onSubmit={onSubmit} noValidate>
                        <div className={styles.formGroup}>
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={errors.email ? "error" : ""}
                                placeholder='Please Enter your email'
                            />
                            {errors.email && <p className={styles.errorMessage}>{errors.email}</p>}
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="password">Password</label>
                            <input
                                type="password"
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={errors.password ? "error" : ""}
                                placeholder='Pease enter password'
                            />
                            {errors.password && <p className={styles.errorMessage}>{errors.password}</p>}
                        </div>

                        <button type='submit' className={styles.loginButton}>Login</button>

                        <button
                            className={styles.demoLoginBtn}
                            onClick={handleDemoLogin}
                        >
                            Try Demo Account
                        </button>
                    </form>
                    <p className={styles.registerLink}>
                        Don't have an account ? <a href="/register">Register</a>
                    </p>
                </div >
            </div >
        )
    }
    return null
}

export default Login