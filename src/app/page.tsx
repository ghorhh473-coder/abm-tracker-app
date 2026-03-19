'use client';

import { useState, useRef, useEffect, type WheelEvent, type PointerEvent } from "react";
import Image from "next/image";
import html2canvas from "html2canvas";
import { posthog } from '@/lib/posthog';

export default function Home() {
  const [lineLevels, setLineLevels] = useState([0, 0, 0, 0]);
  const [showShareCard, setShowShareCard] = useState(false);
  const [shareView, setShareView] = useState<'preview' | 'story'>('preview');
  const [showSettings, setShowSettings] = useState(false);
  const [showDaysRequest, setShowDaysRequest] = useState(false);
  const [showDaysHelp, setShowDaysHelp] = useState(false);
  const [daysValue, setDaysValue] = useState(0);
  const [daysScroll, setDaysScroll] = useState(0);
  const [daysTargetScroll, setDaysTargetScroll] = useState(0);
  const [confirmedDaysValue, setConfirmedDaysValue] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDraggingDaysRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartValueRef = useRef(0);
  const daysRafRef = useRef<number | null>(null);
  const daysHoldIntervalRef = useRef<number | null>(null);
  const autoIntervalRef = useRef<number | null>(null);
  const lastIncrementRef = useRef<number | null>(null);

  const fillUp = () => {
    setLineLevels(prev => {
      const newLevels = [...prev];
      for (let i = 0; i < newLevels.length; i++) {
        if (newLevels[i] < 10) {
          newLevels[i]++;
          break;
        }
      }
      
      // Check if streak is completed (all levels at 10)
      if (newLevels.every(level => level === 10)) {
        setTimeout(() => setShowShareCard(true), 500);
      }
      
      return newLevels;
    });
  };

  const emptyOut = () => {
    setLineLevels([0, 0, 0, 0]);
    setShowShareCard(false);
    setShareView('preview');
  };

  const toggleAutoMode = () => {
    setAutoMode(prev => !prev);
  };

  // Auto mode: increment one line level every 24 hours
  useEffect(() => {
    if (autoMode) {
      const now = Date.now();
      const lastIncrement = lastIncrementRef.current;
      
      // Calculate 24 hours in milliseconds
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      // If we haven't incremented before, or it's been 24 hours
      if (!lastIncrement || now - lastIncrement >= twentyFourHours) {
        fillUp();
        lastIncrementRef.current = now;
      }
      
      // Set up interval to check every minute
      autoIntervalRef.current = window.setInterval(() => {
        const currentTime = Date.now();
        const lastInc = lastIncrementRef.current;
        
        if (!lastInc || currentTime - lastInc >= twentyFourHours) {
          fillUp();
          lastIncrementRef.current = currentTime;
        }
      }, 60 * 1000); // Check every minute
      
      return () => {
        if (autoIntervalRef.current) {
          clearInterval(autoIntervalRef.current);
          autoIntervalRef.current = null;
        }
      };
    } else {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    }
  }, [autoMode]);

  const downloadCard = async () => {
    if (cardRef.current) {
      try {
        const canvas = await html2canvas(cardRef.current, {
          width: 1080,
          height: 1920,
          scale: 1,
          backgroundColor: null,
        });
        
        const link = document.createElement('a');
        link.download = 'abm-streak-completion.png';
        link.href = canvas.toDataURL();
        link.click();
      } catch (error) {
        console.error('Error generating image:', error);
      }
    }
  };

  const clampDays = (value: number) => {
    return Math.max(0, Math.min(10000, value));
  };

  const clampDaysScroll = (value: number) => {
    return Math.max(0, Math.min(10000, value));
  };

  const adjustDays = (delta: number) => {
    setDaysTargetScroll(prev => clampDaysScroll(prev + delta));
  };

  const adjustDaysImmediate = (delta: number) => {
    setDaysTargetScroll(prev => {
      const next = clampDaysScroll(prev + delta);
      setDaysScroll(next);
      setDaysValue(clampDays(Math.round(next)));
      return next;
    });
  };

  const stopDaysHold = () => {
    if (daysHoldIntervalRef.current != null) {
      window.clearInterval(daysHoldIntervalRef.current);
      daysHoldIntervalRef.current = null;
    }
  };

  const startDaysHold = (delta: number) => {
    stopDaysHold();
    adjustDaysImmediate(delta);
    daysHoldIntervalRef.current = window.setInterval(() => {
      adjustDaysImmediate(delta);
    }, 70);
  };

  useEffect(() => {
    if (!showDaysRequest) return;

    const handleUp = () => {
      stopDaysHold();
      setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
    };

    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [showDaysRequest]);

  useEffect(() => {
    if (!showDaysRequest) {
      stopDaysHold();
      if (daysRafRef.current != null) {
        cancelAnimationFrame(daysRafRef.current);
        daysRafRef.current = null;
      }
      return;
    }

    const tick = () => {
      setDaysScroll(prev => {
        const next = prev + (daysTargetScroll - prev) * 0.22;
        const snappedForDisplay = clampDays(Math.round(next));
        setDaysValue(snappedForDisplay);

        if (Math.abs(daysTargetScroll - next) < 0.001) return daysTargetScroll;
        return next;
      });
      daysRafRef.current = requestAnimationFrame(tick);
    };

    daysRafRef.current = requestAnimationFrame(tick);
    return () => {
      stopDaysHold();
      if (daysRafRef.current != null) {
        cancelAnimationFrame(daysRafRef.current);
        daysRafRef.current = null;
      }
    };
  }, [daysTargetScroll, showDaysRequest]);

  const getLineColor = (level: number, lineIndex: number) => {
    if (lineIndex === 0) {
      return level > 0 ? 'bg-white' : 'bg-gray-800';
    }
    
    // Single color per line
    if (lineIndex === 1) return level > 0 ? 'bg-green-500' : 'bg-gray-800';  // Line 2: Green
    if (lineIndex === 2) return level > 0 ? 'bg-yellow-500' : 'bg-gray-800'; // Line 3: Yellow
    if (lineIndex === 3) return level > 0 ? 'bg-red-500' : 'bg-gray-800';    // Line 4: Red
    return 'bg-gray-800';
  };

  const getTotalProgress = () => {
    return lineLevels.reduce((sum, level) => sum + level, 0);
  };

  const getCurrentLevel = () => {
    const total = getTotalProgress();
    if (total === 0) return 0;
    if (total <= 10) return 1;
    if (total <= 20) return 2;
    if (total <= 30) return 3;
    if (total <= 40) return 4;
    return 4;
  };

  const getCircleColor = () => {
    const level = getCurrentLevel();
    if (level === 0) return '#1f2937'; // gray-800 (bg-gray-800)
    if (level === 1) return '#ffffff'; // white (bg-white)
    if (level === 2) return '#22c55e'; // green-500 (bg-green-500)
    if (level === 3) return '#eab308'; // yellow-500 (bg-yellow-500)
    if (level === 4) return '#ef4444'; // red-500 (bg-red-500)
    return '#1f2937';
  };

  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (getTotalProgress() / 40) * circumference;

  return (
    <div className="min-h-screen bg-black">
      <div className="absolute top-4 left-4">
        <Image
          src="/logo.jpg"
          alt="ABM Logo"
          width={120}
          height={60}
          className="h-auto"
          priority
        />
      </div>

      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={() => {
                  setShowSettings(true);
                  posthog?.capture('open_settings');
                }}
          className="p-3 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors"
          aria-label="Open settings"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 15.5C13.933 15.5 15.5 13.933 15.5 12C15.5 10.067 13.933 8.5 12 8.5C10.067 8.5 8.5 10.067 8.5 12C8.5 13.933 10.067 15.5 12 15.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15C19.3 15.3 19.4 15.7 19.6 15.9L20.1 16.4C20.6 16.9 20.6 17.7 20.1 18.2L18.2 20.1C17.7 20.6 16.9 20.6 16.4 20.1L15.9 19.6C15.7 19.4 15.3 19.3 15 19.4C14.4 19.6 13.7 19.7 13 19.8C12.7 19.8 12.5 20.1 12.5 20.4V21.1C12.5 21.8 11.9 22.4 11.2 22.4H8.8C8.1 22.4 7.5 21.8 7.5 21.1V20.4C7.5 20.1 7.3 19.8 7 19.8C6.3 19.7 5.6 19.6 5 19.4C4.7 19.3 4.3 19.4 4.1 19.6L3.6 20.1C3.1 20.6 2.3 20.6 1.8 20.1L-0.1 18.2C-0.6 17.7 -0.6 16.9 -0.1 16.4L0.4 15.9C0.6 15.7 0.7 15.3 0.6 15C0.4 14.4 0.3 13.7 0.2 13C0.2 12.7 -0.1 12.5 -0.4 12.5H-1.1C-1.8 12.5 -2.4 11.9 -2.4 11.2V8.8C-2.4 8.1 -1.8 7.5 -1.1 7.5H-0.4C-0.1 7.5 0.2 7.3 0.2 7C0.3 6.3 0.4 5.6 0.6 5C0.7 4.7 0.6 4.3 0.4 4.1L-0.1 3.6C-0.6 3.1 -0.6 2.3 -0.1 1.8L1.8 -0.1C2.3 -0.6 3.1 -0.6 3.6 -0.1L4.1 0.4C4.3 0.6 4.7 0.7 5 0.6C5.6 0.4 6.3 0.3 7 0.2C7.3 0.2 7.5 -0.1 7.5 -0.4V-1.1C7.5 -1.8 8.1 -2.4 8.8 -2.4H11.2C11.9 -2.4 12.5 -1.8 12.5 -1.1V-0.4C12.5 -0.1 12.7 0.2 13 0.2C13.7 0.3 14.4 0.4 15 0.6C15.3 0.7 15.7 0.6 15.9 0.4L16.4 -0.1C16.9 -0.6 17.7 -0.6 18.2 -0.1L20.1 1.8C20.6 2.3 20.6 3.1 20.1 3.6L19.6 4.1C19.4 4.3 19.3 4.7 19.4 5C19.6 5.6 19.7 6.3 19.8 7C19.8 7.3 20.1 7.5 20.4 7.5H21.1C21.8 7.5 22.4 8.1 22.4 8.8V11.2C22.4 11.9 21.8 12.5 21.1 12.5H20.4C20.1 12.5 19.8 12.7 19.8 13C19.7 13.7 19.6 14.4 19.4 15Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
      
      {/* Circular Progress Graph */}
      <div className="absolute top-24 right-8">
        <div className="relative w-32 h-32">
          <svg className="transform -rotate-90 w-32 h-32">
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke="#374151"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="64"
              cy="64"
              r="45"
              stroke={getCircleColor()}
              strokeWidth="8"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 ease-out"
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">Level {getCurrentLevel()}</span>
            <span className="text-xs text-gray-400">{getTotalProgress()}/40</span>
          </div>
        </div>
      </div>
      
      <div className="absolute top-24 left-8 space-y-4">
        {lineLevels.map((level, index) => (
          <div key={index} className="flex items-center space-x-4">
            <div className="w-96 h-2 bg-gray-800 rounded overflow-hidden">
              <div 
                className={`h-full transition-all duration-300 ${getLineColor(level, index)}`}
                style={{ width: `${(level / 10) * 100}%` }}
              ></div>
            </div>
            <span className="text-white text-sm w-8">{level}</span>
          </div>
        ))}
      </div>

      <div className="absolute top-64 left-8 space-x-4">
        <button 
          onClick={fillUp}
          className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Fill Up
        </button>
        <button 
          onClick={emptyOut}
          className="px-6 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors"
        >
          Empty Out
        </button>
        <button 
          onClick={toggleAutoMode}
          className={`px-6 py-2 rounded transition-colors ${
            autoMode 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-700 text-white hover:bg-gray-600'
          }`}
        >
          {autoMode ? 'Auto ON' : 'Auto OFF'}
        </button>
      </div>

      {/* Shareable Card Modal */}
      {showShareCard && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-lg max-w-md w-full mx-4">
            <button
              onClick={() => {
                setShareView('story');
                posthog?.capture('share_open');
              }}
              className="text-left w-full"
              type="button"
            >
              <h3 className="text-white text-xl font-bold mb-4">🎉 Streak Complete!</h3>
            </button>
            <p className="text-gray-300 mb-4">Share your achievement on Instagram Stories!</p>
            
            {/* Hidden Shareable Card */}
            <div
              style={{ position: 'fixed', left: -10000, top: 0, width: 1080, height: 1920 }}
              aria-hidden="true"
            >
              <div 
                ref={cardRef}
                className="w-[1080px] h-[1920px] relative overflow-hidden"
                style={{
                  backgroundColor: '#7c3aed',
                  backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                }}
              >
                {/* Background Pattern */}
                <div className="absolute inset-0" style={{ opacity: 0.2 }}>
                  <div className="absolute top-20 left-20 w-32 h-32 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                  <div className="absolute top-60 right-40 w-24 h-24 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                  <div className="absolute bottom-40 left-32 w-40 h-40 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                  <div className="absolute bottom-80 right-20 w-28 h-28 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                </div>
                
                {/* Content */}
                <div className="relative z-10 flex flex-col items-center justify-center h-full p-20">
                  {/* Logo */}
                  <div className="mb-20">
                    <div
                      className="w-80 h-40 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: '#ffffff' }}
                    >
                      <span className="text-6xl font-bold" style={{ color: '#7c3aed' }}>ABM</span>
                    </div>
                  </div>
                  
                  {/* Achievement Text */}
                  <div className="text-center mb-16">
                    <h1 className="text-8xl font-bold mb-8" style={{ color: '#ffffff' }}>STREAK COMPLETE!</h1>
                    <p className="text-4xl" style={{ color: '#ffffff', opacity: 0.9 }}>Level 4 Achieved</p>
                  </div>
                  
                  {/* Progress Visualization */}
                  <div
                    className="rounded-3xl p-12 mb-16"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                  >
                    <div className="space-y-6">
                      {lineLevels.map((level, index) => (
                        <div key={index} className="flex items-center space-x-6">
                          <div
                            className="w-96 h-4 rounded-full overflow-hidden"
                            style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
                          >
                            <div 
                              className="h-full"
                              style={{
                                width: '100%',
                                backgroundColor:
                                  index === 0
                                    ? '#ffffff'
                                    : index === 1
                                      ? '#4ade80'
                                      : index === 2
                                        ? '#facc15'
                                        : '#f87171',
                              }}
                            ></div>
                          </div>
                          <span className="text-3xl font-bold w-16" style={{ color: '#ffffff' }}>10/10</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="text-center">
                    <p className="text-3xl mb-4" style={{ color: '#ffffff', opacity: 0.75 }}>40/40 Complete</p>
                    <p className="text-2xl" style={{ color: '#ffffff', opacity: 0.5 }}>Keep the momentum going!</p>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ perspective: 1000 }}>
              <div
                className="relative"
                style={{
                  transformStyle: 'preserve-3d',
                  transition: 'transform 500ms ease',
                  transform: shareView === 'story' ? 'rotateY(180deg)' : 'rotateY(0deg)',
                }}
              >
                {/* Front: Preview */}
                <div style={{ backfaceVisibility: 'hidden' }}>
                  {/* Preview */}
                  <button
                    type="button"
                    onClick={() => setShareView('story')}
                    className="bg-gray-800 p-4 rounded-lg mb-4 w-full"
                  >
                    <div className="aspect-[9/16] bg-gradient-to-br from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                      <div className="text-center text-white">
                        <div className="text-6xl mb-4">🎉</div>
                        <div className="text-2xl font-bold">STREAK COMPLETE!</div>
                        <div className="text-lg opacity-75">Level 4 • 40/40</div>
                      </div>
                    </div>
                  </button>
                  
                  {/* Buttons */}
                  <div className="flex space-x-4">
                    <button 
                      onClick={downloadCard}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                      type="button"
                      onMouseDown={() => posthog?.capture('share_download')}
                    >
                      Download Card
                    </button>
                    <button 
                      onClick={() => {
                        setShowShareCard(false);
                        setShareView('preview');
                      }}
                      className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                      type="button"
                    >
                      Close
                    </button>
                  </div>
                </div>

                {/* Back: Full Story Card */}
                <div
                  className="absolute inset-0"
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <div className="bg-gray-800 p-4 rounded-lg mb-4">
                    <div
                      className="relative mx-auto overflow-hidden rounded-lg"
                      style={{ aspectRatio: '9 / 16' }}
                    >
                      <div
                        className="origin-top-left"
                        style={{
                          width: 1080,
                          height: 1920,
                          transform: 'scale(0.28)',
                        }}
                      >
                        <div
                          className="w-[1080px] h-[1920px] relative overflow-hidden"
                          style={{
                            backgroundColor: '#7c3aed',
                            backgroundImage: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)',
                          }}
                        >
                          <div className="absolute inset-0" style={{ opacity: 0.2 }}>
                            <div className="absolute top-20 left-20 w-32 h-32 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                            <div className="absolute top-60 right-40 w-24 h-24 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                            <div className="absolute bottom-40 left-32 w-40 h-40 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                            <div className="absolute bottom-80 right-20 w-28 h-28 rounded-full" style={{ backgroundColor: '#ffffff' }}></div>
                          </div>
                          <div className="relative z-10 flex flex-col items-center justify-center h-full p-20">
                            <div className="mb-20">
                              <div
                                className="w-80 h-40 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: '#ffffff' }}
                              >
                                <span className="text-6xl font-bold" style={{ color: '#7c3aed' }}>ABM</span>
                              </div>
                            </div>
                            <div className="text-center mb-16">
                              <h1 className="text-8xl font-bold mb-8" style={{ color: '#ffffff' }}>STREAK COMPLETE!</h1>
                              <p className="text-4xl" style={{ color: '#ffffff', opacity: 0.9 }}>Level 4 Achieved</p>
                            </div>
                            <div
                              className="rounded-3xl p-12 mb-16"
                              style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}
                            >
                              <div className="space-y-6">
                                {lineLevels.map((level, index) => (
                                  <div key={index} className="flex items-center space-x-6">
                                    <div
                                      className="w-96 h-4 rounded-full overflow-hidden"
                                      style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
                                    >
                                      <div
                                        className="h-full"
                                        style={{
                                          width: '100%',
                                          backgroundColor:
                                            index === 0
                                              ? '#ffffff'
                                              : index === 1
                                                ? '#4ade80'
                                                : index === 2
                                                  ? '#facc15'
                                                  : '#f87171',
                                        }}
                                      ></div>
                                    </div>
                                    <span className="text-3xl font-bold w-16" style={{ color: '#ffffff' }}>10/10</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-3xl mb-4" style={{ color: '#ffffff', opacity: 0.75 }}>40/40 Complete</p>
                              <p className="text-2xl" style={{ color: '#ffffff', opacity: 0.5 }}>Keep the momentum going!</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={() => setShareView('preview')}
                      className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors"
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      onClick={downloadCard}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                      type="button"
                    >
                      Download
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-gray-700 bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-gray-200 rounded-lg max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-900 text-xl font-bold">Settings</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3 py-2 bg-gray-300 text-gray-900 rounded hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            </div>
            <div className="text-gray-800 space-y-4">
              <div>
                <div className="text-gray-900 font-semibold">ABM (Akhand Brahmachari Mode)</div>
                <div className="text-gray-700">
                  Ultimate Celibacy Mode — designed to help you stay consistent, track progress, and build discipline.
                </div>
              </div>

              <div>
                <div className="text-gray-900 font-semibold">More features are coming soon</div>
                <div className="text-gray-700">
                  We’re actively improving the app and shipping updates regularly.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setDaysValue(confirmedDaysValue);
                  setDaysScroll(confirmedDaysValue);
                  setDaysTargetScroll(confirmedDaysValue);
                  setShowDaysRequest(true);
                  posthog?.capture('open_request_days');
                }}
                className="text-left w-full rounded-md p-3 bg-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="text-gray-900 font-semibold">Request support for more days</div>
                <div className="text-gray-700">
                  Want longer streak tracking or additional milestones? Send a request and we’ll prioritize it.
                </div>
                {confirmedDaysValue > 0 && (
                  <div className="text-gray-600 text-sm mt-2">Requested: {confirmedDaysValue}</div>
                )}
              </button>

              <div>
                <div className="text-gray-900 font-semibold">Give feedback</div>
                <div className="text-gray-700">
                  Your feedback helps us improve your experience. Tell us what’s working and what isn’t.
                </div>
              </div>

              <div>
                <div className="text-gray-900 font-semibold">Share feature ideas</div>
                <div className="text-gray-700">
                  What features would you love to see in this app? Share your ideas and we’ll consider them for upcoming releases.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDaysRequest && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
          <div className="w-full max-w-md mx-4">
            <div className="text-white text-2xl font-bold mb-2">Request more days</div>
            <div className="text-gray-400 mb-6">Scroll to select a value between 0 and 10,000.</div>

            {showDaysHelp ? (
              <div className="rounded-xl border border-gray-800 p-4" style={{ backgroundColor: '#050505' }}>
                <div className="text-white text-lg font-semibold mb-1">Help</div>
                <div className="text-gray-400 text-sm mb-4">Quick-pick a common milestone.</div>

                <div className="grid grid-cols-2 gap-3">
                  {[100, 150, 200, 365, 777].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setDaysTargetScroll(preset);
                        setDaysScroll(preset);
                        setDaysValue(preset);
                        setShowDaysHelp(false);
                        posthog?.capture('request_days_help_pick', { preset });
                      }}
                      className="px-4 py-4 rounded-lg bg-gray-900 text-white font-semibold hover:bg-gray-800 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <div className="flex space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setShowDaysHelp(false)}
                    className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDaysHelp(false);
                      setShowDaysRequest(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="relative rounded-xl overflow-hidden border border-gray-800"
                  style={{ height: 260, backgroundColor: '#050505', touchAction: 'none', overscrollBehavior: 'contain' }}
                  onWheel={(e: WheelEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    const step = e.deltaY / 60;
                    setDaysTargetScroll(prev => clampDaysScroll(prev + step));
                  }}
                  onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
                    isDraggingDaysRef.current = true;
                    dragStartYRef.current = e.clientY;
                    dragStartValueRef.current = daysTargetScroll;
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
                    if (!isDraggingDaysRef.current) return;
                    e.preventDefault();
                    const dy = e.clientY - dragStartYRef.current;
                    const step = dy / 18;
                    const next = clampDaysScroll(dragStartValueRef.current - step);
                    setDaysTargetScroll(next);
                  }}
                  onPointerUp={() => {
                    isDraggingDaysRef.current = false;
                    setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                  }}
                  onPointerCancel={() => {
                    isDraggingDaysRef.current = false;
                    setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                  }}
                >
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                    <div className="mx-6 h-12 rounded-lg border border-gray-700" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="select-none"
                        style={{ color: '#ffffff', fontSize: 44, fontWeight: 800, letterSpacing: 0.5 }}
                      >
                        {clampDays(Math.round(daysScroll))}
                      </div>
                    </div>
                  </div>

                  <div className="absolute inset-x-0 bottom-4 px-6 flex items-center justify-between z-30">
                    <button
                      type="button"
                      className="w-12 h-12 rounded-full border border-gray-700 text-white text-2xl font-bold bg-black/30 hover:bg-white/10 transition-colors"
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(-1);
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(-1);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(-1);
                      }}
                      onPointerUp={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onMouseUp={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onTouchEnd={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onPointerCancel={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onTouchCancel={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onPointerLeave={() => {
                        stopDaysHold();
                      }}
                      onMouseLeave={() => {
                        stopDaysHold();
                      }}
                      aria-label="Decrease days"
                    >
                      −
                    </button>

                    <button
                      type="button"
                      className="w-12 h-12 rounded-full border border-gray-700 text-white text-2xl font-bold bg-black/30 hover:bg-white/10 transition-colors"
                      style={{ touchAction: 'none' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(1);
                        e.currentTarget.setPointerCapture(e.pointerId);
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(1);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startDaysHold(1);
                      }}
                      onPointerUp={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onMouseUp={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onTouchEnd={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onPointerCancel={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onTouchCancel={() => {
                        stopDaysHold();
                        setDaysTargetScroll(prev => clampDaysScroll(Math.round(prev)));
                      }}
                      onPointerLeave={() => {
                        stopDaysHold();
                      }}
                      onMouseLeave={() => {
                        stopDaysHold();
                      }}
                      aria-label="Increase days"
                    >
                      +
                    </button>
                  </div>

                  <div className="h-full flex items-center justify-center relative z-0" style={{ perspective: 900 }}>
                    <div style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}>
                      {Array.from({ length: 15 }, (_, i) => i - 7).map((i, slotIndex) => {
                        const base = Math.round(daysScroll);
                        const rawValue = base + i;
                        const isInRange = rawValue >= 0 && rawValue <= 10000;
                        const value = isInRange ? rawValue : null;
                        const offset = rawValue - daysScroll;
                        const y = offset * 18;
                        const rotateX = offset * 12;
                        const translateZ = 150 - Math.abs(offset) * 16;
                        const opacity = Math.max(0, 1 - Math.abs(offset) * 0.14);
                        const scale = 1 - Math.abs(offset) * 0.045;

                        return (
                          <div
                            key={`days-slot-${slotIndex}`}
                            className="text-center select-none"
                            style={{
                              position: 'absolute',
                              top: '50%',
                              left: 0,
                              right: 0,
                              transform: `translateY(-50%) translateY(${y}px) rotateX(${rotateX}deg) translateZ(${translateZ}px) scale(${scale})`,
                              opacity: !isInRange || Math.abs(offset) < 0.6 ? 0 : opacity,
                              color: Math.abs(offset) < 0.5 ? '#ffffff' : '#9ca3af',
                              fontSize: Math.abs(offset) < 0.5 ? 44 : 28,
                              fontWeight: Math.abs(offset) < 0.5 ? 800 : 600,
                              letterSpacing: 0.5,
                              transition: 'transform 60ms linear, opacity 60ms linear',
                              backfaceVisibility: 'hidden',
                              WebkitBackfaceVisibility: 'hidden',
                              transformOrigin: 'center center',
                            }}
                          >
                            {Math.abs(offset) < 0.5 ? '' : (value ?? '')}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={() => {
                  setShowDaysHelp(true);
                  posthog?.capture('request_days_help_open');
                }}
                    className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Help
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const snapped = clampDays(Math.round(daysTargetScroll));
                      setDaysTargetScroll(snapped);
                      setDaysScroll(snapped);
                      setDaysValue(snapped);
                      setConfirmedDaysValue(snapped);
                      setShowDaysHelp(false);
                      setShowDaysRequest(false);
                      posthog?.capture('request_days_confirm', { value: snapped });
                    }}
                    className="flex-1 px-4 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDaysHelp(false);
                      setShowDaysRequest(false);
                    }}
                    className="flex-1 px-4 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
