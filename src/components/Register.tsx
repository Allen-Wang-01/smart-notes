import React, { useState } from 'react'
import styles from '../styles/Register.module.scss'
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../redux/hooks';
import { login } from '../redux/slices/authSlice';
import { useAppSelector } from '../redux/hooks';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';


const Register: React.FC = () => {
    const { isAuthenticated } = useAppSelector((state) => state.auth);
    if (isAuthenticated) {
        return <Navigate to="/" replace />;
    }
    const [username, setUsername] = useState('')
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [errors, setErrors] = useState<{
        username?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        server?: string;
    }>({})

    const dispatch = useAppDispatch()
    const navigate = useNavigate()

    const validate = () => {
        const newErrors: typeof errors = {}

        if (!username) {
            newErrors.username = 'Please enter a username'
        } else if (username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters'
        }

        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            newErrors.email = "Please enter the vaild email"
        }

        if (!password) {
            newErrors.password = "Please enter the password"
        } else if (password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters'
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }


    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setErrors({})
        if (validate()) {
            try {
                const response = await axios.post(`/api/auth/register`, {
                    username,
                    email,
                    password,
                })
                // registration successful and login automatically 
                const { user, accessToken, refreshToken } = response.data
                dispatch(login({ user, accessToken, refreshToken }))
                toast.success('Registration successful! Logged in.')
                navigate('/')
            } catch (error: any) {
                const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.'
                setErrors({
                    server: errorMessage
                })
                toast.error(errorMessage)
            }
        }
    }

    return (
        <div className={styles.registerPage}>
            <div className={styles.registerCard}>
                <h2 className={styles.title}>Register</h2>
                {errors.server && <div className={styles.error}>{errors.server}</div>}
                <form onSubmit={onSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <input
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className={styles.input}
                        />
                        {errors.username && <div className={styles.error}>{errors.username}</div>}
                    </div>

                    <div className={styles.formGroup}>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={styles.input}
                        />
                        {errors.email && <div className={styles.error}>{errors.email}</div>}
                    </div>

                    <div className={styles.formGroup}>
                        <input
                            type="password"
                            value={password}
                            placeholder='Password'
                            onChange={(e) => setPassword(e.target.value)}
                            className={styles.input}
                        />
                        {errors.password && <div className={styles.error}>{errors.password}</div>}
                    </div>

                    <div className={styles.formGroup}>
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className={styles.input}
                        />
                        {errors.confirmPassword && <div className={styles.error}>{errors.confirmPassword}</div>}
                    </div>

                    <button type="submit" className={styles.button}>
                        Register
                    </button>
                </form>

                <div className={styles.linkWrapper}>
                    Already have an account? <a href="/login" className={styles.link}>Login</a>
                </div>
            </div>
        </div>
    )
}

export default Register