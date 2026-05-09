import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

const ITEMS = [
    {
        marker: 'i.',
        head: 'Someone who already writes things down.',
        em: "Notes, journals, ideas, observations. The habit exists, but the notes don't talk back.",
    },
    {
        marker: 'ii.',
        head: 'Someone in a transition.',
        em: 'Career change, project launch, intense learning, a decision being weighed. Periods where patterns matter and are hard to see from inside.',
    },
    {
        marker: 'iii.',
        head: 'Someone who uses AI a lot.',
        em: "You've felt the friction of re-introducing yourself to Claude or ChatGPT every conversation. You want your AI to actually know you.",
    },
    {
        marker: 'iv.',
        head: 'Someone who values reflection over productivity.',
        em: "This isn't a productivity tool. It doesn't make you more efficient. It helps you understand yourself better.",
    },
];

type WhoItem = {
    marker: string;
    head: string;
    em: string;
};


function Item({ data }: { data: WhoItem }) {
    const r = useReveal(styles);
    return (
        <div
            ref={r.ref}
            className={`${styles.whoItem} ${styles.reveal} ${r.revealClass}`}
        >
            <span className={styles.marker}>{data.marker}</span>
            <p>
                {data.head} <em>{data.em}</em>
            </p>
        </div>
    );
}

export default function WhoFor() {
    const intro = useReveal(styles);
    const note = useReveal(styles);

    return (
        <section className={styles.who}>
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 06</span>
                        <span>Who it's for</span>
                    </div>
                    <h2>The product has opinions about who should use it.</h2>
                    <p>
                        Not for everyone. Specifically for people who already
                        do this work, and want their own writing to talk back
                        to them.
                    </p>
                </div>

                <div className={styles.whoList}>
                    {ITEMS.map((it) => (
                        <Item key={it.marker} data={it} />
                    ))}
                </div>

                <p
                    ref={note.ref}
                    className={`${styles.whoNot} ${styles.reveal} ${note.revealClass}`}
                >
                    If you want to capture every fleeting thought, you won't
                    appreciate the curation. If you want a quantified-self
                    dashboard, you won't like prose-format Sunday letters. The
                    product has opinions, and that's intentional.
                </p>
            </div>
        </section>
    );
}
