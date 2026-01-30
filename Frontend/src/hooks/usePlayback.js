import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to manage playback state for submission timeline
 * @param {Array} submissions - Array of submission objects
 * @returns {Object} Playback controls and state
 */
export function usePlayback(submissions) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // Default to 4x for fast skimming

  // Available speed options (slower to faster)
  const speedOptions = [0.25, 0.5, 1, 2, 4];

  // Auto-advance when playing
  useEffect(() => {
    if (!isPlaying || !submissions.length) return;

    const interval = setInterval(() => {
      setCurrentIndex(prevIndex => {
        if (prevIndex >= submissions.length - 1) {
          setIsPlaying(false);
          return prevIndex;
        }
        return prevIndex + 1;
      });
    }, 2000 / speed); // Base interval is 2 seconds, modified by speed

    return () => clearInterval(interval);
  }, [isPlaying, speed, submissions.length]);

  // Reset to beginning when submissions change
  useEffect(() => {
    setCurrentIndex(0);
    setIsPlaying(false);
  }, [submissions]);

  const play = useCallback(() => {
    if (currentIndex >= submissions.length - 1) {
      // If at end, restart from beginning
      setCurrentIndex(0);
    }
    setIsPlaying(true);
  }, [currentIndex, submissions.length]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(prev => Math.min(prev + 1, submissions.length - 1));
  }, [submissions.length]);

  const stepBackward = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(prev => Math.max(prev - 1, 0));
  }, []);

  const jumpTo = useCallback((index) => {
    setIsPlaying(false);
    setCurrentIndex(Math.max(0, Math.min(index, submissions.length - 1)));
  }, [submissions.length]);

  const cycleSpeed = useCallback(() => {
    setSpeed(prev => {
      const currentIdx = speedOptions.indexOf(prev);
      const nextIdx = (currentIdx + 1) % speedOptions.length;
      return speedOptions[nextIdx];
    });
  }, []);

  return {
    // Current state
    currentIndex,
    currentSubmission: submissions[currentIndex] || null,
    previousSubmission: currentIndex > 0 ? submissions[currentIndex - 1] : null,
    isPlaying,
    speed,
    
    // Derived state
    isAtStart: currentIndex === 0,
    isAtEnd: currentIndex >= submissions.length - 1,
    totalCount: submissions.length,
    progress: submissions.length > 1 
      ? (currentIndex / (submissions.length - 1)) * 100 
      : 0,
    
    // Controls
    play,
    pause,
    toggle,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    cycleSpeed,
    speedOptions
  };
}
