import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Input } from '../common/Input';
import { Button } from '../common/Button';
import { useAuth } from '../../contexts/AuthContext';
import { CheckCircle, XCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Email validation constants
const EMAIL_MAX_LENGTH = 254;
const EMAIL_LOCAL_MAX_LENGTH = 64;
const EMAIL_DOMAIN_MAX_LENGTH = 253;

// Password validation constants
const PASSWORD_MIN_LENGTH = 5;
const PASSWORD_MAX_LENGTH = 128;

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'moderate' | 'strong'>('weak');
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup, isLoading } = useAuth();

  // Email validation function
  const validateEmail = (email: string): string => {
    if (!email) return '';
    
    // Check length limits
    if (email.length > EMAIL_MAX_LENGTH) {
      return `Email must be ${EMAIL_MAX_LENGTH} characters or less`;
    }
    
    // Check for @ symbol
    if (!email.includes('@')) {
      return 'Email must contain @ symbol';
    }
    
    const [localPart, domainPart] = email.split('@');
    
    // Check local part length
    if (localPart.length > EMAIL_LOCAL_MAX_LENGTH) {
      return `Part before @ must be ${EMAIL_LOCAL_MAX_LENGTH} characters or less`;
    }
    
    // Check domain part length
    if (domainPart.length > EMAIL_DOMAIN_MAX_LENGTH) {
      return `Domain part must be ${EMAIL_DOMAIN_MAX_LENGTH} characters or less`;
    }
    
    // Check for valid characters (only allow letters, numbers, and specific special chars)
    const validLocalChars = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
    const validDomainChars = /^[a-zA-Z0-9.-]+$/;
    
    if (!validLocalChars.test(localPart)) {
      return 'Email contains invalid characters. Only letters, numbers, and .!#$%&\'*+/=?^_`{|}~- are allowed';
    }
    
    if (!validDomainChars.test(domainPart)) {
      return 'Domain contains invalid characters. Only letters, numbers, . and - are allowed';
    }
    
    // Check for valid email format
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(email)) {
      return 'Please enter a valid email address';
    }
    
    return '';
  };

  // Password strength validation function
  const validatePassword = (password: string): { error: string; strength: 'weak' | 'moderate' | 'strong' } => {
    if (!password) return { error: '', strength: 'weak' };
    
    // Check length (these are hard requirements that block submission)
    if (password.length < PASSWORD_MIN_LENGTH) {
      return { 
        error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`, 
        strength: 'weak' 
      };
    }
    
    if (password.length > PASSWORD_MAX_LENGTH) {
      return { 
        error: `Password must be ${PASSWORD_MAX_LENGTH} characters or less`, 
        strength: 'weak' 
      };
    }
    
    // Check requirements (these are suggestions, not blockers)
    const hasCapital = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    let error = '';
    
    // Only show warnings for missing requirements, don't block submission
    if (!hasCapital || !hasNumber || !hasSpecial) {
      // Calculate strength based on what's present
      if (password.length >= 12 && hasCapital && hasNumber && hasSpecial) {
        strength = 'strong';
      } else if (password.length >= 8 && hasCapital && hasNumber && hasSpecial) {
        strength = 'moderate';
      } else {
        strength = 'weak';
      }
      // Don't set error - just show strength indicator
    } else {
      // All requirements met
      if (password.length >= 12) {
        strength = 'strong';
      } else {
        strength = 'moderate';
      }
    }
    
    return { error, strength };
  };

  // Real-time validation
  useEffect(() => {
    const emailValidation = validateEmail(email);
    setEmailError(emailValidation);
  }, [email]);

  useEffect(() => {
    const passwordValidation = validatePassword(password);
    setPasswordError(passwordValidation.error);
    setPasswordStrength(passwordValidation.strength);
  }, [password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Final validation before submission
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);
    
    if (emailValidation) {
      setEmailError(emailValidation);
      return;
    }
    
    // Only block on hard password requirements (length), not on strength
    if (passwordValidation.error) {
      setPasswordError(passwordValidation.error);
      return;
    }
    
    console.log(`Attempting to ${isLogin ? 'login' : 'signup'} with email: ${email}`);

    try {
      if (isLogin) {
        console.log('Calling login function...');
        await login(email, password);
        console.log('Login successful');
      } else {
        console.log('Calling signup function...');
        await signup(email, password, name);
        console.log('Signup successful');
      }
      
      // Check if token was set in localStorage
      const token = localStorage.getItem('authToken');
      console.log('Auth token after login/signup:', token ? 'Token exists' : 'No token');
      
      onClose();
      resetForm();
    } catch (err) {
      console.error('Authentication error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      
      // Check if this is a "no account found" error and provide better guidance
      if (isLogin && errorMessage.includes('No account found')) {
        setError('No account found with this email. Please sign up to create a new account.');
        // Automatically switch to signup mode for better UX
        setIsLogin(false);
      } else {
        setError(errorMessage);
      }
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setError('');
    setEmailError('');
    setPasswordError('');
    setPasswordStrength('weak');
    setShowPassword(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setEmailError('');
    setPasswordError('');
  };

  // Password strength indicator component
  const PasswordStrengthIndicator = () => {
    if (!password) return null;
    
    const getStrengthColor = () => {
      switch (passwordStrength) {
        case 'weak': return 'text-red-500';
        case 'moderate': return 'text-yellow-500';
        case 'strong': return 'text-green-500';
        default: return 'text-gray-500';
      }
    };
    
    const getStrengthText = () => {
      switch (passwordStrength) {
        case 'weak': return 'Weak';
        case 'moderate': return 'Moderate';
        case 'strong': return 'Strong';
        default: return '';
      }
    };
    
    const getStrengthIcon = () => {
      switch (passwordStrength) {
        case 'weak': return <XCircle className="w-4 h-4" />;
        case 'moderate': return <AlertCircle className="w-4 h-4" />;
        case 'strong': return <CheckCircle className="w-4 h-4" />;
        default: return null;
      }
    };
    
    return (
      <div className={`flex items-center space-x-2 text-sm ${getStrengthColor()}`}>
        {getStrengthIcon()}
        <span>Password Strength: {getStrengthText()}</span>
      </div>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isLogin ? 'Sign In' : 'Create Account'}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <Input
            label="Full Name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Enter your full name"
            maxLength={100}
          />
        )}
        
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="Enter your email"
          maxLength={EMAIL_MAX_LENGTH}
          error={emailError}
          
        />
        
        <div className="space-y-2">
          {/* Custom Password Input with Eye Toggle */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                maxLength={PASSWORD_MAX_LENGTH}
                className={`
                  w-full px-3 py-2 pr-12 border rounded-lg shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-colors duration-200
                  ${passwordError 
                    ? 'border-red-300 dark:border-red-600' 
                    : 'border-gray-300 dark:border-gray-600'
                  }
                  bg-white dark:bg-gray-700
                  text-gray-900 dark:text-white
                  placeholder-gray-500 dark:placeholder-gray-400
                `}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {passwordError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Minimum {PASSWORD_MIN_LENGTH} characters. Must contain at least one capital letter, one number, and one special character.
            </p>
          </div>
          <PasswordStrengthIndicator />
        </div>

        {error && (
          <div className={`p-3 text-sm rounded-lg ${
            error.includes('No account found') 
              ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400' 
              : 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
          }`}>
            {error}
            {error.includes('No account found') && (
              <div className="mt-2 text-xs">
                💡 Tip: You can also click "Sign up" below to create a new account.
              </div>
            )}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          loading={isLoading}
          disabled={!!emailError || !email || !password || (!isLogin && !name)}
        >
          {isLogin ? 'Sign In' : 'Create Account'}
        </Button>

        <div className="text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'
            }
          </button>
          {error && error.includes('No account found') && (
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              New to PDF Research Companion? Create your account to get started!
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};