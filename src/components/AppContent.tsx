import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { Navigate } from 'react-router-dom';
import { login } from '../redux/slices/authSlice';
import api from '../api/axios';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import ReportPage from './ReportPage';
import Login from './Login';
import Register from './Register';
import ProtectedRoute from './ProtectedRoute';
import styles from '../styles/Main.module.scss'



const AppContent = () => {
    const dispatch = useAppDispatch()
    const location = useLocation()
    const navigate = useNavigate()
    const { isAuthenticated } = useAppSelector((state) => state.auth)
    const [isLoading, setIsLoading] = useState(true);
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        let isMounted = true;

        const attemptRefresh = async () => {

            if (isAuthenticated) {
                setIsLoading(false);
                return;
            }


            if (['/login', '/register'].includes(location.pathname)) {
                setIsLoading(false);
                return;
            }

            try {
                const { data } = await api.post('/auth/refresh');
                if (isMounted) {
                    dispatch(login({ accessToken: data.accessToken, user: data.user }));
                }
            } catch (err) {
                if (isMounted) {
                    navigate('/login');
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        attemptRefresh();

        return () => {
            isMounted = false;
        };
    }, []);



    if (isLoading) {
        return <div className={styles.loading}>Loading...</div>;
    }


    const hideSidebar = !isAuthenticated ||
        location.pathname === '/login' ||
        location.pathname === '/register'

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
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <MainContent selectedNoteId={selectedNoteId} onNoteAdded={handleNoteAdded} />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/review"
                        element={
                            <ProtectedRoute>
                                <ReportPage />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </div>
    );
}

export default AppContent;