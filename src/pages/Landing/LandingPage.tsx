import { useEffect } from 'react';
import styles from './LandingPage.module.scss';

import Topbar from './sections/Topbar';
import Hero from './sections/Hero';
import Letter from './sections/Letter';
import Pillars from './sections/Pillars';
import Different from './sections/Different';
import Stories from './sections/Stories';
import HowItWorks from './sections/HowItWorks';
import WhoFor from './sections/WhoFor';
import Frame from './sections/Frame';
import Faq from './sections/Faq';
import FinalCta from './sections/FinalCta';
import Footer from './sections/Footer';

export default function LandingPage() {
    // Set the page title and meta description on mount
    useEffect(() => {
        const prevTitle = document.title;
        document.title =
            'Hindsight — A reflective layer between you and your own thoughts';
        return () => {
            document.title = prevTitle;
        };
    }, []);

    return (
        <div className={styles.page}>
            <Topbar />
            <main>
                <Hero />
                <Letter />
                <Pillars />
                <Different />
                <Stories />
                <HowItWorks />
                <WhoFor />
                <Frame />
                <Faq />
                <FinalCta />
            </main>
            <Footer />
        </div>
    );
}
