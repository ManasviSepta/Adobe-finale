import { useState, useEffect, useCallback } from 'react';

export type AdobeAPIStatus = 'unknown' | 'ready' | 'loading' | 'error';

export interface SelectedTextData {
  type: string;
  data: string;
}

export const useAdobeAPI = () => {
  const [status, setStatus] = useState<AdobeAPIStatus>('unknown');
  const [selectedText, setSelectedText] = useState<SelectedTextData | null>(null);

  // Check if Adobe PDF Embed API is loaded
  const checkAdobeAPIStatus = () => {
    if (typeof window.AdobeDC === 'undefined') {
      return { loaded: false, message: 'Adobe PDF Embed API not loaded' };
    }
    if (typeof window.AdobeDC.View === 'undefined') {
      return { loaded: false, message: 'Adobe PDF Embed API View not available' };
    }
    return { loaded: true, message: 'Adobe PDF Embed API ready' };
  };

  // Wait for Adobe API to be ready
  const waitForAdobeAPI = (maxAttempts = 10, interval = 500): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const check = () => {
        attempts++;
        const apiStatus = checkAdobeAPIStatus();
        
        if (apiStatus.loaded) {
          console.log('Adobe PDF Embed API is ready');
          resolve(true);
          return;
        }
        
        if (attempts >= maxAttempts) {
          console.error('Adobe PDF Embed API failed to load after maximum attempts');
          resolve(false);
          return;
        }
        
        console.log(`Adobe PDF Embed API not ready (attempt ${attempts}/${maxAttempts}), retrying...`);
        setTimeout(check, interval);
      };
      
      check();
    });
  };

  // Function to get selected text from Adobe viewer
  const getSelectedText = useCallback(async (adobeViewer: any): Promise<SelectedTextData | null> => {
    try {
      if (!adobeViewer) {
        console.warn('Adobe viewer not available for text selection');
        return null;
      }

      const apis = await adobeViewer.getAPIs();
      const result = await apis.getSelectedContent();
      
      console.log('Selected text result:', result);
      
      if (result && result.type && result.data) {
        return {
          type: result.type,
          data: result.data
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting selected text:', error);
      return null;
    }
  }, []);

  // Function to set up text selection event listener using the correct pattern
  const setupTextSelectionListener = useCallback((adobeDCView: any, onTextSelected?: (text: string) => void) => {
    try {
      if (!adobeDCView) {
        console.warn('Adobe DC View not available for setting up text selection listener');
        return;
      }

      // Check if Adobe API is available
      if (typeof window.AdobeDC === 'undefined' || !window.AdobeDC.View || !window.AdobeDC.View.Enum) {
        console.warn('Adobe PDF Embed API not available for text selection');
        return;
      }

      console.log('Setting up text selection listener with correct pattern...');

      // Store the callback for later use when we get the adobeViewer instance
      let adobeViewerInstance: any = null;
      let textSelectionCallback: ((text: string) => void) | undefined = onTextSelected;

      // Use the correct event listener pattern as shown in the example
      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        function(event: any) {
          // Only log PREVIEW_SELECTION_END events to reduce noise
          if (event.type === "PREVIEW_SELECTION_END") {
            console.log('🎯 Adobe event received:', event);
            console.log('🎯 Text selection ended, getting selected content...');
            
            // Only proceed if we have the adobeViewer instance
            if (adobeViewerInstance) {
              // Get the selected content using the correct pattern
              adobeViewerInstance.getAPIs().then((apis: any) => {
                console.log('🎯 Got Adobe APIs, calling getSelectedContent...');
                apis.getSelectedContent().then((result: any) => {
                  console.log("🎯 Selected text result:", result);
                  
                  if (result && result.data && result.data.trim()) {
                    console.log("🎯 Selected text:", result.data);
                    setSelectedText(result);
                    
                    // Call the callback if provided
                    if (textSelectionCallback) {
                      console.log('🎯 Calling onTextSelected callback...');
                      textSelectionCallback(result.data.trim());
                    }
                  } else {
                    console.log('🎯 No text selected or selection cleared');
                    setSelectedText(null);
                  }
                }).catch((error: any) => {
                  console.error('🎯 Error getting selected content:', error);
                });
              }).catch((error: any) => {
                console.error('🎯 Error getting Adobe APIs:', error);
              });
            } else {
              console.log('🎯 Adobe viewer instance not yet available, skipping text selection');
            }
          }
        },
        { enableFilePreviewEvents: true }
      );

      // Return a function to set the adobeViewer instance when it becomes available
      return (adobeViewer: any) => {
        adobeViewerInstance = adobeViewer;
        console.log('🎯 Adobe viewer instance set for text selection');
      };
      
    } catch (error) {
      console.error('Error setting up text selection listener:', error);
      return null;
    }
  }, []);

  // Check status on mount and when needed
  useEffect(() => {
    const checkStatus = async () => {
      setStatus('loading');
      try {
        const apiReady = await waitForAdobeAPI(5, 1000);
        setStatus(apiReady ? 'ready' : 'error');
      } catch (error) {
        console.error('Error checking Adobe API status:', error);
        setStatus('error');
      }
    };

    checkStatus();
  }, []);

  // Function to manually refresh status
  const refreshStatus = async () => {
    setStatus('loading');
    try {
      const apiReady = await waitForAdobeAPI(5, 1000);
      setStatus(apiReady ? 'ready' : 'error');
      return apiReady;
    } catch (error) {
      console.error('Error refreshing Adobe API status:', error);
      setStatus('error');
      return false;
    }
  };

  return {
    status,
    selectedText,
    checkAdobeAPIStatus,
    waitForAdobeAPI,
    refreshStatus,
    getSelectedText,
    setupTextSelectionListener,
    isReady: status === 'ready',
    isLoading: status === 'loading',
    hasError: status === 'error'
  };
};
