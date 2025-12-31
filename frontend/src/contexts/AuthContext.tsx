import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User } from '../types';
import { apiService } from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session and restore token
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('authToken');
    
    if (savedUser && savedToken) {
      // Restore both user data and token
      setUser(JSON.parse(savedUser));
      apiService.setToken(savedToken);
      console.log('🔑 Restored user session and token from localStorage');
    } else if (savedUser && !savedToken) {
      // User data exists but no token - clear invalid session
      console.warn('⚠️ User data found but no token - clearing invalid session');
      localStorage.removeItem('user');
      localStorage.removeItem('pdfs');
      localStorage.removeItem('selectedPdfId');
      localStorage.removeItem('authToken');
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    setIsLoading(true);
    try {
      // First clear any existing user data
      localStorage.removeItem('user');
      localStorage.removeItem('pdfs');
      localStorage.removeItem('selectedPdfId');
      localStorage.removeItem('authToken');
      
      // Then attempt login
      const response = await apiService.login(email, password);
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name
      };
      
      // Set user data
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Force reload to ensure clean state
      window.location.href = window.location.origin;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, name: string): Promise<void> => {
    setIsLoading(true);
    try {
      // First clear any existing user data
      localStorage.removeItem('user');
      localStorage.removeItem('pdfs');
      localStorage.removeItem('selectedPdfId');
      localStorage.removeItem('authToken');
      
      // Then attempt signup
      const response = await apiService.signup(email, password, name);
      const userData: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name
      };
      
      // Set user data
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
      
      // Force reload to ensure clean state
      window.location.href = window.location.origin;
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    apiService.logout();
    setUser(null);
    
    // Clear all user-related data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('pdfs');
    localStorage.removeItem('selectedPdfId');
    localStorage.removeItem('authToken');
    
    // Force reload to clear state and redirect to home page
    window.location.href = window.location.origin;
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};