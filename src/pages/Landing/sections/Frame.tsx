import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

export default function Frame() {
    const label = useReveal(styles);
    const p1 = useReveal(styles);
    const p2 = useReveal(styles);
    const p3 = useReveal(styles);

    return (
        <section className={styles.frame}>
            <div className={styles.frameInner}>
                <div
                    ref={label.ref}
                    className={`${styles.sectionLabel} ${styles.reveal} ${label.revealClass}`}
                >
                    <span className={styles.num}>§ 07</span>
                    <span>One more thing</span>
                </div>
                <p
                    ref={p1.ref}
                    className={`${styles.reveal} ${p1.revealClass}`}
                >
                    The dominant idea about AI right now is that it should{' '}
                    <em>do things for you</em>. Write your emails. Plan your
                    trip. Run your meetings.
                </p>
                <p
                    ref={p2.ref}
                    className={`${styles.reveal} ${p2.revealClass}`}
                >
                    Hindsight takes a different stance. It uses AI to{' '}
                    <em>show you to yourself</em> — not to replace your
                    thinking, but to make it visible.
                </p>
                <p
                    ref={p3.ref}
                    className={`${styles.smaller} ${styles.reveal} ${p3.revealClass}`}
                >
                    The AI isn't the protagonist. You are. The AI is the
                    careful observer in the corner of the room, who
                    occasionally walks over and shows you what you've been
                    doing.
                </p>
            </div>
        </section>
    );
}
