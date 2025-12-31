import React, { createContext, useContext, useCallback, useState } from 'react';
import { ToastContainer } from '../components/common/ToastContainer';
import { ToastProps } from '../components/common/Toast';

type ToastContextType = {
  showToast: (props: Omit<ToastProps, 'id' | 'onClose'>) => string;
  hideToast: (id: string) => void;
  clearToasts: () => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

type ToastItem = ToastProps & { id: string };

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((toast: Omit<ToastProps, 'id' | 'onClose'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts(prev => [...prev, { ...toast, id, onClose: () => hideToast(id) }]);
    return id;
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, hideToast, clearToasts }}>
      {children}
      <ToastContainer 
        position="top-right"
        toasts={toasts}
        onClose={hideToast}
      />
    </ToastContext.Provider>
  );
};