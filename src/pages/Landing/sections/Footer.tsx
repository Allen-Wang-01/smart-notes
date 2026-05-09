import styles from '../LandingPage.module.scss';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={`${styles.wrap} ${styles.footerInner}`}>
                <div className={styles.wordmark}>
                    Hindsight<span className={styles.dot} />
                </div>
                <div className={styles.links}>
                    <a href="#">Privacy</a>
                    <a href="#">Terms</a>
                    <a href="mailto:hello@hindsight.so">Contact</a>
                </div>
                <div className={styles.credit}>© MMXXVI</div>
            </div>
        </footer>
    );
}
