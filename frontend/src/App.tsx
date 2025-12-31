import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppProvider } from './contexts/AppContext';
import { ToastProvider } from './contexts/ToastContext';
import { LandingPage } from './components/landing/LandingPage';
import { MainLayout } from './components/layout/MainLayout';
import { AuthModal } from './components/auth/AuthModal';

const AppContent: React.FC = () => {
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleUploadClick = () => {
    if (!user) {
      setShowAuthModal(true);
    }
  };

  if (!user) {
    return (
      <>
        <LandingPage onUploadClick={handleUploadClick} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
        />
      </>
    );
  }

  return <MainLayout />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <div className="min-h-screen transition-colors duration-200">
              <AppContent />
            </div>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;