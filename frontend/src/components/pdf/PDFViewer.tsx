import React, { useEffect, useRef, useState } from 'react';
import { FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useAdobeAPI } from '../../hooks/useAdobeAPI';
import { apiService } from '../../services/api';
import { Button } from '../common/Button';
import { ADOBE_CONFIG } from '../../config/adobe';

export const PDFViewer: React.FC = () => {
  const { state, dispatch } = useApp();
  const { waitForAdobeAPI, setupTextSelectionListener } = useAdobeAPI();
  const viewerRef = useRef<HTMLDivElement & { adobeDCView?: any }>(null);
  const initializedPdfRef = useRef<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);
  const searchObjectRef = useRef<any>(null); // Store the search object for highlighting control

  const [error, setError] = useState<string | null>(null);

  const selectedPDF = state.pdfs.find(pdf => pdf.id === state.selectedPdfId);

  // Cleanup function that runs when component unmounts or PDF changes
  useEffect(() => {
    return () => {
      // Clean up Adobe viewer instance if it exists
      if (viewerRef.current && viewerRef.current.adobeDCView) {
        try {
          const adobeDCView = viewerRef.current.adobeDCView;
          if (adobeDCView && typeof adobeDCView.destroy === 'function') {
            adobeDCView.destroy();
            console.log('Adobe viewer instance destroyed');
          }
        } catch (error) {
          console.error('Error destroying Adobe viewer:', error);
        }
        viewerRef.current.adobeDCView = null;
      }
      // Reset initialized PDF ref
      initializedPdfRef.current = null;
      
      // Clear any pending highlight timeouts
      if (highlightTimeoutRef.current) {
        window.clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      
      // Clear any active search/highlighting
      if (searchObjectRef.current) {
        try {
          searchObjectRef.current.clear();
          searchObjectRef.current = null;
        } catch (error) {
          console.warn('Error clearing search object:', error);
        }
      }
    };
  }, [selectedPDF?.id]);

  // Reset initializedPdfRef when PDF changes so viewer can be re-initialized
  useEffect(() => {
    if (selectedPDF) {
      // Reset the initialized ref when switching to a different PDF
      if (initializedPdfRef.current !== selectedPDF.id) {
        console.log('Switching to different PDF, resetting initialization state');
        initializedPdfRef.current = null;
        // Clear any existing viewer
        if (viewerRef.current?.adobeDCView) {
          try {
            viewerRef.current.adobeDCView.destroy();
            console.log('Destroyed previous viewer instance');
          } catch (error) {
            console.warn('Error destroying previous viewer:', error);
          }
          viewerRef.current.adobeDCView = null;
        }
        
        // Clear any active search/highlighting when switching PDFs
        if (searchObjectRef.current) {
          try {
            searchObjectRef.current.clear();
            searchObjectRef.current = null;
          } catch (error) {
            console.warn('Error clearing search object when switching PDFs:', error);
          }
        }
      }
    }
  }, [selectedPDF?.id]);

  // Handle PDF selection changes without auto-initializing
  useEffect(() => {
    if (selectedPDF && viewerRef.current) {
              // Clear any previous viewer content when PDF changes
        if (viewerRef.current.innerHTML && !viewerRef.current.adobeDCView) {
          console.log('Clearing previous viewer content for new PDF');
          viewerRef.current.innerHTML = '';
          setError(null);
        }
    }
  }, [selectedPDF?.id]);

  // Function to clear any existing highlights (used when opening from uploaded PDFs)
  const clearHighlights = async () => {
    if (searchObjectRef.current) {
      try {
        console.log('🧹 Clearing existing highlights');
        searchObjectRef.current.clear();
        searchObjectRef.current = null;
      } catch (error) {
        console.warn('Error clearing highlights:', error);
      }
    }
  };

  // Function to highlight text using Adobe PDF Embed API search
  const highlightTextInPDF = async (searchText: string): Promise<boolean> => {
    if (!viewerRef.current?.adobeDCView) {
      console.warn('Adobe viewer not ready for highlighting');
      return false;
    }

    try {
      console.log('🔍 Highlighting text:', searchText);
      
      // Clear any existing highlights first
      await clearHighlights();
      
      // Get the Adobe viewer APIs
      const apis = await viewerRef.current.adobeDCView.getAPIs();
      
      // Execute search and get the search object
      const searchObject = await apis.search(searchText);
      
      // Store the search object for later control
      searchObjectRef.current = searchObject;
      
      // Set up the results update callback to know when highlighting is complete
      searchObject.onResultsUpdate((result: any) => {
        console.log('🔍 Search results updated:', result);
        console.log(`📄 Page ${result.currentPage}, Result ${result.currentSearchResultIndex + 1} of ${result.totalSearchResults}`);
      }).catch((error: any) => {
        console.error('Error in search results update callback:', error);
      });
      
      console.log('✅ Text highlighted successfully');
      return true;
    } catch (error) {
      console.error('Error highlighting text:', error);
      return false;
    }
  };

  // Function to get full section content and highlight it
  const highlightSectionContent = async (pdfId: string, pageNumber: number) => {
    try {
      console.log(`🔍 Getting section content for PDF ${pdfId}, page ${pageNumber}`);
      
      // Get the full section content from backend
      const response = await apiService.getSectionContent(pdfId, pageNumber);
      
      if (response.sections && response.sections.length > 0) {
        // Combine all section content for highlighting
        const fullContent = response.sections
          .map(section => `${section.section_title}. ${section.content}`)
          .join(' ');
        
        // Extract a meaningful search term (first few words of the first section)
        const firstSection = response.sections[0];
        let searchTerm = firstSection.section_title;
        
        // If no section title, use the first meaningful phrase from content
        if (!searchTerm || searchTerm.length < 3) {
          const words = firstSection.content.split(' ').filter(word => word.length > 2);
          searchTerm = words.slice(0, 5).join(' ');
        }
        
        // Log both the full content and search term for debugging
        console.log('🔍 Full section content length:', fullContent.length);
        console.log('🔍 Using search term for highlighting:', searchTerm);
        console.log('🔍 Search term length:', searchTerm.length);
        
        // Validate that we have meaningful content to highlight
        if (!searchTerm || searchTerm.trim().length < 5) {
          console.warn('⚠️ Search term too short, skipping highlighting');
          return;
        }
        
        if (fullContent.trim().length < 15) {
          console.warn('⚠️ Section content too short, skipping highlighting');
          return;
        }
        
        // Wait a bit for the PDF to fully render after navigation
        if (highlightTimeoutRef.current) {
          clearTimeout(highlightTimeoutRef.current);
        }
        
        highlightTimeoutRef.current = window.setTimeout(async () => {
          // Try to highlight with the primary search term
          const success = await highlightTextInPDF(searchTerm);
          
          // If the search term is too short, try with a longer phrase
          if (success && searchTerm.length < 15 && fullContent.length > 50) {
            // Extract a longer, more distinctive phrase from the content
            const words = fullContent.split(' ').filter(word => word.length > 1);
            const longerPhrase = words.slice(0, 10).join(' ');
            if (longerPhrase.length > searchTerm.length) {
              console.log('🔍 Trying longer phrase for better highlighting:', longerPhrase);
              // Small delay to avoid conflicts
              setTimeout(() => highlightTextInPDF(longerPhrase), 500);
            }
          }
        }, 1000); // Wait 1 second after navigation completes
      }
    } catch (error) {
      console.error('Error getting section content for highlighting:', error);
    }
  };

  // Unified initialization flow - handles both left panel selection and insight card navigation
  useEffect(() => {
    console.log('🔍 Unified initialization useEffect triggered:', {
      selectedPDF: selectedPDF?.name,
      selectedPdfId: selectedPDF?.id,
      lastNavigation: state.lastNavigation,
      currentPage: state.currentPage,
      isInitialized: initializedPdfRef.current === selectedPDF?.id
    });

    // Only initialize if we have a selected PDF
    if (!selectedPDF) {
      console.log('No PDF selected, skipping initialization');
      return;
    }

    // Determine if we need to initialize
    const needsInitialization = !initializedPdfRef.current || 
                               initializedPdfRef.current !== selectedPDF.id;

    if (needsInitialization) {
      console.log('🔄 PDF needs initialization, starting...');
      
      const initializeViewer = async () => {
        try {
          // Wait for Adobe API to be ready
          const apiReady = await waitForAdobeAPI();
          
          if (apiReady) {
            console.log('Adobe PDF Embed API is ready, initializing viewer...');
            await initializeAdobeViewer();
          } else {
            console.error('Adobe PDF Embed API failed to load');
            setError('Adobe PDF Embed API failed to load. Please refresh the page.');
          }
        } catch (error) {
          console.error('Error during viewer initialization:', error);
          setError('Failed to initialize PDF viewer. Please try again.');
        }
      };
      
      initializeViewer();
    } else {
      console.log('✅ PDF already initialized, skipping');
    }
  }, [selectedPDF?.id, state.lastNavigation, state.currentPage, waitForAdobeAPI]);

  const initializeAdobeViewer = async () => {
    try {
      console.log('%c Initializing Adobe PDF Embed API viewer...', 'background: #4CAF50; color: white; padding: 2px 4px; border-radius: 2px;');
      console.log('Selected PDF:', selectedPDF?.name);
      
      if (!viewerRef.current || !selectedPDF) {
        console.error('Missing viewer ref or selected PDF');
        return;
      }

      // Prevent multiple initializations for the same PDF
      if (initializedPdfRef.current === selectedPDF.id && viewerRef.current.adobeDCView) {
        console.log('✅ PDF already initialized, skipping re-initialization');
        return;
      }

      setError(null);

      // Clear previous content and destroy existing viewer
      if (viewerRef.current.adobeDCView) {
        try {
          viewerRef.current.adobeDCView.destroy();
          console.log('Destroyed previous Adobe viewer instance');
        } catch (error) {
          console.warn('Error destroying previous viewer:', error);
        }
      }
      
      viewerRef.current.innerHTML = '';
      viewerRef.current.adobeDCView = null;
      console.log('Cleared viewer container');

      // Check if file exists
      if (!selectedPDF.file) {
        console.error('File object is missing');
        setError('PDF file is not available. Please re-upload the PDF.');
        return;
      }

      // Create file URL
      const fileURL = URL.createObjectURL(selectedPDF.file);
      console.log('File URL created:', fileURL);
      
      // Check if Adobe PDF Embed API is available
      if (typeof window.AdobeDC === 'undefined') {
        console.error('Adobe PDF Embed API not available - script may not be loaded');
        console.log('window.AdobeDC:', window.AdobeDC);
        setError('Adobe PDF Embed API is required but not available. Please check your internet connection and refresh the page.');
        return;
      }
      
      console.log('Adobe PDF Embed API is available:', window.AdobeDC);
      
      // Ensure the viewer div has an ID and is visible
      if (!viewerRef.current.id) {
        viewerRef.current.id = 'adobe-dc-view';
      }

      // Fetch Adobe client ID at runtime from backend
      const clientResp = await fetch('/api/config/adobe-embed-key');
      const clientJson = await clientResp.json();
      const clientId = clientJson?.clientId || ADOBE_CONFIG.CLIENT_ID;
      if (!clientId) {
        throw new Error('Adobe Embed API client ID is not configured');
      }

      // Create an instance of Adobe DC View SDK
      console.log('Creating Adobe DC View instance with client ID:', clientId);
      const adobeDCView = new window.AdobeDC.View({
        clientId,
        divId: viewerRef.current.id,
      });
      
      console.log('Adobe DC View instance created:', adobeDCView);
      
      // Set up text selection listener BEFORE previewing the file
      const setAdobeViewerInstance = setupTextSelectionListener(adobeDCView, (selectedText: string) => {
        console.log('🎯 Text selected in PDF:', selectedText);
        console.log('🎯 Dispatching to global state...');
        // Dispatch action to update job description with selected text
        dispatch({ 
          type: 'SET_SELECTED_TEXT_FROM_PDF', 
          payload: selectedText 
        });
        console.log('🎯 Dispatched successfully');
      });
      
      // Get the target page to navigate to
      const targetPage = state.currentPage && state.currentPage > 1 ? state.currentPage : 1;
      console.log('🔍 Page number analysis:', {
        stateCurrentPage: state.currentPage,
        targetPage: targetPage,
        willNavigateTo: state.currentPage > 1 ? state.currentPage : 'page 1 (default)'
      });
      
      // Create a custom configuration for the PDF viewer using ADOBE_CONFIG
      const viewerConfig = {
        ...ADOBE_CONFIG.VIEWER_SETTINGS,
        // Override specific settings for this viewer instance
        defaultViewMode: window.AdobeDC.View.Enum.ViewMode.FIT_WIDTH, // Changed to FIT_WIDTH for better zoom
        defaultZoom: 1.2, // Set default zoom to make PDF appear more zoomed in
        // Control which buttons appear in the toolbar
        showToolbarControls: {
          fullScreen: true,  // Ensure full screen button is visible
          zoom: true,
          search: true,
          pageNav: true,
          bookmark: true,
          download: true,
          print: true,
          secondaryToolbar: true,  // This is the three dots menu
          leftPanel: false,
          rightPanel: false
        },
      };
      
      // Log the configuration for debugging
      console.log('PDF viewer configuration:', viewerConfig);
      
      // Using the exact format shared by the user's friend
      const previewFilePromise = adobeDCView.previewFile({
        content: {
          location: {
            url: fileURL,
          }
        },
        metaData: {
          fileName: selectedPDF.name,
          id: selectedPDF.id.toString()
        } as any
      }, viewerConfig);
      
      // Handle the previewFilePromise exactly as shown in the reference
      (previewFilePromise as any).then((adobeViewer: any) => {
        console.log('Adobe viewer instance received:', adobeViewer);
        
        // Set the Adobe viewer instance for text selection
        if (setAdobeViewerInstance) {
          setAdobeViewerInstance(adobeViewer);
        }
        
        // Store the Adobe DC View instance in a ref for later use
        if (viewerRef.current) {
          viewerRef.current.adobeDCView = adobeViewer;
        }
        initializedPdfRef.current = selectedPDF.id; // Mark as initialized
        
        console.log('%c Adobe PDF Embed API viewer initialized successfully', 'background: #4CAF50; color: white; padding: 2px 4px; border-radius: 2px;');
        setError(null); // Clear any previous errors
        
        // Navigate to target page if one is specified (for insight cards)
        if (state.currentPage && state.currentPage > 1) {
          console.log(`🎯 Navigating to page ${state.currentPage} after viewer is ready`);
          
          // Use gotoLocation method exactly as shown in the reference
          adobeViewer.getAPIs().then((apis: any) => {
            apis.gotoLocation(state.currentPage)
              .then(() => {
                console.log("Success");
                setError(null);
                
                // After navigation completes, highlight the section content
                // Only if this is from an insight card (not from uploaded PDF section)
                if (state.lastNavigation && state.currentPage > 1) {
                  console.log('🎯 Navigation completed, will highlight section content');
                  highlightSectionContent(selectedPDF.id, state.currentPage);
                }
              })
              .catch((error: any) => console.log(error));
          });
        } else {
          // Opening from uploaded PDFs section (page 1) - clear any existing highlights
          console.log('📄 Opening PDF on page 1, clearing any existing highlights');
          clearHighlights();
        }
      }).catch((error: any) => {
        console.error('Error in previewFilePromise:', error);
        setError(`Failed to initialize PDF viewer: ${error?.message || 'Unknown error'}`);
      });
      

      
    } catch (error: any) {
      console.error('Error initializing PDF viewer:', error);
      setError(`Failed to load PDF viewer: ${error?.message || 'Unknown error'}`);
    }
  };
  
  // Navigate to page when currentPage changes or when navigation is triggered
  useEffect(() => {
    console.log('🔍 Navigation useEffect triggered:', {
      currentPage: state.currentPage,
      selectedPDF: selectedPDF?.name,
      lastNavigation: state.lastNavigation,
      hasAdobeViewer: !!viewerRef.current?.adobeDCView,
      isInitialized: initializedPdfRef.current === selectedPDF?.id,
      pageNumberType: typeof state.currentPage,
      pageNumberValue: state.currentPage
    });
    
    // Navigate to the specified page when all conditions are met
    if (state.currentPage && selectedPDF && state.lastNavigation && 
        initializedPdfRef.current === selectedPDF.id && 
        viewerRef.current?.adobeDCView) {
      
      // Navigate to the target page using Adobe PDF Embed API with gotoLocation
      (async () => {
        try {
          if (!viewerRef.current?.adobeDCView) {
            console.error('Adobe DC View instance not available in useEffect');
            return;
          }
          
          // Wait a moment for the viewer to be fully ready
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Use gotoLocation method exactly as shown in the reference
          if (viewerRef.current?.adobeDCView) {
            viewerRef.current.adobeDCView.getAPIs().then((apis: any) => {
              apis.gotoLocation(state.currentPage)
                .then(() => {
                  console.log("Success");
                  setError(null);
                  
                  // After navigation completes, highlight the section content
                  // Only if this is from an insight card (not from uploaded PDF section)
                  if (state.lastNavigation && state.currentPage > 1) {
                    console.log('🎯 Navigation completed, will highlight section content');
                    highlightSectionContent(selectedPDF.id, state.currentPage);
                  } else if (state.currentPage === 1) {
                    // Opening from uploaded PDFs section (page 1) - clear any existing highlights
                    console.log('📄 Navigation to page 1, clearing any existing highlights');
                    clearHighlights();
                  }
                })
                .catch((error: any) => console.log(error));
            });
          }
          
        } catch (error) {
          console.error('Error with Adobe PDF Embed API navigation from useEffect:', error);
        }
      })();
      
    } else {
      console.log('Navigation conditions not met:', {
        hasCurrentPage: !!state.currentPage,
        hasSelectedPDF: !!selectedPDF,
        hasLastNavigation: !!state.lastNavigation,
        isInitialized: initializedPdfRef.current === selectedPDF?.id,
        hasAdobeViewer: !!viewerRef.current?.adobeDCView
      });
    }
  }, [state.lastNavigation, selectedPDF?.id, initializedPdfRef.current, state.currentPage]);

  if (!selectedPDF) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No PDF Selected
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Select a PDF from the left panel to view it here
          </p>
        </div>
      </div>
    );
  }
  
  // PDF selected but file not available
  if (selectedPDF && !selectedPDF.file && error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-orange-600 dark:text-orange-400 mb-2">
            PDF File Not Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            The PDF file needs to be re-fetched from the server to view it.
          </p>
          <Button
             onClick={async () => {
               // No loading state as per user request
               setError(null);
               try {
                 console.log('Re-fetching PDF:', selectedPDF.id);
                 const response = await apiService.getPDF(selectedPDF.id);
                 if (response.file) {
                   console.log('PDF re-fetched successfully');
                   dispatch({
                     type: 'UPDATE_PDF',
                     payload: {
                       ...selectedPDF,
                       file: response.file
                     }
                   });
                   
                   // Clear the viewer container
                   if (viewerRef.current) {
                     viewerRef.current.innerHTML = '';
                   }
                   
                   // Re-initialize viewer after a short delay
                   setTimeout(() => {
                     console.log('Re-initializing Adobe PDF viewer...');
                     initializeAdobeViewer();
                     // Loading state kept off as per user request
                   }, 500);
                 } else {
                   throw new Error('PDF file not found in response');
                 }
               } catch (error: any) {
                 console.error('Failed to re-fetch PDF:', error);
                 setError(`Failed to download PDF: ${error?.message || 'Unknown error'}`);
                 // No loading state as per user request
               }
             }}
             variant="primary"
           >
             <RefreshCw className="w-4 h-4 mr-2" />
             Re-fetch PDF
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      
      {/* PDF Viewer Container */}
      <div className="flex-1 relative">
        {/* Adobe PDF Embed API Container */}
        <div
          ref={viewerRef}
          id="adobe-dc-view"
          className="absolute inset-0 w-full h-full bg-white"
          style={{ minHeight: '500px', border: '1px solid #e5e7eb' }}
        />
        

        
        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 bg-opacity-75 z-30">
            <div className="text-center max-w-md mx-4">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {error}
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1">
                <p>Adobe PDF Embed API is required to view PDFs</p>
                {error.includes('not loaded') && (
                  <p className="text-blue-600 dark:text-blue-400">
                    💡 Try refreshing the page or check your internet connection
                  </p>
                )}
                {error.includes('not properly initialized') && (
                  <p className="text-blue-600 dark:text-blue-400">
                    💡 Wait a moment for the viewer to load, then try again
                  </p>
                )}
                {error.includes('navigation is not available') && (
                  <p className="text-blue-600 dark:text-blue-400">
                    💡 Refresh the page to reinitialize the viewer
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};