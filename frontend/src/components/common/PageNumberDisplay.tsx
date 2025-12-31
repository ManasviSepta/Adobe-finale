import React from 'react';
import { FileText } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';

export const PageNumberDisplay: React.FC = () => {
  const { state } = useApp();
  const selectedPDF = state.pdfs.find(pdf => pdf.id === state.selectedPdfId);

  if (!selectedPDF) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <FileText className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          No PDF
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
        {state.currentPage} / {state.totalPages}
      </span>
    </div>
  );
}; 