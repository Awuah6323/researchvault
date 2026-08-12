import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  Library, 
  FolderKanban, 
  Sparkles, 
  MessageSquare, 
  FileText, 
  Quote, 
  Cloud, 
  Palette, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  ArrowRight, 
  Compass, 
  CheckCircle2, 
  HelpCircle,
  X,
  Zap,
  Info
} from 'lucide-react';

export default function OnboardingCarousel({ onNavigate, onOpenAddModal, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [slideDuration, setSlideDuration] = useState(5); // Default 5 seconds (selectable: 5s, 7s, 10s)
  const touchStartX = useRef(null);

  const slides = [
    {
      id: 'welcome',
      badge: 'Getting Started',
      badgeIcon: Compass,
      title: 'Welcome to ResearchVault',
      subtitle: 'Your Smart AI-Powered Academic Workspace',
      description: 'ResearchVault simplifies reading, organizing, and synthesizing academic papers. Search literature, generate AI summaries, manage notes, and sync across devices.',
      navGuide: 'Use the Sidebar on desktop or the Bottom Navigation bar on mobile to switch between features seamlessly.',
      actionText: 'Explore App Features',
      actionTab: 'home',
      gradient: 'linear-gradient(135deg, rgba(37, 99, 235, 0.15) 0%, rgba(147, 51, 234, 0.15) 100%)',
      accentColor: 'var(--primary)',
      icon: BookOpen,
      features: [
        'Centralized Literature Management',
        'Gemini AI Summaries & Insights',
        'Automatic Multi-Format Citations',
        'Offline PWA & Cloud Vault Sync'
      ]
    },
    {
      id: 'search',
      badge: 'Navigation & Discovery',
      badgeIcon: Search,
      title: 'Global Academic Search',
      subtitle: 'Access 200M+ Research Papers Instantly',
      description: 'Discover literature from OpenAlex, arXiv, and CrossRef directly by topic, author name, or DOI string.',
      navGuide: 'Click "Academic Search" in the sidebar or press the top search bar anytime to query external literature and import papers with 1-click.',
      actionText: 'Try Academic Search',
      actionTab: 'search',
      gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(6, 182, 212, 0.15) 100%)',
      accentColor: '#10b981',
      icon: Search,
      features: [
        'Search OpenAlex, arXiv & CrossRef',
        'Filter by Year, Citations & Open Access',
        'Import Papers to Library in 1 Click',
        'Direct PDF & Publisher DOI links'
      ]
    },
    {
      id: 'library',
      badge: 'Organization',
      badgeIcon: Library,
      title: 'My Library & PDF Document Reader',
      subtitle: 'Organize, Categorize & Annotate Papers',
      description: 'Group papers into custom research folders, assign tags, track reading progress, and read papers in our distraction-free document viewer.',
      navGuide: 'Navigate to "My Library" to filter by tags or "Categories & Folders" to manage topics. Click "Read" on any card to launch the reader.',
      actionText: 'Open My Library',
      actionTab: 'library',
      gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(239, 68, 68, 0.15) 100%)',
      accentColor: '#f59e0b',
      icon: Library,
      features: [
        'Custom Folder & Category Trees',
        'Built-in Web & PDF Reader',
        'Reading Progress Tracker (%)',
        'Star & Favorite Important Papers'
      ]
    },
    {
      id: 'synthesis',
      badge: 'AI Literature Review',
      badgeIcon: Sparkles,
      title: 'AI Literature Review & Matrix Synthesis',
      subtitle: 'Compare Papers & Extract Research Gaps',
      description: 'Synthesize multiple papers into structured review matrices. Compare methodologies, core findings, sample sizes, and future research directions.',
      navGuide: 'Click "AI Literature Review" in the sidebar to run synthesis matrices across saved papers or click "AI Summary" on any paper card.',
      actionText: 'Launch AI Synthesis',
      actionTab: 'synthesis',
      gradient: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
      accentColor: '#a855f7',
      icon: Sparkles,
      features: [
        'Comparative Paper Matrix Grid',
        'Methodology & Findings Extraction',
        'Automatic Executive Summaries',
        'Export Synthesis to Markdown/PDF'
      ]
    },
    {
      id: 'aichat',
      badge: 'AI Research Assistant',
      badgeIcon: MessageSquare,
      title: 'Conversational AI Research Assistant',
      subtitle: 'Ask Questions & Brainstorm Hypotheses',
      description: 'Chat directly with Gemini AI about your research topics. Interrogate paper contents, request plain-language explanations, or formulate research questions.',
      navGuide: 'Select "AI Chat Assistant" from the menu to initiate an interactive Q&A session with prompt shortcuts for literature analysis.',
      actionText: 'Chat with AI Assistant',
      actionTab: 'aichat',
      gradient: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)',
      accentColor: '#06b6d4',
      icon: MessageSquare,
      features: [
        'Context-Aware Academic Q&A',
        'Instant Literature Summarization',
        'Hypothesis & Thesis Drafting',
        'Customizable Prompt Templates'
      ]
    },
    {
      id: 'notes',
      badge: 'Citations & Notes',
      badgeIcon: Quote,
      title: 'Research Notes & Automatic Citations',
      subtitle: '1-Click APA 7, BibTeX & IEEE Export',
      description: 'Never format citations by hand again. Copy accurate APA 7, BibTeX, IEEE, or MLA references instantly, and maintain annotated research notes.',
      navGuide: 'Click the quote icon on any paper card for quick citations, or visit "Research Notes" to compile personal annotations.',
      actionText: 'View Research Notes',
      actionTab: 'notes',
      gradient: 'linear-gradient(135deg, rgba(236, 72, 153, 0.15) 0%, rgba(244, 63, 94, 0.15) 100%)',
      accentColor: '#ec4899',
      icon: Quote,
      features: [
        'APA 7, BibTeX, IEEE & MLA Citations',
        'Rich Text & Markdown Note Editor',
        'Paper-Linked Annotation Logs',
        'Quick Copy to Clipboard & LaTeX'
      ]
    },
    {
      id: 'profile',
      badge: 'Cloud Sync & Customization',
      badgeIcon: Cloud,
      title: 'Multi-Device Cloud Sync & Themes',
      subtitle: 'Sync Vault Data & Personalize Style',
      description: 'Sign into Cloud Vault to sync papers and notes across desktop, tablet, and mobile. Customize visual themes including Warm Sepia, Cyber Emerald, and OLED Dark.',
      navGuide: 'Go to "Profile & Settings" to log in, enable background cloud sync, or change your theme via the top navbar palette button.',
      actionText: 'Profile & Settings',
      actionTab: 'profile',
      gradient: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
      accentColor: '#22c55e',
      icon: Cloud,
      features: [
        'Cloud Vault Multi-Device Sync',
        '4 Premium Visual Themes',
        'PWA Offline App Installation',
        'Data Export & Vault Backup'
      ]
    }
  ];

  const totalSlides = slides.length;

  // Cycle speed options: 5s -> 7s -> 10s -> 5s
  const handleCycleSpeed = () => {
    if (slideDuration === 5) setSlideDuration(7);
    else if (slideDuration === 7) setSlideDuration(10);
    else setSlideDuration(5);
  };

  // Auto-slide duration (5s - 10s) unless paused or hovered
  useEffect(() => {
    if (!isPlaying || isHovered) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, slideDuration * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, isHovered, totalSlides, slideDuration]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50) {
      handleNext();
    } else if (diff < -50) {
      handlePrev();
    }
    touchStartX.current = null;
  };

  // Keyboard Navigation Support (Left / Right Arrow Keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlides]);

  const currentSlide = slides[currentIndex];
  const BadgeIcon = currentSlide.badgeIcon;
  const SlideIcon = currentSlide.icon;

  return (
    <div 
      className="onboarding-carousel-card"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        borderRadius: '24px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
        boxShadow: 'var(--card-shadow)',
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* Floating Side Arrow Buttons: Left (Previous) */}
      <button
        onClick={handlePrev}
        aria-label="Previous Slide"
        title="Previous Slide (← Left Arrow)"
        style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 30,
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.2s ease',
          opacity: 0.85
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
      >
        <ChevronLeft size={22} />
      </button>

      {/* Floating Side Arrow Buttons: Right (Next) */}
      <button
        onClick={handleNext}
        aria-label="Next Slide"
        title="Next Slide (→ Right Arrow)"
        style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 30,
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          color: 'var(--text-main)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
          transition: 'all 0.2s ease',
          opacity: 0.85
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.85')}
      >
        <ChevronRight size={22} />
      </button>
      {/* Dynamic Animated Progress Bar (5s-10s Auto-Slide Timer) */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        backgroundColor: 'rgba(0, 0, 0, 0.06)',
        zIndex: 20
      }}>
        <div 
          key={`${currentIndex}-${isPlaying}-${isHovered}-${slideDuration}`}
          style={{
            height: '100%',
            backgroundColor: currentSlide.accentColor,
            width: isPlaying && !isHovered ? '100%' : '0%',
            transition: isPlaying && !isHovered ? `width ${slideDuration}s linear` : 'none',
            borderRadius: '0 2px 2px 0'
          }}
        />
      </div>

      {/* Main Slide Card Container */}
      <div style={{
        padding: '28px 32px',
        background: currentSlide.gradient,
        minHeight: '280px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative'
      }}>
        {/* Top Header Row: Badge, Controls & Dismiss */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span 
              className="badge" 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.8rem',
                fontWeight: 700,
                backgroundColor: 'var(--bg-card)',
                color: currentSlide.accentColor,
                border: '1px solid var(--border-color)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <BadgeIcon size={14} />
              {currentSlide.badge}
            </span>

            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              Slide {currentIndex + 1} of {totalSlides}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Speed Selector Toggle Button (5s / 7s / 10s) */}
            <button
              onClick={handleCycleSpeed}
              title={`Slide Duration: ${slideDuration}s. Click to switch (5s, 7s, 10s)`}
              style={{
                padding: '4px 10px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: currentSlide.accentColor,
                fontSize: '0.78rem',
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ⏱️ {slideDuration}s
            </button>

            {/* Auto-Slide Play/Pause Button */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? `Pause ${slideDuration}s Auto-slide` : `Play ${slideDuration}s Auto-slide`}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: '2px' }} />}
            </button>

            {/* Optional Close/Dismiss Guide Button */}
            {onClose && (
              <button
                onClick={onClose}
                title="Dismiss Guide Carousel"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Middle Content Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: '24px',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              lineHeight: 1.25,
              marginBottom: '4px',
              fontFamily: 'var(--font-serif)'
            }}>
              {currentSlide.title}
            </h2>

            <div style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              color: currentSlide.accentColor,
              marginBottom: '10px'
            }}>
              {currentSlide.subtitle}
            </div>

            <p style={{
              fontSize: '0.9rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
              marginBottom: '14px',
              maxWidth: '680px'
            }}>
              {currentSlide.description}
            </p>

            {/* Navigation Tip Callout Box */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--border-color)',
              fontSize: '0.82rem',
              color: 'var(--text-main)',
              lineHeight: 1.4,
              maxWidth: '680px',
              marginBottom: '16px'
            }}>
              <Info size={16} style={{ color: currentSlide.accentColor, flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ fontWeight: 700 }}>How to Navigate: </strong>
                {currentSlide.navGuide}
              </div>
            </div>

            {/* Feature Checklist Tags */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginBottom: '18px'
            }}>
              {currentSlide.features.map((feat, idx) => (
                <div 
                  key={idx}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    backgroundColor: 'var(--bg-card)',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <CheckCircle2 size={13} style={{ color: currentSlide.accentColor }} />
                  <span>{feat}</span>
                </div>
              ))}
            </div>

            {/* Action CTA Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  try {
                    localStorage.setItem('researchvault_has_seen_onboarding', 'true');
                  } catch (e) {}
                  if (currentSlide.actionTab === 'addModal') {
                    if (onOpenAddModal) onOpenAddModal();
                  } else if (onNavigate) {
                    onNavigate(currentSlide.actionTab);
                  }
                }}
                className="btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 20px',
                  borderRadius: '14px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  backgroundColor: currentSlide.accentColor,
                  borderColor: currentSlide.accentColor,
                  color: '#ffffff',
                  boxShadow: `0 4px 16px ${currentSlide.accentColor}40`,
                  cursor: 'pointer'
                }}
              >
                <span>{currentSlide.actionText}</span>
                <ArrowRight size={16} />
              </button>

              {onClose && (
                <button
                  onClick={() => {
                    try {
                      localStorage.setItem('researchvault_has_seen_onboarding', 'true');
                    } catch (e) {}
                    onClose();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 18px',
                    borderRadius: '14px',
                    fontSize: '0.86rem',
                    fontWeight: 700,
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  <span>Got It! Start Using App</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Icon Illustration (Desktop) */}
          <div 
            className="mobile-hide"
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--card-shadow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: currentSlide.accentColor,
              flexShrink: 0
            }}
          >
            <SlideIcon size={48} style={{ strokeWidth: 1.8 }} />
          </div>
        </div>

        {/* Bottom Controls Row: Arrows & Dots Bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(0, 0, 0, 0.06)'
        }}>
          {/* Previous / Next Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handlePrev}
              aria-label="Previous Slide"
              title="Previous Slide (← Left Arrow)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              aria-label="Next Slide"
              title="Next Slide (→ Right Arrow)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)'
              }}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Dot Pills Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {slides.map((slide, index) => {
              const isActive = index === currentIndex;
              return (
                <button
                  key={slide.id}
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Go to slide ${index + 1}: ${slide.title}`}
                  title={slide.title}
                  style={{
                    height: '8px',
                    width: isActive ? '28px' : '8px',
                    borderRadius: '4px',
                    backgroundColor: isActive ? slide.accentColor : 'var(--border-color)',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
