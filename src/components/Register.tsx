import React, { useState } from 'react'
import styles from '../styles/Register.module.scss'

interface RegisterProps {
    handleRegister: (email: string, password: string, confirmPassword: string) => void;
}

const Register: React.FC<RegisterProps> = ({ handleRegister }) => {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({})

    const validate = () => {
        const newErrors: typeof errors = {}
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            newErrors.email = "Please enter the vaild email"
        }

        if (!password) {
            newErrors.password = "Please enter the password"
        }

        if (password !== confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match"
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }


    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (validate()) {
            handleRegister(email, password, confirmPassword)
        }
    }

    return (
        <div className={styles.registerPage}>
            <div className={styles.registerCard}>
                <h2 className={styles.title}>Register</h2>
                <form onSubmit={onSubmit} className={styles.form}>
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