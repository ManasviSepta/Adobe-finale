import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Trash2, 
  Upload, 
  CheckSquare, 
  Square, 
  Search, 
  Calendar,
  FileX,
  CheckCircle
} from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../contexts/AppContext';
import { PDFFile } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export const LibraryPanel: React.FC = () => {
  const { state, dispatch } = useApp();
  const { showToast } = useToast();
  const [libraryPdfs, setLibraryPdfs] = useState<PDFFile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load library PDFs from backend
  useEffect(() => {
    // Load PDFs immediately when component mounts
    loadLibraryPdfs();
    
    // Set up interval to periodically refresh library PDFs
    const refreshInterval = setInterval(() => {
      loadLibraryPdfs();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  // Also reload library PDFs when auth state changes
  useEffect(() => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      loadLibraryPdfs();
    }
  }, [localStorage.getItem('authToken')]);

  const loadLibraryPdfs = async () => {
    try {
      setIsLoading(true);
      // Call the backend endpoint to get all user PDFs
      const response = await apiService.getLibraryPdfs();
      console.log('Library PDFs response:', response);
      
      if (response && response.pdfs) {
        // Format PDFs to match our application's expected format
        const formattedPdfs = response.pdfs.map((pdf: any) => ({
          id: pdf.id.toString(),
          name: pdf.name,
          uploadDate: pdf.uploadDate ? new Date(pdf.uploadDate) : new Date(),
          pageCount: pdf.pageCount || 0,
          processing_status: pdf.processing_status || 'completed',
          file_path: pdf.file_path
        }));
        
        console.log('Formatted PDFs:', formattedPdfs);
        setLibraryPdfs(formattedPdfs);
      } else {
        console.warn('No PDFs returned from API or invalid response format');
        setLibraryPdfs([]);
      }
    } catch (error: any) {
      console.error('Failed to load library PDFs:', error);
      
      // Handle authentication errors
      if (error.message === 'Your session has expired. Please log in again.' ||
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
        // Show error toast
        showToast({
          message: 'Failed to load PDFs from library. Please try again.',
          type: 'error'
        });
        // Fallback to current PDFs if API fails
        setLibraryPdfs(state.pdfs);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPdfs = libraryPdfs.filter(pdf =>
    (pdf.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPdf = (pdfId: string) => {
    if (state.selectedLibraryPdfs.includes(pdfId)) {
      dispatch({ type: 'DESELECT_LIBRARY_PDF', payload: pdfId });
    } else {
      dispatch({ type: 'SELECT_LIBRARY_PDF', payload: pdfId });
    }
  };

  const handleSelectAll = () => {
    if (state.selectedLibraryPdfs.length === filteredPdfs.length && filteredPdfs.length > 0) {
      dispatch({ type: 'DESELECT_ALL_LIBRARY_PDFS' });
    } else {
      // Get all IDs from filtered PDFs and select them
      const filteredIds = filteredPdfs.map(pdf => pdf.id);
      // Deselect all first to clear any existing selections
      dispatch({ type: 'DESELECT_ALL_LIBRARY_PDFS' });
      // Then select all filtered PDFs
      filteredIds.forEach(id => {
        dispatch({ type: 'SELECT_LIBRARY_PDF', payload: id });
      });
    }
  };

  const handleMoveToUploads = async () => {
    if (state.selectedLibraryPdfs.length === 0) return;
    
    try {
      setIsLoading(true);
      await apiService.movePdfsToUploads(state.selectedLibraryPdfs);
      
      // Remove from library and add to current uploads
      const selectedPdfs = libraryPdfs.filter(pdf => 
        state.selectedLibraryPdfs.includes(pdf.id)
      );
      
      // Fetch file data for each PDF and add to current PDFs
      const pdfsWithFiles = await Promise.all(
        selectedPdfs.map(async (pdf) => {
          try {
            // Fetch the PDF file data from backend
            const response = await apiService.getPDF(pdf.id);
            if (response.file) {
              return {
                ...pdf,
                file: response.file
              };
            }
            return pdf;
          } catch (error) {
            console.error(`Failed to fetch file for PDF ${pdf.id}:`, error);
            return pdf;
          }
        })
      );
      
      // Add to current PDFs if not already there (prevent duplicates by ID)
      pdfsWithFiles.forEach(pdf => {
        if (!state.pdfs.find(existing => existing.id === pdf.id)) {
          dispatch({ type: 'ADD_PDF', payload: pdf });
        }
      });
      
      // Clear selection
      dispatch({ type: 'DESELECT_ALL_LIBRARY_PDFS' });
      
      // Close library panel after successful upload
      dispatch({ type: 'SET_LIBRARY_PANEL', payload: false });
      
      // Show success message
      showToast({
        message: `Successfully moved ${selectedPdfs.length} PDF(s) to uploads`,
        type: 'success'
      });
    } catch (error: any) {
      console.error('Failed to move PDFs to uploads:', error);
      
      // Handle authentication errors
      if (error.message === 'Your session has expired. Please log in again.' ||
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
        showToast({
          message: 'Failed to move PDFs to uploads. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePdfs = async () => {
    if (state.selectedLibraryPdfs.length === 0) return;
    
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    try {
      setIsLoading(true);
      await apiService.deleteLibraryPdfs(state.selectedLibraryPdfs);
      
      // Remove from library
      setLibraryPdfs(prev => prev.filter(pdf => 
        !state.selectedLibraryPdfs.includes(pdf.id)
      ));
      
      // Clear selection
      dispatch({ type: 'DESELECT_ALL_LIBRARY_PDFS' });
      setShowDeleteConfirm(false);
      
      // Show success message
      showToast({
        message: `Successfully deleted ${state.selectedLibraryPdfs.length} PDF(s)`,
        type: 'success'
      });
    } catch (error: any) {
      console.error('Failed to delete PDFs:', error);
      
      // Handle authentication errors
      if (error.message === 'Your session has expired. Please log in again.' ||
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
        showToast({
          message: 'Failed to delete PDFs. Please try again.',
          type: 'error'
        });
      }
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Library
            </h2>
          </div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {libraryPdfs.length} PDFs
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search PDFs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 mb-4">
          <Button
            onClick={handleSelectAll}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            {state.selectedLibraryPdfs.length === filteredPdfs.length ? (
              <CheckSquare className="w-4 h-4 mr-1" />
            ) : (
              <Square className="w-4 h-4 mr-1" />
            )}
            {state.selectedLibraryPdfs.length === filteredPdfs.length ? 'Deselect All' : 'Select All'}
          </Button>
          
          {state.selectedLibraryPdfs.length > 0 && (
            <>
              <Button
                onClick={handleMoveToUploads}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="text-xs"
              >
                <Upload className="w-4 h-4 mr-1" />
                Move to Uploads ({state.selectedLibraryPdfs.length})
              </Button>
              
              <Button
                onClick={handleDeletePdfs}
                variant="danger"
                size="sm"
                disabled={isLoading}
                className="text-xs"
                title={showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* PDF List */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Loading library...
              </p>
            </div>
          </div>
        ) : filteredPdfs.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <FileX className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              {searchTerm ? 'No PDFs found matching your search' : 'No PDFs in library yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPdfs.map((pdf) => (
              <div
                key={pdf.id}
                className={`p-3 rounded-lg border transition-all duration-200 ${
                  state.selectedLibraryPdfs.includes(pdf.id)
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => handleSelectPdf(pdf.id)}
                    className="mt-1 flex-shrink-0"
                  >
                    {state.selectedLibraryPdfs.includes(pdf.id) ? (
                      <CheckSquare className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                    )}
                  </button>
                  
                  {/* PDF Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {pdf.name}
                      </h4>
                      {pdf.processing_status === 'completed' && (
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(pdf.uploadDate)}</span>
                      </div>
                      {pdf.pageCount && (
                        <span>{pdf.pageCount} pages</span>
                      )}
                      {/* Status indicators removed as per requirements */}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
