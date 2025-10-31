import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface User {
    id: string;
    username: string;
    email: string;
}

interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
}

const initialState: AuthState = {
    isAuthenticated: false,
    user: null,
    accessToken: null,
    isLoading: true,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        login: (
            state,
            action: PayloadAction<{
                user: User;
                accessToken: string;
            }>
        ) => {
            state.isAuthenticated = true;
            state.user = action.payload.user;
            state.accessToken = action.payload.accessToken;
            state.isLoading = false;
        },
        updateAccessToken: (state, action: PayloadAction<string>) => {
            state.accessToken = action.payload
        },
        logout: (state) => {
            state.isAuthenticated = false;
            state.user = null;
            state.accessToken = null;
            state.isLoading = false;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.isLoading = action.payload
        }
    },
})

export const { login, updateAccessToken, logout, setLoading } = authSlice.actions;
export default authSlice.reducer;