import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from '../redux/hooks';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAppSelector((state) => state.auth)
    const location = useLocation()

    if (isLoading) {
        return null
    }

    if (!isAuthenticated) {
        //if not loged in, jump to login page and record the origin navigation
        return <Navigate to="/login" state={{ from: location }} replace />
    }
    return <>{children}</>
}

export default ProtectedRoute;