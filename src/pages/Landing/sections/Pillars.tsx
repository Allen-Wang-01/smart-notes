import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

const PILLARS = [
    {
        num: 'i. Capture',
        title: 'You write what matters.',
        quiet: 'Low friction, high quality.',
        body: 'A single text box. You write or paste a thought, an article, an answer worth keeping. Optionally, in one sentence, you tell the system why you saved it. No tags, no folders, no categories. The system handles structure.',
    },
    {
        num: 'ii. Reflect',
        title: 'It writes you a letter.',
        quiet: 'Once a week. By Sunday.',
        body: "The letter doesn't summarize. It doesn't advise. It observes — like a friend who's been paying attention. The themes you spent attention on. How a stance changed. A pattern you didn't notice. Some weeks it's short. The system has the discipline not to fabricate insight.",
    },
    {
        num: 'iii. Connect',
        title: 'Your AI finally knows you.',
        quiet: 'Through MCP. With your permission.',
        body: 'Connect once. After that, Claude and ChatGPT can see your skills with the situations you use them in, your active focuses, your recent emotional weather. They stop answering as a stranger. You stop re-introducing yourself.',
    },
];

type PillarData = { num: string; title: string; quiet: string; body: string };

function Pillar({ data }: { data: PillarData }) {
    const r = useReveal(styles);
    return (
        <div
            ref={r.ref}
            className={`${styles.pillar} ${styles.reveal} ${r.revealClass}`}
        >
            <div className={styles.pillarNum}>{data.num}</div>
            <h3>
                {data.title}
                <span className={styles.quiet}>{data.quiet}</span>
            </h3>
            <p>{data.body}</p>
        </div>
    );
}

export default function Pillars() {
    const intro = useReveal(styles);

    return (
        <section className={styles.pillars} id="pillars">
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 02</span>
                        <span>Three things it does</span>
                    </div>
                    <h2>Capture. Reflect. Connect.</h2>
                    <p>
                        Three small movements. The product is what happens
                        between them.
                    </p>
                </div>

                <div className={styles.pillarGrid}>
                    {PILLARS.map((p) => (
                        <Pillar key={p.num} data={p} />
                    ))}
                </div>
            </div>
        </section>
    );
}
