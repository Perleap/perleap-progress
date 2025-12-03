import React, { useEffect, useRef } from 'react';

interface Props {
  content: string;
  className?: string;
}

// Declare MathJax on window object
declare global {
  interface Window {
    MathJax?: {
      typesetPromise?: (elements?: HTMLElement[]) => Promise<void>;
      startup?: {
        promise?: Promise<void>;
      };
    };
  }
}

/**
 * SafeMathMarkdown - Renders text content with MathJax support
 * 
 * Uses MathJax from CDN (loaded in index.html) for stable LaTeX rendering
 * Automatically re-renders when content changes
 * 
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 */
function SafeMathMarkdown({ content, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger MathJax to render math in this component
    const typesetMath = async () => {
      if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
        try {
          // Wait for MathJax to be ready
          if (window.MathJax.startup?.promise) {
            await window.MathJax.startup.promise;
          }
          // Typeset the math in this container
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (error) {
          console.warn('MathJax rendering error (non-critical):', error);
          // Errors are non-critical - text will still display
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timeoutId = setTimeout(typesetMath, 10);
    
    return () => clearTimeout(timeoutId);
  }, [content]); // Re-run when content changes

  return (
    <div className={className} ref={containerRef}>
      <div className="whitespace-pre-wrap m-0">
        {content || ''}
      </div>
    </div>
  );
}

export default SafeMathMarkdown;

