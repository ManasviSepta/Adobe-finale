// API service for backend communication
// Using Vite proxy to avoid CORS issues
import { PDFFile } from '../types';

class ApiService {
  private baseURL: string;
  private token: string | null = null;

  constructor() {
    // Always use port 8080 for both development and production
    const protocol = window.location.protocol;
    const host = window.location.hostname;
    
    this.baseURL = `${protocol}//${host}:8080`;
    
    // Restore token from localStorage if it exists
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
      this.token = savedToken;
      console.log('🔑 Token restored from localStorage');
    }
    
    console.log(`🌐 API Service initialized for unified port setup`);
    console.log(`🔗 Base URL: ${this.baseURL}`);
    console.log(`🔑 Token status: ${this.token ? 'Present' : 'Not found'}`);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private getMultipartHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
      credentials: 'include'
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // For auth endpoints with 401, clear token and use backend error message
        if (response.status === 401 && endpoint.includes('/auth/')) {
          console.error('Authentication failed - clearing token');
          this.setToken(null);
          throw new Error(errorData.error || 'Authentication failed');
        }
        
        // For other errors, use the backend error message or generic message
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    console.log('Attempting login for:', email);
    const response = await this.request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    console.log('Login response received:', response);
    this.setToken(response.token);
    console.log('Token set after login:', response.token ? 'Token exists' : 'No token');
    return response;
  }

  async signup(email: string, password: string, name: string) {
    const response = await this.request<{ token: string; user: any }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    
    this.setToken(response.token);
    return response;
  }

  async logout() {
    this.setToken(null);
  }

  // Check if a PDF with the same name already exists in the current PDFs
  async checkDuplicatePDF(filename: string): Promise<{isDuplicate: boolean, existingPdf?: any}> {
    try {
      // Get current PDFs
      const { pdfs } = await this.getPDFs();
      
      // Check if any PDF has the same name (case insensitive)
      const normalizedFilename = filename.toLowerCase();
      const existingPdf = pdfs.find(pdf => 
        pdf.name.toLowerCase() === normalizedFilename || 
        pdf.originalFilename.toLowerCase() === normalizedFilename
      );
      
      return {
        isDuplicate: !!existingPdf,
        existingPdf: existingPdf || undefined
      };
    } catch (error) {
      console.error('Error checking for duplicate PDF:', error);
      // If there's an error, assume it's not a duplicate to allow the upload attempt
      return { isDuplicate: false };
    }
  }

  // PDF endpoints
  async uploadPDFs(files: File[]): Promise<{pdfs: any[]}> {
    // Check if user is authenticated
    if (!this.token) {
      throw new Error('Authentication required to upload PDFs');
    }

    const formData = new FormData();
    files.forEach(file => {
      formData.append('pdfs', file);
    });

    const uploadUrl = `${this.baseURL}/api/pdfs/upload`;
    
    const headers = this.getMultipartHeaders();
    
    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: headers,
        body: formData,
        credentials: 'include'
      });

      if (response.status === 401) {
        // Token is invalid or expired
        console.error('Authentication token expired or invalid');
        // Clear the token
        this.setToken(null);
        throw new Error('Your session has expired. Please log in again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data || !data.pdfs || !Array.isArray(data.pdfs)) {
        console.error('Invalid response format from server:', data);
        throw new Error('Invalid response format from server');
      }
      
      return data;
    } catch (error) {
      console.error('PDF upload failed:', error);
      throw error;
    }
  }

  async getPDFs() {
    return this.request<{ pdfs: any[]; count: number }>('/api/pdfs');
  }

  async getPDF(id: string) {
    const response = await fetch(`${this.baseURL}/api/pdfs/${id}/download`, {
      method: 'GET',
      headers: this.getHeaders(),
      credentials: 'include'
    });

    if (!response.ok) {
      try {
        const errorData = await response.json();
        if (errorData.deleted) {
          throw new Error('PDF_DELETED');
        }
      } catch (e) {
        // If we can't parse the response or it doesn't have deleted flag
        // just throw the original error
      }
      throw new Error(`Failed to download PDF: ${response.statusText}`);
    }

    const blob = await response.blob();
    const file = new File([blob], `pdf-${id}.pdf`, { type: 'application/pdf' });
    
    return { file };
  }

  async deletePDF(id: string) {
    // Convert string ID to integer for backend compatibility
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      throw new Error('Invalid PDF ID format');
    }
    
    try {
      return await this.request(`/api/pdfs/${numericId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error(`Failed to delete PDF with ID ${numericId}:`, error);
      throw new Error('Failed to delete PDF from server');
    }
  }

  // Insights endpoints
  async generateInsights(pdfIds: string[], jobToBeDone: string) {
    console.log('Making insights request with:', { pdfIds, jobToBeDone });
    const response = await this.request<any>('/api/insights/generate', {
      method: 'POST',
      body: JSON.stringify({
        pdfIds,
        jobToBeDone,
      }),
    });
    console.log('Insights API response:', response);
    return response;
  }

  async generateEnhancedInsights(pdfIds: string[], jobToBeDone: string, currentCardId?: string) {
    console.log('Making enhanced insights request with:', { pdfIds, jobToBeDone, currentCardId });
    const response = await this.request<any>('/api/insights/enhanced-generate', {
      method: 'POST',
      body: JSON.stringify({
        pdfIds,
        jobToBeDone,
        currentCardId,
      }),
    });
    console.log('Enhanced insights API response:', response);
    return response;
  }

  async generateLLMInsightsForAll(insights: any[]) {
    console.log('Generating LLM insights for all cards:', insights.length);
    const response = await this.request<any>('/api/insights/generate-llm-insights', {
      method: 'POST',
      body: JSON.stringify({
        insights: insights,
      }),
    });
    console.log('LLM insights response:', response);
    return response;
  }

  async generateInsightBulb(insight: any) {
    console.log('Getting pre-generated insights for:', insight);
    const response = await this.request<any>('/api/insights/bulb', {
      method: 'POST',
      body: JSON.stringify({
        fileName: insight.fileName,
        heading: insight.heading,
        snippet: insight.snippet,
        pageNumber: insight.pageNumber,
      }),
    });
    console.log('Insight bulb response:', response);
    return response;
  }

  async generateJobInsights(jobDescription: string) {
    console.log('Generating job insights for:', jobDescription);
    const response = await this.request<any>('/api/insights/job-insights', {
      method: 'POST',
      body: JSON.stringify({
        jobDescription,
      }),
    });
    console.log('Job insights response:', response);
    return response;
  }

  async checkModelStatus() {
    return this.request<{ status: string; message: string; available: boolean }>('/api/insights/model-status');
  }

  async getSectionContent(pdfId: string, pageNumber: number) {
    return this.request<{
      pdf_id: number;
      page_number: number;
      sections: Array<{
        section_title: string;
        content: string;
        page_number: number;
      }>;
    }>(`/api/insights/section-content/${pdfId}/${pageNumber}`);
  }

  // User endpoints
  async getUserProfile() {
    return this.request<{ user: any; stats: any }>('/api/user/profile');
  }

  // Health check
  async healthCheck() {
    return this.request<{ status: string; message: string }>('/api/health');
  }

  // Library endpoints
  async getLibraryPdfs() {
    try {
      return await this.request<{ pdfs: any[]; count: number }>('/api/library');
    } catch (error) {
      console.error('Error fetching library PDFs:', error);
      throw error;
    }
  }

  async getAllUserPdfs() {
    try {
      return await this.request<{ pdfs: any[]; count: number }>('/api/library/all-pdfs');
    } catch (error) {
      console.error('Error fetching all user PDFs:', error);
      throw error;
    }
  }

  async movePdfsToLibrary(pdfIds: string[]) {
    return this.request<{ 
      message: string; 
      movedToLibrary: string[]; 
      replacedInLibrary: string[]; 
      totalProcessed: number 
    }>('/api/pdfs/move-to-library', {
      method: 'POST',
      body: JSON.stringify({ pdfIds }),
    });
  }

  async movePdfsToUploads(pdfIds: string[]) {
    return this.request<{ message: string; movedPdfs: string[] }>('/api/library/move-to-uploads', {
      method: 'POST',
      body: JSON.stringify({ pdfIds }),
    });
  }

  async deleteLibraryPdfs(pdfIds: string[]) {
    return this.request<{ message: string; deletedPdfs: string[] }>('/api/library/delete', {
      method: 'DELETE',
      body: JSON.stringify({ pdfIds }),
    });
  }

  async clearUploads() {
    return this.request<{ message: string; movedCount: number }>('/api/pdfs/clear-uploads', {
      method: 'POST',
    });
  }

  // Generate bulb insights on-demand
  async generateBulbInsights(heading: string, content: string = '', pdfName?: string, pageNumber?: number) {
    const response = await this.request('/api/insights/generate-bulb-insights', {
      method: 'POST',
      body: JSON.stringify({
        heading,
        content,
        pdfName,
        pageNumber
      })
    });
    return response;
  }

  // Generate podcast on-demand
  async generatePodcast(heading: string, content: string, cardId: string, backsideInsights?: any, pdfName?: string, pageNumber?: number) {
    const response = await this.request('/api/insights/generate-podcast', {
      method: 'POST',
      body: JSON.stringify({
        heading,
        content,
        cardId,
        backsideInsights,
        pdfName,
        pageNumber
      })
    });
    return response;
  }
}

export const apiService = new ApiService();
export default apiService;