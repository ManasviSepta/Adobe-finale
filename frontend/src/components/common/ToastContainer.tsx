import React, { useEffect, useState } from 'react';
import { Toast, ToastProps } from './Toast';
import { createPortal } from 'react-dom';

export interface ToastContainerProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
  toasts: Array<ToastProps>;
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ 
  position = 'top-right',
  toasts,
  onClose
}) => {
  const [portalElement, setPortalElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Create portal element if it doesn't exist
    let element = document.getElementById('toast-portal');
    if (!element) {
      element = document.createElement('div');
      element.id = 'toast-portal';
      document.body.appendChild(element);
    }
    setPortalElement(element);

    return () => {
      // Clean up portal element on unmount
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    };
  }, []);

  // Position classes
  const positionClasses = {
    'top-right': 'fixed top-4 right-4',
    'top-left': 'fixed top-4 left-4',
    'bottom-right': 'fixed bottom-4 right-4',
    'bottom-left': 'fixed bottom-4 left-4',
    'top-center': 'fixed top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'fixed bottom-4 left-1/2 transform -translate-x-1/2'
  };

  if (!portalElement) return null;

  return createPortal(
    <div className={`${positionClasses[position]} z-[70] w-80 space-y-2`}>
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={onClose}
        />
      ))}
    </div>,
    portalElement
  );
};