import styles from "../styles/SidebarToggle.module.scss";

interface SidebarToggleProps {
    isOpen: boolean;
    onToggle: () => void;
}

const SidebarToggle = ({ isOpen, onToggle }: SidebarToggleProps) => {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`${styles.toggle} ${isOpen ? styles.toggleOpen : ""}`}
            aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
            aria-expanded={isOpen}
        >
            {/* Two icons stacked, swapped via opacity + rotation transitions */}
            <span className={styles.iconWrap} aria-hidden="true">
                <span className={`${styles.icon} ${styles.iconMenu}`}>
                    <MenuIcon />
                </span>
                <span className={`${styles.icon} ${styles.iconClose}`}>
                    <CloseIcon />
                </span>
            </span>
        </button>
    );
};

const MenuIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
    >
        <path d="M3 6h14" />
        <path d="M3 10h14" />
        <path d="M3 14h14" />
    </svg>
);

const CloseIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
    >
        <path d="M5 5l10 10" />
        <path d="M15 5L5 15" />
    </svg>
);

export default SidebarToggle;