// Adobe PDF Embed API Configuration
// Get your free Client ID from: https://www.adobe.com/go/dcsdks_credentials

export const ADOBE_CONFIG = {
  CLIENT_ID: '', // Fetched at runtime from backend `/api/config/adobe-embed-key`
  
  // Optional: Configure viewer settings
  VIEWER_SETTINGS: {
    // Document display settings
    defaultViewMode: 'FIT_WIDTH', // Changed from FIT_PAGE to FIT_WIDTH for better zoom
    defaultZoom: 1.2, // Add default zoom to make PDF appear more zoomed in when opened
    
    // Tool visibility settings
    showDownloadPDF: true,
    showPrintPDF: true,
    showLeftHandPanel: false,
    showAnnotationTools: true,
    showBookmarks: true,
    showThumbnails: true,
    showSecondaryToolbar: true, // This is the three dots menu
    showFindBar: true,
    showPageControls: true,
    showZoomControl: true,
    showFullScreen: true,
    showPageNavOverlay: true,
    showAnnotationRuler: false,
    showFormFilling: false,
    showBorders: false,
    showPageShadow: false,
    showPageNumber: true,
    showPageLabels: true,
    showToolbar: true,
    enableSearchAPIs: true,
    
    // Enable file preview events for text selection
    enableFilePreviewEvents: true,
    
    // Toolbar controls configuration
    showToolbarControls: {
      pageNav: true,
      zoom: true,
      search: true,
      fullScreen: true, // Ensure full screen button is visible
      download: true,
      print: true,
      bookmark: true,
      secondaryToolbar: true, // This is the three dots menu
      leftPanel: false,
      rightPanel: false,
    },
  },
};