import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';
import type { ReactNode } from 'react';

type Differentiator = { title: ReactNode; body: ReactNode };

const DIFFERENTIATORS = [
    {
        title: (
            <>
                It understands <em>why</em> you saved something.
            </>
        ),
        body: 'A poem you wrote and a poem by Murakami you saved are completely opposite signals about you — one expresses your state, the other reveals your resonance. That single distinction changes everything downstream.',
    },
    {
        title: "It's not memory. It's reflection.",
        body: 'Memory features log facts silently in the background — fragmented, low-signal, never shown back. Hindsight is the opposite. You curate what goes in. The system curates what comes out. Once a week, you read it.',
    },
    {
        title: "It's not a knowledge base. It's a mirror.",
        body: 'A knowledge base is a warehouse — you put things in and retrieve things out. A mirror does something only it can do: it shows you something you couldn\'t otherwise see. The output isn\'t your input.',
    },
    {
        title: 'It makes generic AI personal.',
        body: (
            <>
                Through MCP, your Claude or ChatGPT goes from{' '}
                <em>smart stranger</em> to <em>informed friend</em> in any
                conversation that touches your life — career, learning,
                decisions. You stop having to re-introduce yourself.
            </>
        ),
    },
    {
        title: 'Quality in, not noise in.',
        body: "You decide what's worth saving. The system never harvests your chats, indexes your messages, or builds a profile from data exhaust. The signal-to-noise ratio is high because you're the curator.",
    },
];

function Row({ item }: { item: Differentiator }) {
    const r = useReveal(styles);
    return (
        <div
            ref={r.ref}
            className={`${styles.diffRow} ${styles.reveal} ${r.revealClass}`}
        >
            <h4>{item.title}</h4>
            <p>{item.body}</p>
        </div>
    );
}

export default function Different() {
    const intro = useReveal(styles);

    return (
        <section className={styles.different}>
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 03</span>
                        <span>What makes it different</span>
                    </div>
                    <h2>The space is crowded. This product isn't in it.</h2>
                    <p>
                        Note apps store. Memory features log. Knowledge bases
                        warehouse. Hindsight does something none of them do.
                    </p>
                </div>

                <div className={styles.diffList}>
                    {DIFFERENTIATORS.map((d, i) => (
                        <Row key={i} item={d} />
                    ))}
                </div>
            </div>
        </section>
    );
}
