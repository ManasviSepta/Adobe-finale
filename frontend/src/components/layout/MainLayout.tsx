import React, { useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Header } from './Header';
import { PDFList } from '../pdf/PDFList';
import { PDFUpload } from '../pdf/PDFUpload';
import { PDFViewer } from '../pdf/PDFViewer';
import { InsightsPanel } from '../insights/InsightsPanel';
import { LibraryPanel } from '../library/LibraryPanel';
import { useApp } from '../../contexts/AppContext';

export const MainLayout: React.FC = () => {
  const { state, dispatch } = useApp();

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Only set left panel to true if it was previously open
        // Don't force it open on desktop resize
      } else {
        // On mobile, close both panels
        dispatch({ type: 'SET_LEFT_PANEL', payload: false });
        dispatch({ type: 'SET_RIGHT_PANEL', payload: false });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [dispatch]);

  return (
    <div className="h-screen bg-gray-100 dark:bg-gray-900 flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - PDF List */}
        <div 
          className={`
            ${state.leftPanelOpen ? 'translate-x-0' : '-translate-x-full'}
            fixed md:absolute left-0 top-12 bottom-0
            w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transition-transform duration-300 ease-in-out
            flex flex-col overflow-hidden z-40
            ${state.leftPanelOpen && state.panelStack[state.panelStack.length - 1] === 'left' 
              ? 'shadow-2xl border-blue-300 dark:border-blue-600' 
              : ''
            }
          `}
        >
          {/* Mobile Panel Header */}
          <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              PDFs
            </h2>
            <button
              onClick={() => {
                dispatch({ type: 'TOGGLE_LEFT_PANEL' });
                // If there are other open panels, bring the last one to front
                if (state.panelStack.length > 1) {
                  const otherPanels = state.panelStack.filter(p => p !== 'left');
                  if (otherPanels.length > 0) {
                    dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: otherPanels[otherPanels.length - 1] });
                  }
                }
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* PDF Upload Section */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <PDFUpload />
          </div>

          {/* PDF List */}
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <PDFList />
          </div>
        </div>

        {/* Library Panel - Overlaps from left */}
        <div 
          className={`
            ${state.libraryPanelOpen ? 'translate-x-0' : '-translate-x-full'}
            fixed md:absolute left-0 top-12 bottom-0
            w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700
            transition-transform duration-300 ease-in-out
            flex flex-col overflow-hidden z-50
            ${state.libraryPanelOpen && state.panelStack[state.panelStack.length - 1] === 'library' 
              ? 'shadow-2xl border-blue-300 dark:border-blue-600' 
              : ''
            }
          `}
        >
          {/* Mobile Panel Header */}
          <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Library
            </h2>
            <button
              onClick={() => {
                dispatch({ type: 'TOGGLE_LIBRARY_PANEL' });
                // If there are other open panels, bring the last one to front
                if (state.panelStack.length > 1) {
                  const otherPanels = state.panelStack.filter(p => p !== 'library');
                  if (otherPanels.length > 0) {
                    dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: otherPanels[otherPanels.length - 1] });
                  }
                }
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <LibraryPanel />
        </div>

        {/* Center Panel - PDF Viewer */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden mx-auto max-w-4xl px-4">
          <div className="flex-1 p-4 overflow-hidden">
            <PDFViewer />
          </div>
        </div>

        {/* Right Panel - Insights */}
        <div className={`
          ${state.rightPanelOpen ? 'translate-x-0' : 'translate-x-full'}
          fixed md:absolute right-0 top-12 bottom-0
          w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700
          transition-transform duration-300 ease-in-out z-40
          ${state.rightPanelOpen ? 'md:translate-x-0' : 'md:translate-x-full'}
        `}>
          {/* Mobile Panel Header */}
          <div className="md:hidden p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Insights
            </h2>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <InsightsPanel />
        </div>

        {/* Mobile Overlay for all panels */}
        {(state.leftPanelOpen || state.libraryPanelOpen || state.rightPanelOpen) && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
            onClick={() => {
              if (state.leftPanelOpen) dispatch({ type: 'SET_LEFT_PANEL', payload: false });
              if (state.libraryPanelOpen) dispatch({ type: 'SET_LIBRARY_PANEL', payload: false });
              if (state.rightPanelOpen) dispatch({ type: 'SET_RIGHT_PANEL', payload: false });
            }}
          />
        )}
      </div>
    </div>
  );
};