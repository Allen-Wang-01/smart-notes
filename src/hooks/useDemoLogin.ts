import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAppDispatch } from '../redux/hooks';
import { login } from '../redux/slices/authSlice';
import api from '../api/axios';

// Shared demo-login flow used by Login, Register, and the Landing Page hero.
// onError is optional so callers without local form-error state (e.g. Hero) can skip it.
export const useDemoLogin = (onError?: (message: string) => void) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const handleDemoLogin = async () => {
        try {
            const response = await api.post(`/auth/demo-login`);
            const { user, accessToken } = response.data;
            dispatch(login({ user, accessToken }));
            navigate('/home');
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Demo Login failed. Please try again';
            toast.error(errorMessage);
            onError?.(errorMessage);
        }
    };

    return handleDemoLogin;
};
