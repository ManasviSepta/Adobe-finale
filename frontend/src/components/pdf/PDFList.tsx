import React, { useEffect } from 'react';
import { FileText, Calendar, X } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export const PDFList: React.FC = () => {
  const { state, dispatch } = useApp();
  const { showToast } = useToast();

  // Check for unavailable PDFs when component mounts
  useEffect(() => {
    const checkUnavailablePDFs = async () => {
      // Create a copy of the PDFs array to avoid modification during iteration
      const pdfsToCheck = [...state.pdfs];
      
      for (const pdf of pdfsToCheck) {
        if (!pdf.file) {
          try {
            // Try to fetch the PDF
            await apiService.getPDF(pdf.id);
          } catch (error) {
            console.log(`PDF ${pdf.id} is unavailable, removing automatically`);
            // If PDF can't be fetched, remove it
            dispatch({ type: 'REMOVE_PDF', payload: pdf.id });
            try {
              // Also delete from the backend
              await apiService.deletePDF(pdf.id);
            } catch (deleteError) {
              console.error(`Failed to delete unavailable PDF from server:`, deleteError);
            }
          }
        }
      }
    };
    
    checkUnavailablePDFs();
  }, []); // Run only once when component mounts

  const selectPDF = (pdfId: string) => {
    dispatch({ type: 'SELECT_PDF', payload: pdfId });
  };

  const removePDF = async (e: React.MouseEvent, pdfId: string) => {
    e.stopPropagation(); // Prevent PDF selection when clicking delete
    
    // Only remove from UI without deleting from server
    dispatch({ type: 'REMOVE_PDF', payload: pdfId });
    console.log('PDF removed from UI:', pdfId);
  };

  if (state.pdfs.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>No PDFs uploaded yet</p>
      </div>
    );
  }

  const clearUploads = async () => {
    try {
      await apiService.clearUploads();
      dispatch({ type: 'CLEAR_UPLOADS' });
      showToast({
        message: 'Uploads panel cleared successfully',
        type: 'success'
      });
    } catch (error) {
      console.error('Error clearing uploads:', error);
      showToast({
        message: 'Failed to clear uploads panel',
        type: 'error'
      });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Uploaded PDFs
        </h2>
        {state.pdfs.length > 0 && (
          <button
            onClick={clearUploads}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:underline"
            title="Clear all PDFs from uploads panel (moves them to library)"
          >
            Clear All
          </button>
        )}
      </div>
      
      {state.pdfs.map((pdf, index) => (
        <div
          key={`pdf-${pdf.id}-${index}`} // Using pdf.id and index as a unique key
          onClick={() => selectPDF(pdf.id)}
          className={`
            p-4 rounded-lg cursor-pointer transition-all duration-200
            ${state.selectedPdfId === pdf.id
              ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700'
              : 'bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }
          `}
        >
          <div className="flex items-start space-x-3">
            <FileText className={`
              w-5 h-5 mt-0.5 flex-shrink-0
              ${state.selectedPdfId === pdf.id
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-400'
              }
            `} />
            
            <div className="flex-1 min-w-0">
              <h3 className={`
                text-sm font-medium truncate
                ${state.selectedPdfId === pdf.id
                  ? 'text-blue-900 dark:text-blue-100'
                  : 'text-gray-900 dark:text-white'
                }
              `}>
                {pdf.name}
              </h3>
              
              <div className="flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400">
                <Calendar className="w-3 h-3 mr-1" />
                {pdf.uploadDate instanceof Date ? pdf.uploadDate.toLocaleDateString() : new Date(pdf.uploadDate).toLocaleDateString()}
              </div>
              
              {!pdf.file && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-orange-600 dark:text-orange-400">⚠️ File not available</span>
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent PDF selection
                        // Call the API to re-fetch the PDF
                        apiService.getPDF(pdf.id).then(response => {
                          if (response.file) {
                            // Update the PDF in state with the file object
                            dispatch({
                              type: 'UPDATE_PDF',
                              payload: {
                                ...pdf,
                                file: response.file
                              }
                            });
                          }
                        }).catch(error => {
                          console.error('Failed to re-fetch PDF:', error);
                          // If file can't be fetched or was deleted on server, automatically remove it
                          if (error.message === 'PDF_DELETED') {
                            console.log(`PDF ${pdf.id} was deleted on server, removing from state`);
                            removePDF(e, pdf.id);
                          } else if (error.message === 'Your session has expired. Please log in again.' ||
                                    (error.message && error.message.includes('UNAUTHORIZED'))) {
                            showToast({
                              message: 'Your session has expired. Please log in again.',
                              type: 'error'
                            });
                            // Clear auth token to force re-login
                            localStorage.removeItem('authToken');
                            // Redirect to login
                            window.location.href = window.location.origin;
                          } else {
                            removePDF(e, pdf.id);
                          }
                        });
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Re-fetch
                    </button>
                    <button
                      onClick={(e) => removePDF(e, pdf.id)}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
              
            </div>
            
            <button
              onClick={(e) => removePDF(e, pdf.id)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};