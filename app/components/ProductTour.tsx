'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface TutorialStep {
    target: string;          // CSS selector for the element to highlight
    title: string;           // Step headline
    content: string;         // Tooltip description
    position: 'top' | 'bottom' | 'left' | 'right';  // Tooltip placement
    tab?: 'create' | 'manage' | 'schedule';  // Which tab this step belongs to (optional)
}

const TUTORIAL_STEPS: TutorialStep[] = [
    {
        target: '#nav-tabs',
        title: 'Navigation Tabs',
        content: 'Switch between Create, Manage, and Schedule tabs to access different features of the app.',
        position: 'bottom',
        tab: 'create',
    },
    {
        target: '#recipients-panel',
        title: 'Recipients',
        content: 'Add your classmates\' emails here. They\'ll receive calendar invitations when you create events.',
        position: 'right',
        tab: 'create',
    },
    {
        target: '#todo-input',
        title: 'To-Do List',
        content: 'Paste your homework, deadlines, and activities here. Our AI will understand dates like "Dec 15" or "next Monday".',
        position: 'right',
        tab: 'create',
    },
    {
        target: '#generate-btn',
        title: 'Generate Events',
        content: 'Click here to let AI parse your to-do list into calendar events. Review them before adding!',
        position: 'top',
        tab: 'create',
    },
    {
        target: '#silent-mode-btn',
        title: 'Silent Mode',
        content: 'Toggle this to disable email notifications. Useful when testing or making bulk changes.',
        position: 'bottom',
        tab: 'create',
    },
    {
        target: '#schedule-tab-btn',
        title: 'Class Schedule',
        content: 'Create your weekly class schedule here! You can import from an image or add classes manually.',
        position: 'bottom',
        tab: 'create',
    },
];

const STORAGE_KEY = 'bscs_tutorial_completed';
const FIRST_VISIT_KEY = 'bscs_first_visit';

interface ProductTourProps {
    onTabChange?: (tab: 'create' | 'manage' | 'schedule') => void;
}

