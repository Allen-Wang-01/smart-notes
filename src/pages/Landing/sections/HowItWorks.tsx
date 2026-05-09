import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

const STEPS = [
    {
        glyph: 'a',
        label: 'You',
        title: 'Write a fragment.',
        body: 'A thought, an article, an answer worth keeping. Optionally, why it matters. That\'s it.',
    },
    {
        glyph: 'b',
        label: 'The system',
        title: 'Reads, structures, reflects.',
        body: 'It builds a model of you over time — your skills, focuses, recurring questions, recent state. Privately, on your behalf.',
    },
    {
        glyph: 'c',
        label: 'You receive',
        title: 'A letter, and a context layer.',
        body: 'Sundays: a letter that observes you. Anytime: Claude and ChatGPT can query the model — with your permission — and answer like they know you.',
    },
];

export default function HowItWorks() {
    const intro = useReveal(styles);
    const flow = useReveal(styles);

    return (
        <section className={styles.how} id="how">
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 05</span>
                        <span>How it works</span>
                    </div>
                    <h2>Three movements, one loop.</h2>
                    <p>
                        The whole system in three steps. No dashboards, no
                        analytics, no notification panels.
                    </p>
                </div>

                <div
                    ref={flow.ref}
                    className={`${styles.flow} ${styles.reveal} ${flow.revealClass}`}
                >
                    {STEPS.map((s) => (
                        <div key={s.glyph} className={styles.flowStep}>
                            <span className={styles.glyph}>{s.glyph}</span>
                            <div className={styles.stepLabel}>{s.label}</div>
                            <h4>{s.title}</h4>
                            <p>{s.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
