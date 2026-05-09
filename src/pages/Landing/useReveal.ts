import { useEffect, useRef, useState } from 'react';

/**
 * Adds an `in` class when the element scrolls into view.
 * One-shot — unobserves after the first reveal.
 *
 * Usage:
 *   const { ref, revealClass } = useReveal(styles);
 *   <div ref={ref} className={`${styles.reveal} ${revealClass}`}>...</div>
 */
export function useReveal(styles: Record<string, string>) {
    const ref = useRef(null);
    const [shown, setShown] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        // Respect reduced motion
        if (
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
            setShown(true);
            return;
        }

        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setShown(true);
                        io.unobserve(entry.target);
                    }
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
        );

        io.observe(el);
        return () => io.disconnect();
    }, []);

    return {
        ref,
        revealClass: shown ? styles.in : '',
    };
}
