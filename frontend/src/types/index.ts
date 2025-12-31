export interface User {
  id: string;
  email: string;
  name: string;
}

export interface PDFFile {
  id: string;
  name: string;
  file?: File; // Optional because it's not persisted to localStorage
  uploadDate: Date;
  pageCount?: number;
  processing_status?: 'pending' | 'completed' | 'error';
}

export interface Insight {
  id: string;
  fileName: string;
  heading: string;
  snippet: string;
  pageNumber: number;
  importance: 'high' | 'medium' | 'low';
  relevanceScore: number;
  backsideInsights?: {
    keyInsights: string[];
    didYouKnow: string[];
    contradictions: string[];
    inspirations: string[];
  } | null;
}

export interface Podcast {
  audioPath: string;
  fileName: string;
  cardId: string;
  cardTitle: string;
  duration: string;
  format: string;
}

export interface InsightRequest {
  jobToBeDone: string;
  pdfIds: string[];
}

export interface AppState {
  user: User | null;
  pdfs: PDFFile[];
  selectedPdfId: string | null;
  insights: Insight[];
  isProcessing: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  libraryPanelOpen: boolean;
  darkMode: boolean;
  currentPage: number;
  totalPages: number;
  isNavigating: boolean;
  selectedLibraryPdfs: string[];
  podcasts: Podcast[]; // Changed from single podcast to array
  selectedTextFromPDF: string | null;
  jobToBeDone: string;
  lastNavigation?: number; // Timestamp for tracking navigation events
  insightsFromLibrary: boolean; // Toggle between uploaded PDFs only vs all library PDFs
  // Panel stacking order - the last opened panel gets highest priority
  panelStack: string[]; // Array of panel names in order of opening
}

export interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}