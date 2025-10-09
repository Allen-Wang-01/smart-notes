import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import ReportPage from './ReportPage';
import Login from './Login';
import Register from './Register';
import styles from '../styles/Main.module.scss'
const AppContent = () => {
    const location = useLocation()
    const hideSidebar = location.pathname === '/login' || location.pathname === '/register'
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const navigate = useNavigate()

    const handleNoteAdded = (noteId: string) => {
        setSelectedNoteId(noteId); // 跳转到新笔记
    };

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen)
    }

    const closeSidebar = () => {
        setIsSidebarOpen(false)
    }

    return (
        <div className={styles.appContainer}>
            {!hideSidebar && (
                <button
                    className={`${styles.hamburger} ${isSidebarOpen ? styles.sidebarOpen : ''}`}
                    onClick={toggleSidebar}
                    aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                    {isSidebarOpen ? '✕' : '☰'}
                </button>
            )}
            {!hideSidebar && (
                <div className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
                    <Sidebar
                        onNewNote={() => {
                            setSelectedNoteId(null)
                            navigate('/')
                        }}
                        onSelectNote={setSelectedNoteId}
                        closeSidebar={closeSidebar} // 传递关闭侧边栏的回调
                    />
                </div>
            )}
            <div
                className={styles.mainContent}
                onClick={isSidebarOpen ? closeSidebar : undefined} // 点击主内容关闭侧边栏
            >
                <Routes>
                    <Route
                        path="/"
                        element={<MainContent selectedNoteId={selectedNoteId} onNoteAdded={handleNoteAdded} />}
                    />
                    <Route path="/review" element={<ReportPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                </Routes>
            </div>
        </div>
    );
}

export default AppContent;