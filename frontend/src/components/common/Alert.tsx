import React, { useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { Button } from './Button';

interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'error' | 'warning' | 'info' | 'success';
  autoClose?: boolean;
  autoCloseTime?: number;
}

export const Alert: React.FC<AlertProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = 'error',
  autoClose = false,
  autoCloseTime = 5000
}) => {
  useEffect(() => {
    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseTime);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose, autoClose, autoCloseTime]);

  if (!isOpen) return null;

  const typeClasses = {
    error: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="fixed inset-0 bg-black bg-opacity-25" 
        onClick={onClose}
      />
      <div className={`relative p-4 rounded-lg shadow-lg ${typeClasses[type]} max-w-md w-full`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {title && (
              <h3 className="font-medium">{title}</h3>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 ml-auto -mr-1 text-current hover:opacity-75 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="mt-2">
          <p className="text-sm">{message}</p>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
};