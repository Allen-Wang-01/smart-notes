import React, { useState } from 'react'
import styles from '../styles/Login.module.scss'

interface LoginProps {
    handleLogin: (email: string, password: string) => void;
}

const Login: React.FC<LoginProps> = ({ handleLogin }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("")
    const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

    const validateEmail = (value: string) => {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(value)
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        let newErrors: { email?: string; password?: string } = {}
        if (!validateEmail(email)) {
            newErrors.email = "Please enter the valid email"
        }

        if (!password.trim()) {
            newErrors.password = "please enter the password"
        }

        setErrors(newErrors)

        if (Object.keys(newErrors).length === 0) {
            handleLogin(email, password)
        }
    }

    return (
        <div className={styles.loginPage}>
            <div className={styles.loginCard}>
                <h2 className={styles.loginTitle}>Login</h2>
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
                    </div>

                    <button type='submit' className={styles.loginButton}>Login</button>
                </form>
                <p className={styles.registerLink}>
                    Don't have an account ? <a href="/register">Register</a>
                </p>
            </div >
        </div >
    )
}

export default Login