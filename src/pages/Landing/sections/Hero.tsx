import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

export default function Hero() {
    const eyebrow = useReveal(styles);
    const heading = useReveal(styles);
    const sub = useReveal(styles);
    const actions = useReveal(styles);

    return (
        <section className={styles.hero}>
            <div className={styles.wrap}>
                <div className={styles.heroDate}>
                    Vol. I &nbsp;·&nbsp; No. 01
                    <br />
                    Issued weekly
                    <br />
                    Sundays, by post
                </div>

                <div
                    ref={eyebrow.ref}
                    className={`${styles.heroEyebrow} ${styles.reveal} ${eyebrow.revealClass}`}
                >
                    A reflective layer, not a notes app
                </div>

                <h1
                    ref={heading.ref}
                    className={`${styles.heroH1} ${styles.reveal} ${heading.revealClass}`}
                    style={{ transitionDelay: '90ms' }}
                >
                    Your fragments contain a story.{' '}
                    <em>Help yourself read&nbsp;it.</em>
                </h1>

                <p
                    ref={sub.ref}
                    className={`${styles.heroSub} ${styles.reveal} ${sub.revealClass}`}
                    style={{ transitionDelay: '180ms' }}
                >
                    Hindsight is a quiet system that observes the patterns in
                    your own thinking — and gives Claude and ChatGPT the
                    context to actually know who they're talking to. Once a
                    week, it writes you a letter.
                </p>

                <div
                    ref={actions.ref}
                    className={`${styles.heroActions} ${styles.reveal} ${actions.revealClass}`}
                    style={{ transitionDelay: '270ms' }}
                >
                    <a href="/login" className={styles.btnPrimary}>
                        <span>Start writing</span>
                        <span className={styles.arrow}>→</span>
                    </a>
                    <a href="#letter" className={styles.btnQuiet}>
                        Read a sample letter
                    </a>
                </div>
            </div>
        </section>
    );
}