export default function ProductTour({ onTabChange }: ProductTourProps) {
    const [isActive, setIsActive] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [showWelcome, setShowWelcome] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    // Check if first time visitor
    useEffect(() => {
        const hasCompleted = localStorage.getItem(STORAGE_KEY);
        const hasVisited = localStorage.getItem(FIRST_VISIT_KEY);

        if (!hasVisited) {
            localStorage.setItem(FIRST_VISIT_KEY, 'true');
            // Small delay to let the page render
            setTimeout(() => setShowWelcome(true), 500);
        } else if (!hasCompleted) {
            // Returning user who didn't complete - maybe show a subtle hint
        }
    }, []);

    // Update target position
    const updateTargetPosition = useCallback(() => {
        if (!isActive) return;

        const step = TUTORIAL_STEPS[currentStep];
        const element = document.querySelector(step.target);

        if (element) {
            const rect = element.getBoundingClientRect();
            setTargetRect(rect);

            // Scroll element into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [isActive, currentStep]);

    useEffect(() => {
        updateTargetPosition();

        // Update on resize/scroll
        window.addEventListener('resize', updateTargetPosition);
        window.addEventListener('scroll', updateTargetPosition, true);

        return () => {
            window.removeEventListener('resize', updateTargetPosition);
            window.removeEventListener('scroll', updateTargetPosition, true);
        };
    }, [updateTargetPosition]);

    // When step changes, check if we need to switch tabs
    useEffect(() => {
        if (isActive && onTabChange) {
            const step = TUTORIAL_STEPS[currentStep];
            if (step.tab) {
                onTabChange(step.tab);
                // Wait for tab to render, then update position
                setTimeout(updateTargetPosition, 100);
            }
        }
    }, [currentStep, isActive, onTabChange, updateTargetPosition]);

    const startTutorial = () => {
        setShowWelcome(false);
        setCurrentStep(0);
        setIsActive(true);
    };

    const nextStep = () => {
        if (currentStep < TUTORIAL_STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            completeTutorial();
        }
    };

    const prevStep = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const skipTutorial = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsActive(false);
        setShowWelcome(false);
    };

    const completeTutorial = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        setIsActive(false);
    };

    // Calculate tooltip position
    const getTooltipStyle = (): React.CSSProperties => {
        if (!targetRect) return { display: 'none' };

        const step = TUTORIAL_STEPS[currentStep];
        const padding = 16;
        const tooltipWidth = 320;
        const tooltipHeight = 180;

        let top = 0;
        let left = 0;

        switch (step.position) {
            case 'top':
                top = targetRect.top - tooltipHeight - padding;
                left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                break;
            case 'bottom':
                top = targetRect.bottom + padding;
                left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
                break;
            case 'left':
                top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
                left = targetRect.left - tooltipWidth - padding;
                break;
            case 'right':
                top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
                left = targetRect.right + padding;
                break;
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) left = padding;
        if (left + tooltipWidth > viewportWidth - padding) {
            left = viewportWidth - tooltipWidth - padding;
        }
        if (top < padding) top = padding;
        if (top + tooltipHeight > viewportHeight - padding) {
            top = viewportHeight - tooltipHeight - padding;
        }

        return {
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${tooltipWidth}px`,
            zIndex: 10002,
        };
    };

    // Welcome modal
    if (showWelcome) {
        return (
            <div className="fixed inset-0 z-10000 flex items-center justify-center">
                {/* Backdrop */}
                <div
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                    onClick={skipTutorial}
                />

                {/* Welcome Card */}
                <div className="relative bg-linear-to-br from-red-900 to-red-950 rounded-2xl p-8 max-w-md mx-4 border border-white/20 shadow-2xl animate-fade-in">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                                <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
                            </svg>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-3">
                            Welcome to BSCS Calendar! 🎓
                        </h2>

                        <p className="text-white/70 mb-8">
                            Let us show you around! This quick tour will help you get started with creating events, managing your calendar, and organizing your class schedule.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                            <button
                                onClick={startTutorial}
                                className="px-6 py-3 bg-white text-red-700 font-bold rounded-full hover:bg-white/90 transition-all"
                            >
                                Start Tour
                            </button>
                            <button
                                onClick={skipTutorial}
                                className="px-6 py-3 bg-white/10 text-white font-medium rounded-full hover:bg-white/20 transition-all border border-white/20"
                            >
                                Skip for Now
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Tutorial active
    if (!isActive || !targetRect) return null;

    const step = TUTORIAL_STEPS[currentStep];

    return (
        <>
            {/* Overlay with spotlight cutout */}
            <div className="fixed inset-0 z-10000 pointer-events-none">
                <svg className="absolute inset-0 w-full h-full">
                    <defs>
                        <mask id="spotlight-mask">
                            <rect x="0" y="0" width="100%" height="100%" fill="white" />
                            <rect
                                x={targetRect.left - 8}
                                y={targetRect.top - 8}
                                width={targetRect.width + 16}
                                height={targetRect.height + 16}
                                rx="12"
                                fill="black"
                            />
                        </mask>
                    </defs>
                    <rect
                        x="0"
                        y="0"
                        width="100%"
                        height="100%"
                        fill="rgba(0, 0, 0, 0.75)"
                        mask="url(#spotlight-mask)"
                    />
                </svg>

                {/* Highlight border around target */}
                <div
                    className="absolute border-2 border-white rounded-xl animate-pulse-glow pointer-events-none"
                    style={{
                        top: targetRect.top - 8,
                        left: targetRect.left - 8,
                        width: targetRect.width + 16,
                        height: targetRect.height + 16,
                    }}
                />
            </div>

            {/* Tooltip */}
            <div
                ref={tooltipRef}
                style={getTooltipStyle()}
                className="bg-white rounded-xl shadow-2xl p-5 animate-fade-in pointer-events-auto"
            >
                {/* Step indicator */}
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                        Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                    </span>
                    <button
                        onClick={skipTutorial}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                    >
                        Skip
                    </button>
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600 mb-5">{step.content}</p>

                {/* Progress bar */}
                <div className="h-1 bg-gray-100 rounded-full mb-4 overflow-hidden">
                    <div
                        className="h-full bg-red-500 transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / TUTORIAL_STEPS.length) * 100}%` }}
                    />
                </div>

                {/* Navigation buttons */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 0}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                        ← Back
                    </button>
                    <button
                        onClick={nextStep}
                        className="px-5 py-2 bg-red-600 text-white text-sm font-bold rounded-full hover:bg-red-700 transition-all"
                    >
                        {currentStep === TUTORIAL_STEPS.length - 1 ? 'Finish' : 'Next →'}
                    </button>
                </div>
            </div>
        </>
    );
}

// Export a hook to restart the tutorial
export function useRestartTutorial() {
    const restart = () => {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(FIRST_VISIT_KEY);
        window.location.reload();
    };

    return restart;
}
