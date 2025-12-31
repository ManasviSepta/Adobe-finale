import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react';
import { AppState, PDFFile, Insight, Podcast } from '../types';
import { apiService } from '../services/api';

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

type AppAction =
  | { type: 'ADD_PDF'; payload: PDFFile }
  | { type: 'REMOVE_PDF'; payload: string }
  | { type: 'UPDATE_PDF'; payload: PDFFile }
  | { type: 'SELECT_PDF'; payload: string | null }
  | { type: 'SET_INSIGHTS'; payload: Insight[] }
  | { type: 'SET_PROCESSING'; payload: boolean }
  | { type: 'SET_PODCASTS'; payload: Podcast[] } // Changed from SET_PODCAST
  | { type: 'SET_JOB_TO_BE_DONE'; payload: string }
  | { type: 'SET_SELECTED_TEXT'; payload: string | null }
  | { type: 'TOGGLE_LEFT_PANEL' }
  | { type: 'TOGGLE_RIGHT_PANEL' }
  | { type: 'TOGGLE_LIBRARY_PANEL' }
  | { type: 'SET_LEFT_PANEL'; payload: boolean }
  | { type: 'SET_RIGHT_PANEL'; payload: boolean }
  | { type: 'SET_LIBRARY_PANEL'; payload: boolean }
  | { type: 'SET_CURRENT_PAGE'; payload: number }
  | { type: 'SET_TOTAL_PAGES'; payload: number }
  | { type: 'LOAD_PERSISTED_DATA'; payload: Partial<AppState> }
  | { type: 'UPDATE_PDF_STATUS'; payload: { id: string; processing_status: 'pending' | 'completed' | 'error' } }
  | { type: 'NAVIGATE_TO_PAGE'; payload: { pdfId: string; pageNumber: number } }
  | { type: 'SET_NAVIGATING'; payload: boolean }
  | { type: 'INITIALIZE_VIEWER'; payload: { pdfId: string; pageNumber: number } }
  | { type: 'SET_SELECTED_TEXT_FROM_PDF'; payload: string }
  | { type: 'SELECT_LIBRARY_PDF'; payload: string }
  | { type: 'DESELECT_LIBRARY_PDF'; payload: string }
  | { type: 'SELECT_ALL_LIBRARY_PDFS' }
  | { type: 'DESELECT_ALL_LIBRARY_PDFS' }
  | { type: 'MOVE_TO_UPLOADS'; payload: string[] }
  | { type: 'DELETE_LIBRARY_PDFS'; payload: string[] }
  | { type: 'CLEAR_UPLOADS' }
  | { type: 'BRING_PANEL_TO_FRONT'; payload: string } // New action for z-index management
  | { type: 'SET_LAST_NAVIGATION'; payload: number } // Action for setting lastNavigation timestamp
  | { type: 'TOGGLE_INSIGHTS_SOURCE'; payload: boolean }; // Action for toggling between uploaded PDFs vs all library PDFs

