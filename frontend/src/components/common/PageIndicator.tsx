import React from 'react';
import { FileText } from 'lucide-react';

interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
  fileName: string;
  isNavigating?: boolean;
}

export const PageIndicator: React.FC<PageIndicatorProps> = ({
  currentPage,
  totalPages,
  fileName,
  isNavigating = false
}) => {
  return (
    <div className={`flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 transition-all duration-300 ${isNavigating ? 'animate-pulse' : ''}`}>
      <div className="flex items-center space-x-2">
        <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
          {fileName}
        </span>
      </div>
      
      <div className="flex items-center space-x-2">
        {isNavigating && (
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-blue-600 dark:text-blue-400">Navigating...</span>
          </div>
        )}
        
        <div className="text-sm text-blue-700 dark:text-blue-300">
          Page <span className="font-bold">{currentPage}</span> of {totalPages}
        </div>
      </div>
    </div>
  );
};
