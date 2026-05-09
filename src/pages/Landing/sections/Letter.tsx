import styles from '../LandingPage.module.scss';
import { useReveal } from '../useReveal';

export default function Letter() {
    const intro = useReveal(styles);
    const card = useReveal(styles);

    return (
        <section className={styles.letterSection} id="letter">
            <div className={styles.wrap}>
                <div
                    ref={intro.ref}
                    className={`${styles.sectionIntro} ${styles.reveal} ${intro.revealClass}`}
                >
                    <div className={styles.sectionLabel}>
                        <span className={styles.num}>§ 01</span>
                        <span>The letter</span>
                    </div>
                    <h2>Show, don't analyze.</h2>
                    <p>
                        This is what arrives in your inbox on Sunday. Not a
                        summary. Not a report. A quiet observation of you,
                        grounded in things you actually wrote that week.
                    </p>
                </div>

                <article
                    ref={card.ref}
                    className={`${styles.letter} ${styles.reveal} ${card.revealClass}`}
                >
                    <header className={styles.letterHeader}>
                        <span>Hindsight &nbsp;·&nbsp; Vol. I, No. 12</span>
                        <span>Sunday, April 26</span>
                    </header>
                    <div className={styles.letterBody}>
                        <p className={styles.salutation}>Dear you,</p>

                        <p>
                            This week you wrote twelve notes. About{' '}
                            <em>career transition</em>, you took three days to
                            go from <em>"let me wait six more months"</em> to{' '}
                            <em>"I'll fix my resume tomorrow."</em>
                        </p>

                        <p>
                            I noticed something — you said{' '}
                            <strong>"uncertain"</strong> three times this week.
                            But each time, the next note had{' '}
                            <strong>"decided"</strong> or{' '}
                            <strong>"tomorrow."</strong> It looks like you use
                            writing to finish the conversion from uncertainty
                            to decision.
                        </p>

                        <p>
                            The heaviest entry this week was Wednesday night,
                            eight hundred words. It was the first time you
                            connected <em>"engineering honesty"</em> to{' '}
                            <em>"agent culture."</em> You may want to revisit
                            that one.
                        </p>

                        <p>
                            By the way — you haven't mentioned{' '}
                            <em>"Tokyo job"</em> in four weeks. But this week
                            you mentioned <em>"remote"</em> three times. I'm
                            not telling you what it means. Just pointing at
                            it.
                        </p>

                        <p className={styles.signoff}>
                            See you next week.
                            <br />— H.
                        </p>
                    </div>
                </article>
            </div>
        </section>
    );
}