const initialState: AppState = {
  user: null,
  pdfs: [],
  selectedPdfId: null,
  insights: [],
  isProcessing: false,
  leftPanelOpen: true,
  rightPanelOpen: true,
  libraryPanelOpen: false,
  darkMode: false,
  currentPage: 1,
  totalPages: 1,
  isNavigating: false,
  selectedLibraryPdfs: [],
  podcasts: [], // Changed from podcast: null
  selectedTextFromPDF: null,
  jobToBeDone: '',
  lastNavigation: Date.now(), // Initialize with current timestamp
  insightsFromLibrary: false, // Default to uploaded PDFs only
  // Panel stacking order - the last opened panel gets highest priority
  panelStack: ['left'], // Array of panel names in order of opening
};

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'ADD_PDF':
      // Check if PDF with same ID already exists to prevent duplicates
      const pdfExists = state.pdfs.some(pdf => pdf.id === action.payload.id);
      if (pdfExists) {
        // If PDF already exists, don't add it again
        return state;
      }
      return {
        ...state,
        pdfs: [...state.pdfs, action.payload]
      };
    case 'UPDATE_PDF':
      return {
        ...state,
        pdfs: state.pdfs.map(pdf => 
          pdf.id === action.payload.id ? action.payload : pdf
        ),
      };
    case 'REMOVE_PDF':
      return {
        ...state,
        pdfs: state.pdfs.filter(pdf => pdf.id !== action.payload),
        selectedPdfId: state.selectedPdfId === action.payload ? null : state.selectedPdfId,
      };
    case 'SELECT_PDF':
      return {
        ...state,
        selectedPdfId: action.payload,
        // Reset to page 1 when selecting from left panel
        currentPage: 1,
        // Force initialization by setting lastNavigation
        lastNavigation: Date.now(),
      };
    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: action.payload,
      };
    case 'SET_PROCESSING':
      return {
        ...state,
        isProcessing: action.payload,
      };
    case 'SET_PODCASTS': // Changed from SET_PODCAST
      return {
        ...state,
        podcasts: action.payload,
      };
    case 'SET_JOB_TO_BE_DONE':
      return {
        ...state,
        jobToBeDone: action.payload,
      };
    case 'SET_SELECTED_TEXT':
      return {
        ...state,
        selectedTextFromPDF: action.payload,
      };
    case 'TOGGLE_LEFT_PANEL':
      const newLeftPanelOpen = !state.leftPanelOpen;
      return {
        ...state,
        leftPanelOpen: newLeftPanelOpen,
        panelStack: newLeftPanelOpen 
          ? [...state.panelStack.filter(p => p !== 'left'), 'left'] // Bring to front
          : state.panelStack.filter(p => p !== 'left'), // Remove from stack
      };
    case 'TOGGLE_RIGHT_PANEL':
      return {
        ...state,
        rightPanelOpen: !state.rightPanelOpen,
      };
    case 'SET_LEFT_PANEL':
      return {
        ...state,
        leftPanelOpen: action.payload,
      };
    case 'SET_RIGHT_PANEL':
      return {
        ...state,
        rightPanelOpen: action.payload,
      };
    case 'SET_CURRENT_PAGE':
      return {
        ...state,
        currentPage: action.payload,
      };
    case 'SET_TOTAL_PAGES':
      return {
        ...state,
        totalPages: action.payload,
      };
    case 'LOAD_PERSISTED_DATA':
      return {
        ...state,
        ...action.payload,
      };
    case 'UPDATE_PDF_STATUS':
      return {
        ...state,
        pdfs: state.pdfs.map(pdf =>
          pdf.id === action.payload.id ? { ...pdf, processing_status: action.payload.processing_status } : pdf
        ),
      };
    case 'NAVIGATE_TO_PAGE':
      return {
        ...state,
        selectedPdfId: action.payload.pdfId,
        currentPage: action.payload.pageNumber,
        // Force a re-render by updating a timestamp
        lastNavigation: Date.now(),
      };
    case 'SET_NAVIGATING':
      return {
        ...state,
        isNavigating: action.payload,
      };
    case 'SET_LAST_NAVIGATION':
      return {
        ...state,
        lastNavigation: action.payload,
      };
    case 'INITIALIZE_VIEWER':
      console.log('🔍 INITIALIZE_VIEWER reducer called:', {
        payload: action.payload,
        currentState: {
          selectedPdfId: state.selectedPdfId,
          currentPage: state.currentPage
        }
      });
      const newState = {
        ...state,
        selectedPdfId: action.payload.pdfId,
        currentPage: action.payload.pageNumber,
        // Force a re-render by updating a timestamp to trigger navigation
        lastNavigation: Date.now(),
      };
      console.log('🔍 New state after INITIALIZE_VIEWER:', {
        selectedPdfId: newState.selectedPdfId,
        currentPage: newState.currentPage,
        lastNavigation: newState.lastNavigation
      });
      return newState;
    case 'SET_SELECTED_TEXT_FROM_PDF':
      return {
        ...state,
        selectedTextFromPDF: action.payload,
      };
    case 'TOGGLE_LIBRARY_PANEL':
      const newLibraryPanelOpen = !state.libraryPanelOpen;
      return {
        ...state,
        libraryPanelOpen: newLibraryPanelOpen,
        panelStack: newLibraryPanelOpen 
          ? [...state.panelStack.filter(p => p !== 'library'), 'library'] // Bring to front
          : state.panelStack.filter(p => p !== 'library'), // Remove from stack
      };
    case 'SET_LIBRARY_PANEL':
      return {
        ...state,
        libraryPanelOpen: action.payload,
        panelStack: action.payload 
          ? [...state.panelStack.filter(p => p !== 'library'), 'library'] // Bring to front
          : state.panelStack.filter(p => p !== 'library'), // Remove from stack
      };
    case 'SELECT_LIBRARY_PDF':
      return {
        ...state,
        selectedLibraryPdfs: [...state.selectedLibraryPdfs, action.payload],
      };
    case 'DESELECT_LIBRARY_PDF':
      return {
        ...state,
        selectedLibraryPdfs: state.selectedLibraryPdfs.filter(id => id !== action.payload),
      };
    case 'SELECT_ALL_LIBRARY_PDFS':
      // This is now handled in the LibraryPanel component
      // to properly select only filtered PDFs
      return state;
    case 'DESELECT_ALL_LIBRARY_PDFS':
      return {
        ...state,
        selectedLibraryPdfs: [],
      };
    case 'MOVE_TO_UPLOADS':
      // This will be handled by the API service
      return state;
    case 'DELETE_LIBRARY_PDFS':
      // This will be handled by the API service
      return state;
    case 'CLEAR_UPLOADS':
      return {
        ...state,
        pdfs: [], // Clear all PDFs from the uploads panel
      };
    case 'BRING_PANEL_TO_FRONT':
      return {
        ...state,
        panelStack: [...state.panelStack.filter(p => p !== action.payload), action.payload],
      };
    case 'TOGGLE_INSIGHTS_SOURCE':
      return {
        ...state,
        insightsFromLibrary: action.payload,
      };
    default:
      return state;
  }
};

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    // Load persisted data only if user is logged in
    const savedUser = localStorage.getItem('user');
    const savedSelectedPdf = localStorage.getItem('selectedPdfId');
    const authToken = localStorage.getItem('authToken');
    
    // Only load PDFs if user is logged in and has a valid token
    if (savedUser && authToken) {
      try {
        // Clear uploads panel when user logs in or refreshes
        const clearUploadsOnLogin = async () => {
          try {
            await apiService.clearUploads();
            console.log('✅ Cleared uploads panel on login/refresh');
          } catch (error) {
            console.error('Error clearing uploads on login:', error);
          }
        };
        
        clearUploadsOnLogin();
        
        // Initialize with empty PDFs list for uploads panel
        dispatch({
          type: 'LOAD_PERSISTED_DATA',
          payload: {
            pdfs: [], // Empty uploads panel by default
            selectedPdfId: null,
          },
        });
      } catch (error) {
        console.error('Error in initialization process:', error);
        // If there's an error, clear the localStorage
        localStorage.removeItem('pdfs');
        localStorage.removeItem('selectedPdfId');
      }
    } else if ((!savedUser || !authToken) && localStorage.getItem('pdfs')) {
      // If user is not logged in or has no token but PDFs exist in localStorage, clear them
      localStorage.removeItem('pdfs');
      localStorage.removeItem('selectedPdfId');
    }
  }, []);

  // Persist PDFs to localStorage (without File objects)
  useEffect(() => {
    if (state.pdfs.length > 0) {
      // Don't persist File objects as they can't be serialized
      const pdfsWithoutFiles = state.pdfs.map(pdf => ({
        id: pdf.id,
        name: pdf.name,
        uploadDate: pdf.uploadDate,
        pageCount: pdf.pageCount,
        processing_status: pdf.processing_status,
        // Exclude the file property
      }));
      localStorage.setItem('pdfs', JSON.stringify(pdfsWithoutFiles));
      
      // Ensure PDFs are committed to the database by refreshing the library
      const refreshLibrary = async () => {
        try {
          await apiService.getLibraryPdfs();
        } catch (error: any) {
          console.error('Failed to refresh library after PDF update:', error);
          
          // Handle authentication errors
          if (error.message === 'Your session has expired. Please log in again.' ||
              (error.message && error.message.includes('UNAUTHORIZED'))) {
            // Clear auth token to force re-login
            localStorage.removeItem('authToken');
            // We don't redirect here to avoid interrupting the user experience
            // The next explicit user action will trigger the redirect
          }
        }
      };
      
      refreshLibrary();
    }
  }, [state.pdfs]);

  // Persist selected PDF
  useEffect(() => {
    if (state.selectedPdfId) {
      localStorage.setItem('selectedPdfId', state.selectedPdfId);
    }
  }, [state.selectedPdfId]);

  // Poll for PDF processing status
  useEffect(() => {
    const pendingPdfs = state.pdfs.filter(pdf => pdf.processing_status === 'pending');
    
    if (pendingPdfs.length === 0) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await apiService.getPDFs();
        const backendPdfs = response.pdfs || [];
        
        // Update processing status for pending PDFs
        pendingPdfs.forEach(pendingPdf => {
          const backendPdf = backendPdfs.find(bp => bp.id === pendingPdf.id);
          if (backendPdf && backendPdf.processing_status !== pendingPdf.processing_status) {
            dispatch({
              type: 'UPDATE_PDF_STATUS',
              payload: {
                id: pendingPdf.id,
                processing_status: backendPdf.processing_status
              }
            });
          }
        });
      } catch (error: any) {
        console.error('Error polling PDF status:', error);
        
        // Handle authentication errors
        if (error.message === 'Your session has expired. Please log in again.' ||
            (error.message && error.message.includes('UNAUTHORIZED'))) {
          // Clear auth token to force re-login
          localStorage.removeItem('authToken');
          // We don't redirect here to avoid interrupting the user experience
          // The next explicit user action will trigger the redirect
        }
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [state.pdfs]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};