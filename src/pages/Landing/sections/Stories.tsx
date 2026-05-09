import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

const STORIES = [
    {
        meta: { num: 'i.', label: 'The career transition' },
        title: 'You ask Claude: "Should I start applying?"',
        paragraphs: [
            "For three months you've been thinking about switching from backend engineering to AI engineering. You've saved articles, written reflections. You feel anxious but determined. You don't know if you're ready.",
            "Without Hindsight, Claude gives you a thoughtful but generic checklist. With Hindsight, Claude knows: you've been studying agent fundamentals for three weeks (consistent), you've shipped real backend systems (capable), you've expressed uncertainty about ML depth four times (real but bounded gap). It answers based on signal, not assumptions.",
        ],
        quote: "\"This week you wrote 'uncertain' three times. Each time, the next note had 'decided' or 'tomorrow.' Your saving pattern shifted — fewer 'should I switch' notes, more 'how to build agents.' You stopped asking whether some time ago. You just hadn't noticed yet.\"",
    },
    {
        meta: { num: 'ii.', label: 'The learning trajectory' },
        title: "You don't know yet that you're learning agents.",
        paragraphs: [
            "You save Q&As about agent architecture, articles on workflow vs. agent design, an answer about evaluation harnesses. You don't write much yourself — you're absorbing. You haven't told anyone, including yourself, that you're \"learning agents.\" It's just been happening.",
        ],
        quote: "\"Three weeks ago you saved your first note about agents. This week you saved four more. You haven't written 'I'm learning agents' anywhere — but the saved evidence is unambiguous. You're someone who studies agents now.\"",
        outro: 'The system named the trajectory before you did.',
    },
    {
        meta: { num: 'iii.', label: 'The quiet shift' },
        title: "A topic disappeared. You didn't notice.",
        paragraphs: [
            "You used to write about your job in Tokyo every week. Recently, you haven't. Last week, you saved three articles about remote-first companies. You didn't connect those two facts.",
        ],
        quote: '"You haven\'t mentioned your Tokyo job in four weeks — that used to be a regular topic. This week you mentioned \'remote\' three times. I\'m not telling you what it means. Just pointing at it."',
        outro: 'The product\'s job is to point. Yours is to interpret.',
    },
];

type StoryData = {
    meta: { num: string; label: string };
    title: string;
    paragraphs: string[];
    quote: string;
    outro?: string;
};


function Story({ data }: { data: StoryData }) {
    const r = useReveal(styles);
    return (
        <div
            ref={r.ref}
            className={`${styles.story} ${styles.reveal} ${r.revealClass}`}
        >
            <div className={styles.storyMeta}>
                <span className={styles.num}>{data.meta.num}</span>
                {data.meta.label}
            </div>
            <div className={styles.storyContent}>
                <h3>{data.title}</h3>
                {data.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                ))}
                <p className={styles.fromLetter}>{data.quote}</p>
                {data.outro && <p>{data.outro}</p>}
            </div>
        </div>
    );
}

export default function Stories() {
    const intro = useReveal(styles);

    return (
        <section className={styles.stories}>
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 04</span>
                        <span>Three scenarios</span>
                    </div>
                    <h2>What it actually feels like.</h2>
                    <p>
                        Concrete is more persuasive than abstract. Three short
                        scenarios from real use.
                    </p>
                </div>

                {STORIES.map((s) => (
                    <Story key={s.meta.num} data={s} />
                ))}
            </div>
        </section>
    );
}
