import styles from '../styles/LoadingScreen.module.scss'

const LoadingScreen = () => {
    return (
        <div className={styles.loadingWrapper}>
            <div className={styles.spinner} />
            <p className={styles.loadingText}>Checking authentication status...</p>
        </div>
    )
}

export default LoadingScreen;