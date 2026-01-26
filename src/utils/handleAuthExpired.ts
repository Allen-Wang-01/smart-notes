import { store } from "../redux/store";
import { logout } from "../redux/slices/authSlice";
import { queryClient } from "../library/queryClient.ts";

export async function handleAuthExpired() {
    queryClient.clear()
    store.dispatch(logout())
}