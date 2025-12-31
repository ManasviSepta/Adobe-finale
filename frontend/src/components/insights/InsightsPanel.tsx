import React, { useState, useEffect, useRef } from 'react';
import { Brain, Zap, ArrowRight, FileText, Loader2, AlertCircle, Lightbulb, Volume2, RotateCcw, ToggleLeft, ToggleRight, Pause, Clock, Play, Download } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../contexts/AppContext';
import { useAdobeAPI } from '../../hooks/useAdobeAPI';
import { Insight } from '../../types';
import { apiService } from '../../services/api';
import { useToast } from '../../contexts/ToastContext';

export const InsightsPanel: React.FC = () => {
  const { state, dispatch } = useApp();
  const { status: adobeAPIStatus} = useAdobeAPI();
  const [jobToBeDone, setJobToBeDone] = useState('');
  const [clickedInsightId, setClickedInsightId] = useState<string | null>(null);
  const [modelStatus] = useState<'unknown' | 'available' | 'unavailable'>('unknown');
  const [flippedCards, setFlippedCards] = useState<Set<string>>(new Set());
  const [isGeneratingInsight, setIsGeneratingInsight] = useState<string | null>(null);
  const [isGeneratingJobInsight, setIsGeneratingJobInsight] = useState(false);
  const [jobInsightData, setJobInsightData] = useState<any>(null);

  
  // Track audio elements for each card to enable play/pause functionality
  const cardAudioRefs = useRef<{ [key: string]: HTMLAudioElement }>({});
  const [isProcessingSelectedText, setIsProcessingSelectedText] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const { showToast } = useToast();

  // State for tracking which card is showing podcast view
  const [podcastViewCardId, setPodcastViewCardId] = useState<string | null>(null);
  
  // State for tracking which podcast is being generated
  const [isGeneratingPodcast, setIsGeneratingPodcast] = useState<string | null>(null);

  // State for tracking job card flip (like other cards)
  const [isJobCardFlipped, setIsJobCardFlipped] = useState(false);
  
  // State for tracking job card podcast view
  const [isJobCardPodcastView, setIsJobCardPodcastView] = useState(false);


  // Function to truncate snippet text for front side display
  const truncateSnippet = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Function to toggle job card flip
  const toggleJobCardFlip = () => {
    setIsJobCardFlipped(!isJobCardFlipped);
  };

  // Function to toggle regular card flip
  const toggleCardFlip = (insightId: string) => {
    const newFlippedCards = new Set(flippedCards);
    if (newFlippedCards.has(insightId)) {
      newFlippedCards.delete(insightId);
    } else {
      newFlippedCards.add(insightId);
    }
    setFlippedCards(newFlippedCards);
  };

  // Function to generate job insights on-demand
  const generateJobInsightsOnDemand = async () => {
    if (jobToBeDone.trim()) {
      try {
        console.log('💡 Generating job insights on-demand for:', jobToBeDone);
        
        // Flip the card to show loading state
        toggleJobCardFlip();
        
        const response = await apiService.generateBulbInsights(jobToBeDone, '', undefined, undefined) as any;
        
        if (response.backsideInsights) {
          // Store the generated insights
          setJobInsightData(response.backsideInsights);
          
          console.log('✅ Job insights generated on-demand');
        } else {
          throw new Error('No job insights received from API');
        }
        
      } catch (error) {
        console.error('❌ Error generating job insights:', error);
        showToast({
          message: 'Failed to generate job insights. Please try again.',
          type: 'error'
        });
      }
    }
  };

  const generateInsightBulb = async (insight: Insight) => {
    // Check if insights are already generated
    if (insight.backsideInsights) {
      // Insights already exist, just flip the card
      toggleCardFlip(insight.id);
      return;
    }
    
    // Immediately flip the card to show loading state
    toggleCardFlip(insight.id);
    
    // Generate insights on-demand
    setIsGeneratingInsight(insight.id);
    
    try {
      console.log('💡 Generating bulb insights for:', insight.heading);
      
              const response = await apiService.generateBulbInsights(insight.heading, insight.snippet, insight.fileName, insight.pageNumber) as any;
      
      if (response.backsideInsights) {
        // Update the insight with generated backside insights
        const updatedInsights = state.insights.map(ins => 
          ins.id === insight.id 
            ? { ...ins, backsideInsights: response.backsideInsights }
            : ins
        );
        
        dispatch({ type: 'SET_INSIGHTS', payload: updatedInsights });
        
        console.log('✅ Bulb insights generated successfully');
      } else {
        throw new Error('No backside insights received from API');
      }
      
    } catch (error) {
      console.error('❌ Error generating bulb insights:', error);
    showToast({
        message: 'Failed to generate insights. Please try again.',
        type: 'error'
    });
    } finally {
      setIsGeneratingInsight(null);
    }
  };

  // Cleanup audio when insights change or component unmounts
  useEffect(() => {
    return () => {
      // Stop all audio when component unmounts
      Object.values(cardAudioRefs.current).forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
      setPlayingAudioId(null);
    };
  }, []);

  // Stop all audio when insights change
  useEffect(() => {
    Object.values(cardAudioRefs.current).forEach(audio => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    // Clear the refs
    cardAudioRefs.current = {};
    setPlayingAudioId(null);
  }, [state.insights]);

  // Function to stop all other audio when one starts playing
  const stopOtherAudio = (currentCardId: string) => {
    Object.entries(cardAudioRefs.current).forEach(([cardId, audio]) => {
      if (cardId !== currentCardId && audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    });
    // Update playing state to reflect that other audio is stopped
    setPlayingAudioId(null);
  };

  const generateInsights = async () => {
    // Check if we have PDFs based on the toggle state
    const hasUploadedPdfs = state.pdfs.length > 0;
    
    if (!jobToBeDone.trim()) {
      console.log('Validation failed: No job description provided');
      showToast({
        message: 'Please enter a job description to generate insights.',
        type: 'error'
      });
      return;
    }
    
    if (!state.insightsFromLibrary && !hasUploadedPdfs) {
      console.log('Validation failed: No uploaded PDFs available');
      showToast({
        message: 'Please upload PDFs to generate insights.',
        type: 'error'
      });
      return;
    }

    dispatch({ type: 'SET_PROCESSING', payload: true });

    // Check if backend is available before proceeding
    try {
      await apiService.healthCheck();
    } catch (error) {
      console.error('Backend health check failed:', error);
      showToast({
        message: 'Backend server is not available. Please make sure it\'s running and try again.',
        type: 'error'
      });
      dispatch({ type: 'SET_PROCESSING', payload: false });
      return;
    }

    try {
      // Get PDF IDs based on toggle state
      let pdfIds: string[];
      let pdfSource: string;
      
                      if (state.insightsFromLibrary) {
                  // Use ALL library PDFs automatically (since all PDFs are now stored in library)
                  const allLibraryPdfs = await apiService.getLibraryPdfs();
                  pdfIds = allLibraryPdfs.pdfs.map((pdf: any) => pdf.id.toString());
                  pdfSource = 'library';
                  console.log('Generating insights from ALL library PDFs:', pdfIds);
                } else {
        // Use uploaded PDFs only
        pdfIds = state.pdfs.map(pdf => pdf.id);
        pdfSource = 'uploads';
        console.log('Generating insights from uploaded PDFs:', pdfIds);
      }
      
      console.log(`Generating enhanced insights for ${pdfIds.length} PDFs from ${pdfSource}`);
      console.log('Job to be done:', jobToBeDone);
      
      // Use the enhanced insights endpoint that automatically generates bulb and podcast
      const response = await apiService.generateEnhancedInsights(pdfIds, jobToBeDone);
      console.log('Enhanced backend response:', response);
      
      // Transform backend response to frontend format
      const insights: Insight[] = response.insights?.sections?.map((section: any, index: number) => ({
        id: `insight-${section.id || index}`,
        fileName: section.pdfName || 'Document',
        heading: section.sectionTitle || `Section ${index + 1}`,
        snippet: section.content || 'No content available',
        pageNumber: section.pageNumber || 1,
        importance: section.importanceRank <= 2 ? 'high' : section.importanceRank <= 3 ? 'medium' : 'low',
        relevanceScore: 0.9 - (section.importanceRank * 0.1), // Convert rank to score
        backsideInsights: section.backsideInsights || null // Include backside insights
      })) || [];

      // Job insights will only be generated when user clicks the bulb button
      // No automatic generation here
      console.log('💡 Job insights will be generated on-demand when bulb button is clicked');

      dispatch({ type: 'SET_INSIGHTS', payload: insights });
      console.log(`✅ Generated ${insights.length} enhanced insights successfully from ${pdfSource} PDFs`);
      

      
      // Check if podcasts were generated
      if (response.podcasts && response.podcasts.length > 0) {
        console.log('🎙️ Podcasts generated successfully:', response.podcasts);

        
        // Store podcasts data in state for playback
        dispatch({ type: 'SET_PODCASTS', payload: response.podcasts });
      } else {
        console.log('⚠️ No podcasts data in response:', response);
        console.log('Response keys:', Object.keys(response));
      }
      

    } catch (error) {
      console.error('Error generating enhanced insights:', error);
      
      // Show more specific error message using custom Alert
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check for network/CORS errors first
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError') || errorMessage.includes('CORS')) {
        showToast({
          message: 'Backend connection failed. Please make sure the backend server is running and try again.',
          type: 'error'
        });
      } else if (errorMessage.includes('400')) {
        showToast({
          message: 'Some PDFs are still being processing. Please wait a moment and try again.',
          type: 'warning'
        });
      } else if (errorMessage.includes('403')) {
        showToast({
          message: 'Access denied. Please make sure you own the selected PDFs.',
          type: 'error'
        });
      } else if (errorMessage.includes('500')) {
        showToast({
          message: 'ML model processing failed. Please check the console for details and try again.',
          type: 'error'
        });
      } else {
        showToast({
          message: `Failed to generate enhanced insights: ${errorMessage}. Please try again.`,
          type: 'error'
        });
      }
    } finally {
      dispatch({ type: 'SET_PROCESSING', payload: false });
      // Reset text processing state
      setIsProcessingSelectedText(false);
    }
  };

  // Effect to handle text selection from PDF
  useEffect(() => {
    console.log('InsightsPanel: selectedTextFromPDF changed:', state.selectedTextFromPDF);
    
    if (state.selectedTextFromPDF && state.selectedTextFromPDF.trim()) {
      console.log('Text selected from PDF:', state.selectedTextFromPDF);
      
      // Set processing state immediately
      setIsProcessingSelectedText(true);
      console.log('✅ Set processing state to true');
      
      // Update the job description with selected text
      setJobToBeDone(state.selectedTextFromPDF);
      
      // Show a brief visual feedback
      const textarea = document.querySelector('textarea[placeholder*="e.g.,"]') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.borderColor = '#10B981'; // Green border
        textarea.style.transition = 'border-color 0.3s ease';
        setTimeout(() => {
          textarea.style.borderColor = '';
        }, 2000);
      }
      
      // Automatically trigger insights generation if PDFs are available
      if (state.pdfs.length > 0) {
        console.log('Auto-triggering insights generation with selected text');
        console.log('PDFs available:', state.pdfs.length);
        
        // Start processing immediately
        const processSelectedText = async () => {
          try {
            console.log('🚀 Starting backend processing...');
            
            // Check if backend is available
            await apiService.healthCheck();
            console.log('✅ Backend health check passed');
            
            // Get PDF IDs for backend call
            const pdfIds = state.pdfs.map(pdf => pdf.id);
            console.log('📄 Processing PDFs:', pdfIds);
            
                         // Call backend API to generate insights
             const response = await apiService.generateInsights(pdfIds, state.selectedTextFromPDF || '');
            console.log('✅ Backend response received:', response);
            
            // Transform backend response to frontend format
            const insights: Insight[] = response.insights?.sections?.map((section: any, index: number) => ({
              id: `insight-${section.id || index}`,
              fileName: section.pdfName || 'Document',
              heading: section.sectionTitle || `Section ${index + 1}`,
              snippet: section.content || 'No content available',
              pageNumber: section.pageNumber || 1,
              importance: section.importanceRank <= 2 ? 'high' : section.importanceRank <= 3 ? 'medium' : 'low',
              relevanceScore: 0.9 - (section.importanceRank * 0.1)
            })) || [];

            dispatch({ type: 'SET_INSIGHTS', payload: insights });
            console.log(`✅ Generated ${insights.length} insights successfully`);
            
            showToast({
              message: `Successfully generated ${insights.length} insights from selected text!`,
              type: 'success'
            });
            
          } catch (error) {
            console.error('❌ Error processing selected text:', error);
            showToast({
              message: 'Failed to generate insights from selected text. Please try again.',
              type: 'error'
            });
          } finally {
            console.log('🏁 Resetting processing state');
            setIsProcessingSelectedText(false);
          }
        };
        
        // Start processing immediately
        processSelectedText();
        
      } else {
        console.log('No PDFs available for insights generation');
        setIsProcessingSelectedText(false);
        showToast({
          message: 'No PDFs available. Please upload PDFs first, then try selecting text again.',
          type: 'warning'
        });
      }
    } else {
      // Reset processing state when no text is selected
      setIsProcessingSelectedText(false);
    }
  }, [state.selectedTextFromPDF, state.pdfs.length]);

  const navigateToInsight = async (insight: Insight) => {
    // Prevent multiple navigation attempts using global state
    if (state.isNavigating) {
      console.log('Navigation already in progress globally');
      return;
    }

    // Prevent multiple navigation attempts for the same insight
    if (clickedInsightId === insight.id) {
      console.log('Navigation already in progress for this insight');
      return;
    }

    // Set global navigation state
    dispatch({ type: 'SET_NAVIGATING', payload: true });
    
    // Set clicked state for visual feedback
    setClickedInsightId(insight.id);
    
    console.log('Available PDFs:', state.pdfs.map(pdf => ({ id: pdf.id, name: pdf.name })));
    console.log('Looking for PDF with name:', insight.fileName);
    
    // Find the PDF containing this insight
    let targetPdf = state.pdfs.find(pdf => pdf.name === insight.fileName);
    
    // If exact match not found, try partial match
    if (!targetPdf) {
      targetPdf = state.pdfs.find(pdf => 
        insight.fileName.includes(pdf.name) || pdf.name.includes(insight.fileName)
      );
    }
    
    if (targetPdf) {
      console.log(`🎯 Navigating to page ${insight.pageNumber} in ${insight.fileName}`);
      console.log('🔍 Insight details:', {
        insightId: insight.id,
        fileName: insight.fileName,
        pageNumber: insight.pageNumber,
        pageNumberType: typeof insight.pageNumber,
        targetPdfId: targetPdf.id,
        targetPdfName: targetPdf.name
      });
      
      try {
        // Check if we're already on the correct PDF and page
        if (state.selectedPdfId === targetPdf.id && state.currentPage === insight.pageNumber) {
          console.log('Already on the correct PDF and page');
          setClickedInsightId(null);
          dispatch({ type: 'SET_NAVIGATING', payload: false });
          return;
        }

        // Use the new INITIALIZE_VIEWER action to trigger viewer initialization
        console.log('Dispatching INITIALIZE_VIEWER action...');
        const actionPayload = { 
          type: 'INITIALIZE_VIEWER' as const, 
          payload: { 
            pdfId: targetPdf.id, 
            pageNumber: insight.pageNumber 
          } 
        };
        console.log('🔍 Action payload:', actionPayload);
        
        // Prevent duplicate dispatches by checking if we're already on the correct PDF
        if (state.selectedPdfId !== targetPdf.id || state.currentPage !== insight.pageNumber) {
          dispatch(actionPayload);
          console.log(`✅ Successfully initiated viewer initialization for page ${insight.pageNumber}`);
        } else {
          console.log('Already on correct PDF and page, skipping dispatch');
        }
        
        // Clear clicked state after a delay
        setTimeout(() => setClickedInsightId(null), 3000);
        
        // Clear global navigation state after navigation completes
        setTimeout(() => dispatch({ type: 'SET_NAVIGATING', payload: false }), 2000);
        
      } catch (error) {
        console.error('Error during navigation setup:', error);
        showToast({
          message: 'Failed to set up navigation. Please try again.',
          type: 'error'
        });
        setClickedInsightId(null);
        dispatch({ type: 'SET_NAVIGATING', payload: false });
      }
    } else {
      console.warn(`❌ PDF not found for insight: ${insight.fileName}`);
      showToast({
        message: `PDF "${insight.fileName}" not found. Please make sure it's uploaded.`,
        type: 'error'
      });
      setClickedInsightId(null);
      dispatch({ type: 'SET_NAVIGATING', payload: false });
    }
  };

  const renderCardFront = (insight: Insight) => (
    <div className="space-y-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2 min-w-0 flex-1">
          <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
            {insight.fileName}
          </span>
        </div>
        <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              generateInsightBulb(insight);
            }}
            className="w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center transition-colors"
            title="Show AI insights"
          >
            <Lightbulb className="w-3 h-3" />
          </button>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              console.log('🎙️ Podcast button clicked for card (front):', insight.id);
              
              // Find the podcast for this card
              const cardPodcast = state.podcasts.find(p => p.cardId === insight.id);
              console.log('🎙️ Found podcast (front):', cardPodcast);
              
              if (cardPodcast) {
                // Podcast exists, flip to podcast view
                setPodcastViewCardId(insight.id);
                  } else {
                console.log('🎙️ No podcast found for card (front):', insight.id);
                console.log('🎙️ Generating podcast on-demand...');
                
                // Flip to podcast view with loading state
                setPodcastViewCardId(insight.id);
                setIsGeneratingPodcast(insight.id);
                
                // Generate podcast on-demand
                try {
                                   const response = await apiService.generatePodcast(
                   insight.heading,
                   insight.snippet,
                   insight.id,
                   insight.backsideInsights,
                   insight.fileName,
                   insight.pageNumber
                 ) as any;
                  
                  if (response.podcast) {
                    // Add the new podcast to state
                    const newPodcasts = [...state.podcasts, response.podcast];
                    dispatch({ type: 'SET_PODCASTS', payload: newPodcasts });
                    
                    // Update the insight with backside insights if generated
                    if (response.backsideInsights && !insight.backsideInsights) {
                      const updatedInsights = state.insights.map(ins => 
                        ins.id === insight.id 
                          ? { ...ins, backsideInsights: response.backsideInsights }
                          : ins
                      );
                      dispatch({ type: 'SET_INSIGHTS', payload: updatedInsights });
                    }
                    
                    console.log('✅ Podcast generated on-demand:', response.podcast);
                    
                  } else {
                    throw new Error('No podcast data received from API');
                  }
                  
                } catch (error) {
                  console.error('❌ Error generating podcast on-demand:', error);
                    showToast({
                    message: 'Failed to generate podcast. Please try again.',
                      type: 'error'
                    });
                } finally {
                  setIsGeneratingPodcast(null);
                }
              }
            }}
            disabled={false}
            className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors"
            title="View podcast"
          >
              <Volume2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      
      <h4 className="font-medium text-gray-900 dark:text-white mb-2">
        {insight.heading}
      </h4>
      
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
        {truncateSnippet(insight.snippet)}
      </p>
      
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Page {insight.pageNumber}
        </span>
        
        <div className="flex items-center text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
          {clickedInsightId === insight.id ? (
            <>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1"></div>
              <span className="text-xs">Navigating...</span>
            </>
          ) : adobeAPIStatus === 'ready' && !state.isNavigating ? (
            <>
              <span className="text-xs mr-1">Click to navigate</span>
              <ArrowRight className="w-3 h-3" />
            </>
          ) : state.isNavigating ? (
            <>
              <span className="text-xs mr-1">Navigation in progress...</span>
              <Loader2 className="w-3 h-3 animate-spin" />
            </>
          ) : (
            <>
              <span className="text-xs mr-1">PDF viewer not ready</span>
              <AlertCircle className="w-3 h-3" />
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderCardBack = (insight: Insight) => {
    // Check if insights are being generated
    const isGenerating = isGeneratingInsight === insight.id;
    
    // Use the pre-generated insights from the insight object
    const backsideData = insight.backsideInsights;
    const hasInsights = backsideData && (
      backsideData.keyInsights?.length > 0 ||
      backsideData.didYouKnow?.length > 0 ||
      backsideData.contradictions?.length > 0 ||
      backsideData.inspirations?.length > 0
    );

    return (
      <div className="space-y-4">
        {/* Header with return button and podcast button */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
              {insight.fileName}
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
            {/* Return button (replaces bulb button) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCardFlip(insight.id);
              }}
              className="w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center transition-colors"
              title="Return to front"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            
            {/* Podcast button */}
            <button
              onClick={async (e) => {
                e.stopPropagation();
                
                // Check if podcast already exists
                const existingPodcast = state.podcasts.find(p => p.cardId === insight.id);
                
                if (existingPodcast) {
                  // Podcast exists, show podcast view
                  setPodcastViewCardId(insight.id);
                } else {
                  // Generate podcast on-demand with loading state
                  setIsGeneratingPodcast(insight.id);
                  setPodcastViewCardId(insight.id); // Show podcast view immediately
                  
                  try {
                    const response = await apiService.generatePodcast(
                      insight.heading,
                      insight.content,
                      insight.id,
                      insight.backsideInsights,
                      insight.fileName,
                      insight.pageNumber
                    ) as any;
                    
                    if (response.podcast) {
                      // Add the new podcast to state
                      const newPodcasts = [...state.podcasts, response.podcast];
                      dispatch({ type: 'SET_PODCASTS', payload: newPodcasts });
                      
                      // Update insight with backside insights if generated
                      if (response.backsideInsights && !insight.backsideInsights) {
                        const updatedInsights = state.insights.map(i => 
                          i.id === insight.id 
                            ? { ...i, backsideInsights: response.backsideInsights }
                            : i
                        );
                        dispatch({ type: 'SET_INSIGHTS', payload: updatedInsights });
                      }
                      
                      console.log('✅ Podcast generated on-demand:', response.podcast);
                    } else {
                      throw new Error('No podcast data received from API');
                    }
                    
                  } catch (error) {
                    console.error('❌ Error generating podcast:', error);
                    showToast({
                      message: 'Failed to generate podcast. Please try again.',
                      type: 'error'
                    });
                    // Hide podcast view on error
                    setPodcastViewCardId(null);
                  } finally {
                    setIsGeneratingPodcast(null);
                  }
                }
              }}
              disabled={isGeneratingPodcast === insight.id}
              className={`w-6 h-6 rounded-full transition-colors flex items-center justify-center ${
                isGeneratingPodcast === insight.id
                  ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400'
              }`}
              title={isGeneratingPodcast === insight.id ? "Generating podcast..." : "View podcast"}
            >
              {isGeneratingPodcast === insight.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isGenerating ? (
          // Show headings with loading states
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Key Insights</h4>
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Did You Know? Facts</h4>
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Counterpoints/Contradictions</h4>
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Trends</h4>
              <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating insights...</span>
              </div>
            </div>
          </div>
        ) : hasInsights ? (
          // Show generated insights
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Key Insights</h4>
              <ul className="space-y-1">
                {backsideData.keyInsights?.map((insight, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Did You Know? Facts</h4>
              <ul className="space-y-1">
                {backsideData.didYouKnow?.map((fact, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                    <span className="text-green-500 mr-2">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Counterpoints/Contradictions</h4>
              <ul className="space-y-1">
                {backsideData.contradictions?.map((point, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                    <span className="text-orange-500 mr-2">•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">Trends</h4>
              <ul className="space-y-1">
                {backsideData.inspirations?.map((trend, index) => (
                  <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                    <span className="text-purple-500 mr-2">•</span>
                    {trend}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          // Fallback if no insights
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Lightbulb className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No insights available for this card.</p>
          </div>
        )}
      </div>
    );
  };

  const renderJobCardBack = () => {
    // Check if job insights are available
    const hasJobInsights = jobInsightData && (
      jobInsightData.keyInsights?.length > 0 ||
      jobInsightData.didYouKnow?.length > 0 ||
      jobInsightData.contradictions?.length > 0 ||
      jobInsightData.inspirations?.length > 0
    );

    return (
      <div className="space-y-3">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
              Job Description Insights
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
            <button
              onClick={toggleJobCardFlip}
              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
              title="Flip back to input"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <button
              onClick={async () => {
                if (jobToBeDone.trim() && state.pdfs.length > 0) {
                  console.log('🎙️ Job card podcast button clicked');
                  
                  // Find the job card podcast (it should have a special ID)
                  const jobPodcast = state.podcasts.find(p => p.cardId === 'job-card');
                  console.log('🎙️ Found job podcast:', jobPodcast);
                  
                  if (jobPodcast) {
                    // Podcast exists, show podcast view
                    setIsJobCardPodcastView(true);
                  } else {
                    // Generate podcast on-demand
                    console.log('🎙️ No job podcast found, generating on-demand...');
                    
                    // Show podcast view with loading state
                    setIsJobCardPodcastView(true);
                    setIsGeneratingPodcast('job-card');
                    
                    try {
                      const response = await apiService.generatePodcast(
                        jobToBeDone, 
                        '', 
                        'job-card',
                        jobInsightData,
                        undefined,
                        undefined
                      ) as any;
                      
                      if (response.podcast) {
                        // Add the new podcast to state
                        const newPodcasts = [...state.podcasts, response.podcast];
                        dispatch({ type: 'SET_PODCASTS', payload: newPodcasts });
                        
                        // Update job insights if generated
                        if (response.backsideInsights && !jobInsightData) {
                          setJobInsightData(response.backsideInsights);
                        }
                        
                        console.log('✅ Job podcast generated on-demand:', response.podcast);
                        
                      } else {
                        throw new Error('No job podcast data received from API');
                      }
                      
                    } catch (error) {
                      console.error('❌ Error generating job podcast:', error);
                      showToast({
                        message: 'Failed to generate job podcast. Please try again.',
                        type: 'error'
                      });
                    } finally {
                      setIsGeneratingPodcast(null);
                    }
                  }
                }
              }}
              disabled={!jobToBeDone.trim() || state.pdfs.length === 0}
              className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors"
              title="View podcast"
            >
              <Volume2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Show insights if available, otherwise show message */}
        {hasJobInsights ? (
          <div className="space-y-4">
            {/* Key Insights */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Key Insights
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {jobInsightData?.keyInsights?.map((insight: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{insight}</span>
                  </li>
                )) || []}
              </ul>
            </div>
            
            {/* Did You Know? Facts */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Did You Know? Facts
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {jobInsightData?.didYouKnow?.map((fact: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{fact}</span>
                  </li>
                )) || []}
              </ul>
            </div>
            
            {/* Counterpoints/Contradicts */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Counterpoints/Contradicts
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {jobInsightData?.contradictions?.map((contradiction: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{contradiction}</span>
                  </li>
                )) || []}
              </ul>
            </div>
            
            {/* Trends/Inspirations */}
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white mb-2">
                Trends
              </h5>
              <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                {jobInsightData?.inspirations?.map((trend: string, index: number) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{trend}</span>
                  </li>
                )) || []}
              </ul>
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Job insights not yet generated
            </p>
            <p className="text-xs mt-1">
              Click "Generate Insights" to create content for the job description
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderJobCardPodcastView = () => {
    // Check if podcast is being generated
    const isGenerating = isGeneratingPodcast === 'job-card';
    
    // Find the job card podcast
    const cardPodcast = state.podcasts.find(p => p.cardId === 'job-card');
    const hasPodcast = cardPodcast && !isGenerating;
    
    // Get audio duration if available
    const audioDuration = cardPodcast?.duration || '2-5 minutes';

    return (
      <div className="space-y-4">
        {/* Header with return button and bulb button */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
              Job Description Podcast
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
            {/* Return button (takes us back to main job card) */}
            <button
              onClick={() => {
                setIsJobCardPodcastView(false);
              }}
              className="w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center transition-colors"
              title="Return to main job card"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            
            {/* Bulb button (in podcast view) */}
            <button
              onClick={() => {
                setIsJobCardPodcastView(false);
                // Always go to insights view (either existing or generate new)
                if (!jobInsightData) {
                  // Generate insights on-demand
                  generateJobInsightsOnDemand();
                } else {
                  // Show existing insights
                  toggleJobCardFlip();
                }
              }}
              className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center transition-colors"
              title="View insights"
            >
              <Lightbulb className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isGenerating ? (
          // Show loading state for podcast generation
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Generating Podcast...
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Creating audio content for job description
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing audio...</span>
              </div>
            </div>
          </div>
        ) : hasPodcast ? (
          // Show podcast controls and features
          <div className="space-y-6">
            {/* Podcast Header */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Podcast Ready!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Job Description
              </p>
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Duration: {audioDuration}
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center justify-center space-x-4">
              {/* Play/Pause Button */}
              <button
                onClick={() => {
                  const existingAudio = cardAudioRefs.current['job-card'];
                  if (existingAudio) {
                    if (existingAudio.paused) {
                      existingAudio.play();
                      setPlayingAudioId('job-card');
                    } else {
                      existingAudio.pause();
                      setPlayingAudioId(null);
                    }
                  } else {
                    // Create new audio element if none exists
                    if (cardPodcast) {
                      const audioUrl = cardPodcast.audioPath.startsWith('http') 
                        ? cardPodcast.audioPath 
                        : `${window.location.origin}${cardPodcast.audioPath}`;
                      
                      const audio = new Audio(audioUrl);
                      
                      // Add event listeners
                      audio.addEventListener('play', () => setPlayingAudioId('job-card'));
                      audio.addEventListener('pause', () => setPlayingAudioId(null));
                      audio.addEventListener('ended', () => setPlayingAudioId(null));
                      
                      // Store reference and play
                      cardAudioRefs.current['job-card'] = audio;
                      audio.play().catch(err => {
                        console.error('Failed to play audio:', err);
                        showToast({
                          message: 'Failed to play podcast audio',
                          type: 'error'
                        });
                      });
                    }
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Play/Pause"
              >
                {playingAudioId === 'job-card' ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              
              {/* Restart Button */}
              <button
                onClick={() => {
                  const existingAudio = cardAudioRefs.current['job-card'];
                  if (existingAudio) {
                    existingAudio.currentTime = 0;
                    existingAudio.play();
                    setPlayingAudioId('job-card');
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              
              {/* Download Button */}
              <button
                onClick={() => {
                  if (cardPodcast) {
                    const audioUrl = cardPodcast.audioPath.startsWith('http') 
                      ? cardPodcast.audioPath 
                      : `${window.location.origin}${cardPodcast.audioPath}`;
                    
                    // Create a temporary link to download the audio
                    const link = document.createElement('a');
                    link.href = audioUrl;
                    link.download = `job_podcast_${jobToBeDone.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Download podcast"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          // Fallback if no podcast
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Volume2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No podcast available for job description.</p>
          </div>
        )}
      </div>
    );
  };

  const renderPodcastView = (insight: Insight) => {
    // Check if podcast is being generated
    const isGenerating = isGeneratingPodcast === insight.id;
    
    // Find the podcast for this card
    const cardPodcast = state.podcasts.find(p => p.cardId === insight.id);
    const hasPodcast = cardPodcast && !isGenerating;
    
    // Get audio duration if available
    const audioDuration = cardPodcast?.duration || '2-5 minutes';

    return (
      <div className="space-y-4">
        {/* Header with return button and bulb button */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate min-w-0">
              {insight.fileName}
            </span>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
            {/* Return button (takes us back to main card) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPodcastViewCardId(null);
              }}
              className="w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center transition-colors"
              title="Return to main card"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            
            {/* Bulb button (in podcast view) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPodcastViewCardId(null);
                // Generate insights if not already available
                if (!insight.backsideInsights) {
                  generateInsightBulb(insight);
                } else {
                  // Just flip to insights view
                  toggleCardFlip(insight.id);
                }
              }}
              className="w-6 h-6 rounded-full bg-orange-100 hover:bg-orange-200 dark:bg-orange-900/20 dark:hover:bg-orange-900/40 text-orange-600 dark:text-orange-400 flex items-center justify-center transition-colors"
              title="View insights"
            >
              <Lightbulb className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        {isGenerating ? (
          // Show loading state for podcast generation
          <div className="space-y-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Generating Podcast...
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Creating audio content for "{insight.heading}"
              </p>
              <div className="mt-4 flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing audio...</span>
              </div>
            </div>
          </div>
        ) : hasPodcast ? (
          // Show podcast controls and features
          <div className="space-y-6">
            {/* Podcast Header */}
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Volume2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Podcast Ready!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {insight.heading}
              </p>
              <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Duration: {audioDuration}
              </div>
            </div>

            {/* Audio Controls */}
            <div className="flex items-center justify-center space-x-4">
              {/* Play/Pause Button */}
              <button
                onClick={() => {
                  const existingAudio = cardAudioRefs.current[insight.id];
                  if (existingAudio) {
                    if (existingAudio.paused) {
                      existingAudio.play();
                      setPlayingAudioId(insight.id);
                    } else {
                      existingAudio.pause();
                      setPlayingAudioId(null);
                    }
                  } else {
                    // Create new audio element if none exists
                    if (cardPodcast) {
                      const audioUrl = cardPodcast.audioPath.startsWith('http') 
                        ? cardPodcast.audioPath 
                        : `${window.location.origin}${cardPodcast.audioPath}`;
                      
                      const audio = new Audio(audioUrl);
                      
                      // Add event listeners
                      audio.addEventListener('play', () => setPlayingAudioId(insight.id));
                      audio.addEventListener('pause', () => setPlayingAudioId(null));
                      audio.addEventListener('ended', () => setPlayingAudioId(null));
                      
                      // Store reference and play
                      cardAudioRefs.current[insight.id] = audio;
                      audio.play().catch(err => {
                        console.error('Failed to play audio:', err);
                        showToast({
                          message: 'Failed to play podcast audio',
                          type: 'error'
                        });
                      });
                    }
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Play/Pause"
              >
                {playingAudioId === insight.id ? (
                  <Pause className="w-5 h-5" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
              </button>
              
              {/* Restart Button */}
              <button
                onClick={() => {
                  const existingAudio = cardAudioRefs.current[insight.id];
                  if (existingAudio) {
                    existingAudio.currentTime = 0;
                    existingAudio.play();
                    setPlayingAudioId(insight.id);
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Restart"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              
              {/* Download Button */}
              <button
                onClick={() => {
                  if (cardPodcast) {
                    const audioUrl = cardPodcast.audioPath.startsWith('http') 
                      ? cardPodcast.audioPath 
                      : `${window.location.origin}${cardPodcast.audioPath}`;
                    
                    // Create a temporary link to download the audio
                    const link = document.createElement('a');
                    link.href = audioUrl;
                    link.download = `podcast_${insight.heading.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp3`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }
                }}
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 flex items-center justify-center transition-colors"
                title="Download podcast"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          // Fallback if no podcast
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Volume2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No podcast available for this card.</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      
      {/* Single Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Insights
              </h2>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {state.insightsFromLibrary ? 'Library PDFs' : 'Uploaded PDFs'}
              </span>
              <button
                onClick={() => dispatch({ type: 'TOGGLE_INSIGHTS_SOURCE', payload: !state.insightsFromLibrary })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  state.insightsFromLibrary 
                    ? 'bg-blue-600 dark:bg-blue-500' 
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
                title={state.insightsFromLibrary ? 'Switch to Uploaded PDFs' : 'Switch to Library PDFs'}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform duration-200 ${
                    state.insightsFromLibrary ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
        {/* Job Description Flip Card */}
        <div className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 mb-4">
          {/* Front Side */}
          {!isJobCardFlipped && !isJobCardPodcastView && (
            <div className="card-front">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Job to be Done
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={async () => {
                      if (jobToBeDone.trim()) {
                        // Check if job insights are already generated
                        if (jobInsightData) {
                          // Insights already exist, just flip the card
                          toggleJobCardFlip();
                        } else {
                          // Generate insights on-demand
                          await generateJobInsightsOnDemand();
                        }
                      }
                    }}
                    disabled={!jobToBeDone.trim() || state.isProcessing}
                    className="w-6 h-6 rounded-full bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Show AI insights for job description"
                    data-job-bulb-btn
                  >
                    <Lightbulb className="w-3 h-3" />
                  </button>
                  <button
                    onClick={async () => {
                      if (jobToBeDone.trim() && state.pdfs.length > 0) {
                        console.log('🎙️ Job card podcast button clicked');
                        
                        // Find the job card podcast (it should have a special ID)
                        const jobPodcast = state.podcasts.find(p => p.cardId === 'job-card');
                        console.log('🎙️ Found job podcast:', jobPodcast);
                        
                        if (jobPodcast) {
                          // Podcast exists, show podcast view
                          setIsJobCardPodcastView(true);
                        } else {
                          // Generate podcast on-demand
                          console.log('🎙️ No job podcast found, generating on-demand...');
                          
                          // Show podcast view with loading state
                          setIsJobCardPodcastView(true);
                          setIsGeneratingPodcast('job-card');
                          
                          try {
                            const response = await apiService.generatePodcast(
                              jobToBeDone, 
                              '', 
                              'job-card',
                              jobInsightData,
                              undefined,
                              undefined
                            ) as any;
                            
                            if (response.podcast) {
                              // Add the new podcast to state
                              const newPodcasts = [...state.podcasts, response.podcast];
                              dispatch({ type: 'SET_PODCASTS', payload: newPodcasts });
                              
                              // Update job insights if generated
                              if (response.backsideInsights && !jobInsightData) {
                                setJobInsightData(response.backsideInsights);
                              }
                              
                              console.log('✅ Job podcast generated on-demand:', response.podcast);
                              
                            } else {
                              throw new Error('No job podcast data received from API');
                            }
                            
                          } catch (error) {
                            console.error('❌ Error generating job podcast:', error);
                            showToast({
                              message: 'Failed to generate job podcast. Please try again.',
                              type: 'error'
                            });
                          } finally {
                            setIsGeneratingPodcast(null);
                          }
                        }
                      }
                    }}
                    disabled={!jobToBeDone.trim() || state.pdfs.length === 0 || state.isProcessing}
                    className="w-6 h-6 rounded-full bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="View podcast for job description"
                  >
                    <Volume2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <textarea
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none"
                rows={5}
                placeholder="e.g., Identify key market trends for Q4 planning, Find cost optimization opportunities..."
                value={jobToBeDone}
                onChange={(e) => setJobToBeDone(e.target.value)}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                💡 Tip: Select text from the PDF viewer to automatically populate this field and generate insights
              </p>
            </div>
          )}
          
          {/* Back Side - Insights view */}
          {isJobCardFlipped && !isJobCardPodcastView && (
            <div className="card-back">
              {renderJobCardBack()}
            </div>
          )}

          {/* Podcast View */}
          {isJobCardPodcastView && (
            <div className="card-podcast">
              {renderJobCardPodcastView()}
            </div>
          )}
          </div>

        {/* Generate Insights Button */}
        <div className="mb-4">
          <Button
            onClick={generateInsights}
            disabled={!jobToBeDone.trim() || 
              (!state.insightsFromLibrary && state.pdfs.length === 0) || 
              state.isProcessing || 
              modelStatus === 'unavailable'}
            loading={state.isProcessing}
            className="w-full"
          >
            <Zap className="w-4 h-4 mr-2" />
            Generate Insights
          </Button>
      </div>

      {/* Insights Results */}
        {state.isProcessing || isProcessingSelectedText ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isProcessingSelectedText ? 'Processing selected text and generating insights...' : 'Analyzing your PDFs with AI...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This may take a few seconds
              </p>
            </div>
          </div>
        ) : state.insights.length > 0 ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Relevant Sections ({state.insights.length})
              </h3>
              {adobeAPIStatus === 'error' && (
                <span className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                  ⚠️ PDF navigation may not work
                </span>
              )}
            </div>
            
            {state.insights.map((insight) => (
              <div
                key={insight.id}
                onClick={() => adobeAPIStatus === 'ready' && !state.isNavigating ? navigateToInsight(insight) : null}
                className={`p-4 rounded-lg transition-all duration-300 border group ${
                  clickedInsightId === insight.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 shadow-md'
                    : adobeAPIStatus === 'ready' && !state.isNavigating
                    ? 'bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600 cursor-pointer'
                    : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed opacity-75'
                }`}
                title={adobeAPIStatus === 'ready' && !state.isNavigating
                  ? `Click to navigate to page ${insight.pageNumber} in ${insight.fileName}` 
                  : state.isNavigating
                  ? 'Navigation in progress...'
                  : 'PDF viewer is not ready. Please wait or refresh the page.'
                }
              >
                {/* Front Side */}
                {!flippedCards.has(insight.id) && podcastViewCardId !== insight.id && (
                  <div className="card-front">
                    {renderCardFront(insight)}
                  </div>
                )}
                
                {/* Back Side - Insights view */}
                {flippedCards.has(insight.id) && podcastViewCardId !== insight.id && (
                  <div className="card-back">
                    {renderCardBack(insight)}
                  </div>
                )}

                {/* Podcast View */}
                {podcastViewCardId === insight.id && (
                  <div className="card-podcast">
                    {renderPodcastView(insight)}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Enter your job requirements to generate insights
            </p>
            {modelStatus === 'unavailable' && (
              <p className="text-xs text-red-500 mt-2">
                ML model is currently unavailable. Please check backend configuration.
              </p>
            )}
            {adobeAPIStatus === 'error' && (
              <p className="text-xs text-red-500 mt-2">
                PDF viewer is not ready. Please refresh the page to reinitialize the viewer.
              </p>
            )}
            {adobeAPIStatus === 'loading' && (
              <p className="text-xs text-blue-500 mt-2">
                PDF viewer is loading. Please wait before clicking on insights.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};