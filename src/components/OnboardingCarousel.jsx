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
  Info,
  PlusCircle,
  Layers
} from 'lucide-react';

export default function OnboardingCarousel({ onNavigate, onOpenAddModal, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [slideDuration, setSlideDuration] = useState(10);
  const touchStartX = useRef(null);

  const slides = [
    {
      id: 'welcome',
      badge: 'Getting Started',
      badgeIcon: Compass,
      title: 'Welcome to ResearchVault',
      subtitle: 'Your Smart AI-Powered Academic Workspace',
      description: 'ResearchVault centralizes your scholarly workflow: discover open-access research, organize custom paper libraries, read documents offline, run AI comparative synthesis, export citations, and sync seamlessly across devices.',
      navGuide: 'Use the Sidebar on desktop or the Bottom Navigation bar on mobile to switch between features. The top navbar provides quick access to search, themes, cloud sync, and profile settings.',
      actionText: 'Explore App Features',
      actionTab: 'home',
      accentColor: 'var(--primary)',
      icon: BookOpen,
      features: [
        'Centralized Literature Management',
        'Distraction-Free PDF Document Reader',
        'Multi-Paper AI Literature Synthesis',
        'Cross-Device Cloud Vault Sync'
      ]
    },
    {
      id: 'search',
      badge: 'Discovery & Search',
      badgeIcon: Search,
      title: 'Global Academic Search',
      subtitle: 'Query 200M+ Papers via OpenAlex, arXiv & CrossRef',
      description: 'Discover literature from OpenAlex, arXiv, and CrossRef directly by topic, author name, or DOI string. Filter results by publication year, citations, and open-access status, then import papers into your library in one click.',
      navGuide: 'Click "Academic Search" in the sidebar or mobile menu, or type in the top search bar anytime to search literature. Click the "+" button on any search result card to import it directly.',
      actionText: 'Try Academic Search',
      actionTab: 'search',
      accentColor: '#10b981',
      icon: Search,
      features: [
        'Search OpenAlex, arXiv & CrossRef',
        'Filter by Year, Citations & Open Access',
        'Direct PDF & Publisher DOI Resolution',
        '1-Click Library Import with Metadata'
      ]
    },
    {
      id: 'add',
      badge: 'Adding Literature',
      badgeIcon: PlusCircle,
      title: 'Add Papers by DOI, URL, or PDF Upload',
      subtitle: 'Flexible Ingestion with Offline Document Storage',
      description: 'Add literature to your library in seconds: enter a DOI or paper URL for automatic metadata retrieval, upload your own local PDF files directly from your computer or phone, or enter citation details manually.',
      navGuide: 'Click the "+ Add Resource" button in the sidebar or mobile drawer anytime. Switch between DOI Auto-Fetch, Local PDF File Upload, or Manual Entry tabs.',
      actionText: 'Add a Paper Now',
      actionTab: 'addModal',
      accentColor: '#06b6d4',
      icon: PlusCircle,
      features: [
        'Auto-Fetch Metadata from DOI or URL',
        'Direct Local PDF Upload & Caching',
        'Magic-Byte Verified Document Ingestion',
        'Manual Entry for Books & Theses'
      ]
    },
    {
      id: 'library',
      badge: 'Library & Organization',
      badgeIcon: Library,
      title: 'My Library, Categories & Reading Progress',
      subtitle: 'Folder Hierarchies, Tags & Progress Percentage',
      description: 'Structure your research into custom topic folders and category trees. Tag papers by methodology, star favorites, and track reading status (Unread, Reading, Completed) with individual progress percentages.',
      navGuide: 'Navigate to "My Library" to browse and filter saved papers, or go to "Categories & Folders" to manage research hierarchies and organize papers by research topic.',
      actionText: 'Open My Library',
      actionTab: 'library',
      accentColor: '#f59e0b',
      icon: Library,
      features: [
        'Custom Folder & Category Trees',
        'Multi-Tag Filtering & Starred Favorites',
        'Reading Status & Progress Tracking (%)',
        'Instant Library Search & Sorting'
      ]
    },
    {
      id: 'reader',
      badge: 'Document Reader',
      badgeIcon: FileText,
      title: 'Distraction-Free PDF Reader & In-Doc AI',
      subtitle: 'Read Offline, Annotate & Query Papers Directly',
      description: 'Read PDFs and academic papers in a clean, distraction-free viewer with zoom controls, fullscreen mode, and reading themes. Use the embedded In-Reader AI assistant to summarize sections or explain complex math and methods on the fly.',
      navGuide: 'Click the "Read" button on any paper card in your library to launch the viewer. Open the "AI Assistant" sidebar inside the reader to interrogate the active document.',
      actionText: 'View Library Documents',
      actionTab: 'library',
      accentColor: '#8b5cf6',
      icon: FileText,
      features: [
        'Full-Featured PDF Viewer with Zoom & Fullscreen',
        'Embedded In-Reader AI Copilot',
        'Section Summaries & Concept Explanations',
        'Reading Progress Autosave'
      ]
    },
    {
      id: 'synthesis',
      badge: 'AI Literature Review',
      badgeIcon: Sparkles,
      title: 'AI Literature Review & Synthesis Matrix',
      subtitle: 'Compare Methodologies, Findings & Research Gaps',
      description: 'Select multiple papers from your library to generate side-by-side comparative matrices. Gemini AI synthesizes core findings, compares study populations, extracts methodologies, identifies contradictions, and highlights unanswered research gaps.',
      navGuide: 'Click "AI Literature Review" in the sidebar or mobile menu. Select two or more papers using the checkboxes, choose your synthesis focus, and click "Generate Review Matrix".',
      actionText: 'Launch AI Synthesis',
      actionTab: 'synthesis',
      accentColor: '#a855f7',
      icon: Sparkles,
      features: [
        'Cross-Paper Comparative Analysis Grid',
        'Methodology & Sample Size Comparison',
        'Research Gaps & Future Directions Extraction',
        'Export Matrix to Markdown or Formatted PDF'
      ]
    },
    {
      id: 'aichat',
      badge: 'AI Research Assistant',
      badgeIcon: MessageSquare,
      title: 'Conversational Research Assistant & Brainstorming',
      subtitle: 'Academic Q&A with Pre-Built Research Prompts',
      description: 'Engage with a specialized academic AI assistant powered by Gemini. Brainstorm hypotheses, critique argumentation, draft thesis statements, or interrogate literature with prompt templates designed specifically for researchers.',
      navGuide: 'Click "AI Chat Assistant" in the menu. Use the prompt shortcut chips above the input box (e.g., "Explain Methodology", "Find Research Gaps") for instant analysis.',
      actionText: 'Chat with AI Assistant',
      actionTab: 'aichat',
      accentColor: '#3b82f6',
      icon: MessageSquare,
      features: [
        'Context-Aware Academic Dialogue',
        'Pre-Built Research Prompt Shortcuts',
        'Hypothesis & Argument Critique',
        'Safe Markdown Output with Math & Tables'
      ]
    },
    {
      id: 'notes',
      badge: 'Citations & Notes',
      badgeIcon: Quote,
      title: 'Instant Multi-Format Citations & Research Notes',
      subtitle: '1-Click APA 7, BibTeX & Paper-Linked Notes',
      description: 'Generate accurate citations in APA 7th, MLA 9th, Chicago, Harvard, IEEE, or BibTeX format in a single click. Maintain structured research notes with rich text and Markdown, linked directly to papers in your library.',
      navGuide: 'Click the quote icon (" ") on any paper card for instant citations. Click "Research Notes" in the sidebar to create, edit, and organize notes linked to your literature.',
      actionText: 'Manage Research Notes',
      actionTab: 'notes',
      accentColor: '#ec4899',
      icon: Quote,
      features: [
        'APA 7, BibTeX, IEEE, MLA & Chicago Citations',
        '1-Click Copy to Clipboard & LaTeX .bib',
        'Markdown & Rich Text Note Editor',
        'Notes Linked Directly to Library Papers'
      ]
    },
    {
      id: 'profile',
      badge: 'Cloud Sync & Customization',
      badgeIcon: Cloud,
      title: 'Multi-Device Cloud Sync, Themes & PWA App',
      subtitle: 'Supabase Sync, Offline Reading & Full Backups',
      description: 'Sign in to sync your library and notes seamlessly across phone, tablet, and desktop via Supabase. Install the PWA for offline reading, switch between 4 curated visual themes, and export or restore complete JSON backups.',
      navGuide: 'Go to "Profile & Settings" to log in, trigger cloud sync, or export backups. Switch themes via the palette button in the top navbar, or click "Install App" to add to your home screen.',
      actionText: 'Profile & Settings',
      actionTab: 'profile',
      accentColor: '#22c55e',
      icon: Cloud,
      features: [
        'Automatic Multi-Device Supabase Sync',
        '4 Reading Themes (Sepia, Emerald, Blue, Dark)',
        'Offline PWA Installation (Desktop & Mobile)',
        'Complete JSON Library Backup Export & Restore'
      ]
    }
  ];

  const totalSlides = slides.length;

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
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
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
        type="button"
        onClick={handlePrev}
        className="carousel-side-arrow"
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
        type="button"
        onClick={handleNext}
        className="carousel-side-arrow"
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

      {/* Dynamic Animated Progress Bar (Auto-Slide Timer) */}
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

      {/* Main Slide Card Container - Clean Solid Background (No Gradients) */}
      <div 
        className="onboarding-slide-card"
        style={{
          padding: '28px 32px',
          backgroundColor: 'var(--bg-card)',
          minHeight: '280px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative'
        }}
      >
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
                backgroundColor: 'var(--bg-main)',
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
            {/* Auto-Slide Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? `Pause ${slideDuration}s Auto-slide` : `Play ${slideDuration}s Auto-slide`}
              aria-label={isPlaying ? `Pause automatic slideshow (currently advancing every ${slideDuration} seconds)` : 'Resume automatic slideshow'}
              aria-pressed={!isPlaying}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
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
                type="button"
                onClick={onClose}
                title="Dismiss Guide Carousel"
                aria-label="Dismiss the app guide"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
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

            {/* Navigation Tip Callout Box - Solid Clean Styling */}
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-main)',
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

            {/* Feature Checklist Tags - Solid Clean Styling */}
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
                    backgroundColor: 'var(--bg-main)',
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

            {/* Action CTA Buttons - Clean Solid Styling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
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
                  boxShadow: 'none',
                  cursor: 'pointer'
                }}
              >
                <span>{currentSlide.actionText}</span>
                <ArrowRight size={16} />
              </button>

              {onClose && (
                <button
                  type="button"
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
                    backgroundColor: 'var(--bg-main)',
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
              backgroundColor: 'var(--bg-main)',
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
          borderTop: '1px solid var(--border-color)'
        }}>
          {/* Previous / Next Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
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
                backgroundColor: 'var(--bg-main)',
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
              type="button"
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
                backgroundColor: 'var(--bg-main)',
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
                  type="button"
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
