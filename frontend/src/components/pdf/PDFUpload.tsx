import React, { useCallback, useEffect } from 'react';
import { Upload, FileText, X, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../contexts/AppContext';
import { PDFFile } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export const PDFUpload: React.FC = () => {
  const { state, dispatch } = useApp();
  const { showToast } = useToast();
  const MAX_PDFS = 15;

  // Check for PDFs without file objects on component mount and load library PDFs
  useEffect(() => {
    const pdfsWithoutFiles = state.pdfs.filter(pdf => !pdf.file);
    if (pdfsWithoutFiles.length > 0) {
      console.log(`Found ${pdfsWithoutFiles.length} PDFs without file objects`);
    }
    
    // Ensure library is updated when new PDFs are added
    const loadLibraryPdfs = async () => {
      try {
        await apiService.getLibraryPdfs();
      } catch (error) {
        console.error('Failed to refresh library PDFs:', error);
      }
    };
    
    loadLibraryPdfs();
  }, [state.pdfs]);

  // Function to re-fetch a PDF file from the backend
  const refetchPDF = useCallback(async (pdfId: string) => {
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      
      // Get the PDF file from the backend
      const response = await apiService.getPDF(pdfId);
      
      if (response.file) {
        // Update the PDF in state with the file object
        const updatedPdf = state.pdfs.find(pdf => pdf.id === pdfId);
        if (updatedPdf) {
          const pdfWithFile: PDFFile = {
            ...updatedPdf,
            file: response.file
          };
          dispatch({ type: 'UPDATE_PDF', payload: pdfWithFile });
        }
      }
    } catch (error) {
      console.error('Failed to refetch PDF:', error);
      // Handle error
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, [dispatch, state.pdfs]);

  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files) return;
    if (state.pdfs.length >= MAX_PDFS) {
      showToast({
        message: `You can only upload a maximum of ${MAX_PDFS} PDFs.`,
        type: 'warning'
      });
      return;
    }

    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      showToast({
        message: 'Please select valid PDF files.',
        type: 'error'
      });
      return;
    }

    // Check authentication status
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
      showToast({
        message: 'You need to be logged in to upload PDFs. Please log in and try again.',
        type: 'error'
      });
      return;
    }
    
    try {
      dispatch({ type: 'SET_PROCESSING', payload: true });
      
      // Upload all files - backend will handle duplicates by replacing them
      try {
        const response = await apiService.uploadPDFs(pdfFiles);
        
        // Add to local state with backend response data
        if (response && response.pdfs && Array.isArray(response.pdfs)) {
          response.pdfs.forEach((backendPdf: any, index: number) => {
            const pdfFile: PDFFile = {
              id: backendPdf.id,
              name: backendPdf.name,
              file: pdfFiles[index], // Keep file object for viewing
              uploadDate: new Date(backendPdf.uploadDate),
              pageCount: backendPdf.pageCount || 0,
              processing_status: backendPdf.processingStatus || 'completed'
            };
            dispatch({ type: 'ADD_PDF', payload: pdfFile });
          });
        } else {
          console.error('Invalid response format:', response);
          throw new Error('Invalid response format from server');
        }
        
        if (pdfFiles.length > 0) {
          showToast({
            message: `Successfully uploaded ${pdfFiles.length} PDF(s). Existing files were replaced.`,
            type: 'success'
          });
        }
      } catch (uploadError: any) {
        if (uploadError.message === 'Authentication required to upload PDFs' || 
            uploadError.message === 'Your session has expired. Please log in again.' ||
            uploadError.message.includes('UNAUTHORIZED')) {
          showToast({
            message: 'Your session has expired. Please log in again to upload PDFs.',
            type: 'error'
          });
          // Clear auth token to force re-login
          localStorage.removeItem('authToken');
          // Redirect to login
          window.location.href = window.location.origin;
        } else {
          showToast({
            message: `PDF upload failed: ${uploadError.message || 'Unknown error'}. Please try again.`,
            type: 'error'
          });
        }
      }
    } catch (error: any) {
      console.error('PDF upload process failed:', error);
      showToast({
        message: `PDF upload failed: ${error.message || 'Unknown error'}. Please try again.`,
        type: 'error'
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
    }
  }, [dispatch, state.pdfs.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileUpload(e.dataTransfer.files);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileUpload(e.target.files);
  }, [handleFileUpload]);

  const removePDF = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_PDF', payload: id });
  }, [dispatch]);

  // Count PDFs that need to be re-fetched
  const pdfsNeedingRefetch = state.pdfs.filter(pdf => !pdf.file).length;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors cursor-pointer"
      >
        <input
          type="file"
          multiple
          accept=".pdf"
          onChange={handleInputChange}
          className="hidden"
          id="pdf-upload"
        />
        <label htmlFor="pdf-upload" className="cursor-pointer">
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Drop PDF files here or click to upload
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Support for multiple files
          </p>
        </label>
      </div>

      {/* Upload Button */}
      <Button
        onClick={() => document.getElementById('pdf-upload')?.click()}
        className="w-full"
        variant="outline"
      >
        <Upload className="w-4 h-4 mr-2" />
        Choose PDF Files
      </Button>

      {/* Re-fetch PDFs Button - Only show if there are PDFs that need to be re-fetched */}
      {pdfsNeedingRefetch > 0 && (
        <div className="mt-4">
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {pdfsNeedingRefetch} PDF{pdfsNeedingRefetch !== 1 ? 's' : ''} need to be re-fetched to view them
            </p>
          </div>
          <Button
            onClick={async () => {
              // Re-fetch all PDFs that don't have file objects
              const promises = state.pdfs
                .filter(pdf => !pdf.file)
                .map(pdf => refetchPDF(pdf.id));
              
              await Promise.all(promises);
            }}
            className="w-full"
            variant="primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Re-fetch PDF Files ({pdfsNeedingRefetch})
          </Button>
        </div>
      )}
    </div>
  );
};