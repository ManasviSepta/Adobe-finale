import React from 'react';
import { X, FileText, LogOut, Moon, Sun, Zap, PanelLeft, PanelRight } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useApp } from '../../contexts/AppContext';
import { useTheme } from '../../contexts/ThemeContext';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { state, dispatch } = useApp();
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <header className="sticky top-0 z-[60] bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                PDF Research Companion
              </span>
            </div>
          </div>

          {/* Center Section - Panel Controls */}
          <div className="flex items-center space-x-2">
            {/* Left Panel Toggle */}
            <Button
              variant={state.leftPanelOpen ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                dispatch({ type: 'TOGGLE_LEFT_PANEL' });
                if (!state.leftPanelOpen) {
                  dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: 'left' });
                }
              }}
              className={`hidden md:flex relative ${
                state.leftPanelOpen && state.panelStack[state.panelStack.length - 1] === 'left'
                  ? 'ring-2 ring-blue-500 ring-offset-2'
                  : ''
              }`}
            >
              <PanelLeft className="w-4 h-4 mr-1" />
              PDFs
              {state.leftPanelOpen && state.panelStack[state.panelStack.length - 1] === 'left' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: 'TOGGLE_LEFT_PANEL' });
                if (!state.leftPanelOpen) {
                  dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: 'left' });
                }
              }}
              className="md:hidden"
            >
              <PanelLeft className="w-4 h-4" />
              PDFs
            </Button>
            
            {/* Library Panel Toggle */}
            <Button
              variant={state.libraryPanelOpen ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => {
                dispatch({ type: 'TOGGLE_LIBRARY_PANEL' });
                if (!state.libraryPanelOpen) {
                  dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: 'library' });
                }
              }}
              className={`hidden md:flex relative ${
                state.libraryPanelOpen && state.panelStack[state.panelStack.length - 1] === 'library'
                  ? 'ring-2 ring-blue-500 ring-offset-2'
                  : ''
              }`}
            >
              <FileText className="w-4 h-4 mr-1" />
              Library
              {state.libraryPanelOpen && state.panelStack[state.panelStack.length - 1] === 'library' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full"></div>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                dispatch({ type: 'TOGGLE_LIBRARY_PANEL' });
                if (!state.libraryPanelOpen) {
                  dispatch({ type: 'BRING_PANEL_TO_FRONT', payload: 'library' });
                }
              }}
              className="md:hidden"
            >
              <FileText className="w-4 h-4" />
              Library
            </Button>
            
            {/* Right Panel Toggle */}
            <Button
              variant={state.rightPanelOpen ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => dispatch({ type: 'TOGGLE_RIGHT_PANEL' })}
            >
              <PanelRight className="w-4 h-4 mr-1" />
              Insights
            </Button>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {user && (
              <div className="flex items-center space-x-3">
                <span 
                  className="text-sm text-gray-600 dark:text-gray-300 hidden sm:block cursor-help"
                  title={`Logged in as ${user.name}`}
                >
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:ml-1 sm:inline">Logout</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};