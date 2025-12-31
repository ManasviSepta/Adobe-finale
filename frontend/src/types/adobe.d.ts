declare global {
  interface Window {
    AdobeDC: {
      View: {
        new (config: {
          clientId: string;
          divId: string;
        }): AdobeDCView;
        Enum: {
          ViewMode: {
            FIT_PAGE: string;
          };
        };
      };
    };
  }
}

interface AdobeDCView {
  previewFile(
    fileConfig: {
      content: { location: { url: string } };
      metaData: { fileName: string; id: string };
    },
    viewerConfig?: any
  ): Promise<AdobeViewerInstance>;
  destroy?(): void;
}

interface AdobeViewerInstance {
  getAPIs(): Promise<AdobeViewerAPIs>;
}

interface AdobeViewerAPIs {
  gotoLocation(pageNumber: number): Promise<void>;
  search(searchText: string): Promise<AdobeSearchObject>;
}

interface AdobeSearchObject {
  onResultsUpdate(callback: (result: SearchResult) => void): AdobeSearchObject;
  next(): void;
  previous(): void;
  clear(): void;
  catch(errorCallback: (error: any) => void): AdobeSearchObject;
}

interface SearchResult {
  currentPage: number;
  currentSearchResultIndex: number;
  totalSearchResults: number;
}

export {};
