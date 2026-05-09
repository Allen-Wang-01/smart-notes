import styles from '../LandingPage.module.scss';

export default function Topbar() {
    return (
        <header className={styles.topbar}>
            <div className={`${styles.wrap} ${styles.topbarInner}`}>
                <div className={styles.wordmark}>
                    Hindsight<span className={styles.dot} />
                </div>
                <nav className={styles.nav}>
                    <a href="#letter" className={styles.navHide}>
                        The Letter
                    </a>
                    <a href="#how" className={styles.navHide}>
                        How it works
                    </a>
                    <a href="#faq" className={styles.navHide}>
                        FAQ
                    </a>
                    <a href="/login" className={styles.ctaLink}>
                        Sign in →
                    </a>
                </nav>
            </div>
        </header>
    );
}
