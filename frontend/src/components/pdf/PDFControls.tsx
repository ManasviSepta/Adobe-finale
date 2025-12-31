import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { Button } from '../common/Button';

interface PDFControlsProps {
  className?: string;
}

export const PDFControls: React.FC<PDFControlsProps> = ({ className = '' }) => {
  const { state, dispatch } = useApp();
  
  const handlePageChange = (pageNumber: number) => {
    // Ensure page number is within valid range
    const validPage = Math.max(1, Math.min(pageNumber, state.totalPages));
    
    if (validPage !== state.currentPage) {
      // Trigger navigation to the new page
      dispatch({
        type: 'NAVIGATE_TO_PAGE',
        payload: {
          pdfId: state.selectedPdfId || '',
          pageNumber: validPage
        }
      });
    }
  };
  
  const goToFirstPage = () => handlePageChange(1);
  const goToPreviousPage = () => handlePageChange(state.currentPage - 1);
  const goToNextPage = () => handlePageChange(state.currentPage + 1);
  const goToLastPage = () => handlePageChange(state.totalPages);
  
  // Disable controls if no PDF is selected or if there's only one page
  const isDisabled = !state.selectedPdfId || state.totalPages <= 1;
  const isFirstPage = state.currentPage <= 1;
  const isLastPage = state.currentPage >= state.totalPages;
  
  return (
    <div className={`flex items-center justify-center space-x-2 ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={goToFirstPage}
        disabled={isDisabled || isFirstPage}
        title="First Page"
        className="px-2"
      >
        <ChevronsLeft className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={goToPreviousPage}
        disabled={isDisabled || isFirstPage}
        title="Previous Page"
        className="px-2"
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      
      <div className="text-sm font-medium">
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
          {state.currentPage}
        </span>
        <span className="mx-2 text-gray-500">
          of
        </span>
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
          {state.totalPages}
        </span>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={goToNextPage}
        disabled={isDisabled || isLastPage}
        title="Next Page"
        className="px-2"
      >
        <ChevronRight className="w-4 h-4" />
      </Button>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={goToLastPage}
        disabled={isDisabled || isLastPage}
        title="Last Page"
        className="px-2"
      >
        <ChevronsRight className="w-4 h-4" />
      </Button>
    </div>
  );
};