import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

export default function FinalCta() {
    const heading = useReveal(styles);
    const sub = useReveal(styles);
    const actions = useReveal(styles);

    return (
        <section className={styles.final} id="start">
            <div className={styles.wrap}>
                <h2
                    ref={heading.ref}
                    className={`${styles.reveal} ${heading.revealClass}`}
                >
                    Start writing this week.{' '}
                    <em>Get your first letter on Sunday.</em>
                </h2>
                <p
                    ref={sub.ref}
                    className={`${styles.reveal} ${sub.revealClass}`}
                >
                    Free while in early access. No invitation needed. The
                    first letter arrives the Sunday after you've written
                    enough for the system to have something to say.
                </p>
                <div
                    ref={actions.ref}
                    className={`${styles.finalActions} ${styles.reveal} ${actions.revealClass}`}
                >
                    <a href="/register" className={styles.btnPrimary}>
                        <span>Create an account</span>
                        <span className={styles.arrow}>→</span>
                    </a>
                    <a href="#letter" className={styles.btnQuiet}>
                        Read the sample letter again
                    </a>
                </div>
            </div>
        </section>
    );
}
