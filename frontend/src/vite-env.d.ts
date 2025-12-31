/// <reference types="vite/client" />

// Adobe PDF Embed API TypeScript declarations
interface AdobeDCView {
  previewFile: (config: {
    content: { location: { url: string } };
    metaData: { fileName: string };
  }, viewerConfig?: any) => void;
  registerCallback: (
    callbackType: string,
    callback: (event: { type: string; data?: any }) => void,
    options?: any
  ) => void;
  gotoLocation: (page: number) => void;
}

interface AdobeDCViewConstructor {
  new (options: { clientId: string; divId: string }): AdobeDCView;
}

interface AdobeDCNamespace {
  View: AdobeDCViewConstructor & {
    Enum: {
      CallbackType: {
        EVENT_LISTENER: string;
      };
      ViewMode: {
        FIT_PAGE: string;
        FIT_WIDTH: string;
      };
    };
  };
}

interface Window {
  AdobeDC?: AdobeDCNamespace;
}