import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

const FAQS = [
    {
        q: 'How is this different from ChatGPT memory or Claude memory?',
        a: (
            <p>
                Memory features log facts silently in the background,
                fragmented and low-signal, and never shown back to you.
                Hindsight inverts that: <em>you</em> decide what goes in,{' '}
                <em>the system</em> decides what comes out, and you read it
                once a week. It's curation on both ends, not a passive log.
            </p>
        ),
    },
    {
        q: 'How is this different from a notes app or journaling app?',
        a: (
            <p>
                A notes app is storage. A journaling app is a private mirror
                that only reflects what you put in. Hindsight is a different
                category — it observes patterns across your fragments and
                shows you something you couldn't otherwise see. The output is
                not your input.
            </p>
        ),
    },
    {
        q: 'What does the system actually see about me?',
        a: (
            <p>
                Only what you write or paste in. It does not harvest your
                chats, scrape your apps, or index your messages. There is no
                data exhaust. You are the curator; the signal-to-noise ratio
                is high because of that.
            </p>
        ),
    },
    {
        q: 'What is MCP, and why does this product use it?',
        a: (
            <p>
                MCP (Model Context Protocol) is the standard way for AI
                assistants to connect to outside context. Hindsight exposes a
                structured layer of you — your skills with their contexts,
                your active focuses, your recent state — through MCP, so
                Claude and ChatGPT can read it, with your permission, when you
                ask them something where it matters.
            </p>
        ),
    },
    {
        q: "What if a week doesn't have much in it?",
        a: (
            <p>
                The letter is short. Sometimes very short. The system has the
                discipline not to fabricate insight. Quiet weeks get quiet
                letters.
            </p>
        ),
    },
    {
        q: 'Will this make me more productive?',
        a: (
            <p>
                No. It is not a productivity tool. It will not make you
                faster, more efficient, or more optimized. It is meant to help
                you understand yourself better. That is a different thing.
            </p>
        ),
    },
    {
        q: 'Who owns the data?',
        a: (
            <p>
                You do. You can export everything you've written. You can
                delete it. The structured layer is derived from your writing
                and exists for you, not for anyone else.
            </p>
        ),
    },
];

export default function Faq() {
    const intro = useReveal(styles);
    const list = useReveal(styles);

    return (
        <section className={styles.faq} id="faq">
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 08</span>
                        <span>Things you might be wondering</span>
                    </div>
                    <h2>The questions that come up.</h2>
                </div>

                <div
                    ref={list.ref}
                    className={`${styles.faqList} ${styles.reveal} ${list.revealClass}`}
                >
                    {FAQS.map((f, i) => (
                        <details key={i} className={styles.faqItem}>
                            <summary>
                                {f.q}
                                <span className={styles.plus}>+</span>
                            </summary>
                            <div className={styles.answer}>{f.a}</div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
