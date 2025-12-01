import { useParams } from "react-router-dom";
import NotePage from "./NotePage";
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
                    <NewNoteCard />
                </div>
            )}
        </div>
    )
}

export default MainContent;