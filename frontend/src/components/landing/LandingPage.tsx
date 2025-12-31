import React, { useState } from 'react';
import { Upload, FileText, Brain, Zap, Moon, Sun } from 'lucide-react';
import { Button } from '../common/Button';
import { AuthModal } from '../auth/AuthModal';
import { useTheme } from '../../contexts/ThemeContext';

interface LandingPageProps {
  onUploadClick: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onUploadClick }) => {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { darkMode, toggleDarkMode } = useTheme();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-indigo-900">
      {/* Header */}
      <header className="relative px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-2">
            <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              PDF Research Companion
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleDarkMode}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            
            <Button
              variant="outline"
              onClick={() => setAuthModalOpen(true)}
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="px-6 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
            Transform Static PDFs into
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              {' '}Dynamic Research Tools
            </span>
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-3xl">
            Upload your PDFs and get intelligent insights based on your specific research goals and requirements.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button
              size="lg"
              onClick={onUploadClick}
              className="text-lg px-8 py-4"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload PDFs to Start
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              onClick={() => setAuthModalOpen(true)}
              className="text-lg px-8 py-4"
            >
              Sign In to Continue
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mt-16">
            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Smart PDF Viewer
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Advanced PDF viewing with Adobe Embed API integration and programmatic navigation to specific sections.
              </p>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="text-center">
                <Brain className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  AI-Powered Insights
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Extract relevant insights based on your job requirements with intelligent content analysis.
                </p>
              </div>
            </div>

            <div className="p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Instant Navigation
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Jump directly to relevant sections across multiple PDFs with one click and visual highlighting.
              </p>
            </div>
          </div>
        </div>
      </main>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};