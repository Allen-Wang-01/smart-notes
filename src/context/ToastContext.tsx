import React, { createContext, useState, ReactNode, useCallback, Children } from 'react'

type ToastType = 'success' | 'error' | 'info'

type ToastContextType = {
    showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType>({ showToast: () => { } })
export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toast, setToast] = useState<{ message: string, type: ToastType } | null>(null)
    const showToast = useCallback((message: string, type: ToastType = 'info') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000) //自动隐藏
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    <span>{toast.message}</span>
                </div>
            )}
        </ToastContext.Provider>
    )
}
export default ToastContext;