import { useState } from "react";
import { useSelector } from "react-redux";
import styles from "../styles/Greeting.module.scss";
import { pickGreeting } from "../utils/greeting";

// Selector: adjust the path / field name if your User type uses a different
// display field (e.g. `displayName`, `username`).
// `state: any` is used here to keep the component self-contained; if your
// project has a typed `RootState`, swap in `useAppSelector` and remove the any.
const selectUserName = (state: any): string | undefined =>
    state?.auth?.user?.username;

const Greeting = () => {
    const name = useSelector(selectUserName);

    // Lazy initializer: pick the variant once when the component mounts so it
    // stays stable across re-renders within the same visit.
    const [greeting] = useState(() => pickGreeting(name));

    return (
        <header className={styles.greeting}>
            <h1 className={styles.text}>{greeting}</h1>
        </header>
    );
};

export default Greeting;