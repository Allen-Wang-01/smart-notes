import { useParams } from "react-router-dom";
import NotePage from "./NotePage";
import Greeting from "./Greeting";
import NewNoteCard from "./NewNoteCard";
import styles from "../styles/MainContent.module.scss";

const MainContent = () => {
    const { id } = useParams<{ id?: string }>()

    return (
        <div className={styles.mainContent}>
            {id ? (
                <NotePage />
            ) : (
                <div className={styles.newNoteContainer}>
                    <Greeting />
                    <NewNoteCard />
                </div>
            )}
        </div>
    )
}

export default MainContent;