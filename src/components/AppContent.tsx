import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { Navigate } from 'react-router-dom';
import { login, setLoading } from '../redux/slices/authSlice';
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
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)

    useEffect(() => {
        let isMounted = true;

        const attemptRefresh = async () => {

            if (isAuthenticated) {
                if (isMounted) dispatch(setLoading(false))
                return;
            }

            try {
                const { data } = await api.post('/auth/refresh');
                console.log(isMounted, "is Mounted")
                if (isMounted) {
                    dispatch(login({ accessToken: data.accessToken, user: data.user }));
                }
                console.log('AppContent logged in')
            } catch (err) {
                console.log('Refresh failed:', err);
                if (isMounted && !['/login', '/register'].includes(location.pathname)) {
                    navigate('/login', { replace: true });
                }
            } finally {
                if (isMounted) {
                    dispatch(setLoading(false))
                }
            }
        };

        attemptRefresh();

        return () => {
            isMounted = false;
        };
    }, []);

    const hideSidebar = !isAuthenticated ||
        location.pathname === '/login' ||
        location.pathname === '/register'


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
                            navigate('/')
                        }}
                        closeSidebar={closeSidebar}
                    />
                </div>
            )}
            <div
                className={styles.mainContent}
                onClick={isSidebarOpen ? closeSidebar : undefined} // close sidebar when clicked note
            >
                <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route
                        path="/"
                        element={
                            <ProtectedRoute>
                                <MainContent />
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
                    <Route
                        path="/note/:id"
                        element={
                            <ProtectedRoute>
                                <MainContent />
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