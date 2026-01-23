import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
 * SafeMathMarkdown - Renders text content with Markdown and MathJax support
 * 
 * Uses react-markdown for basic formatting and MathJax from CDN (loaded in index.html)
 * for stable LaTeX rendering.
 * 
 * Supports:
 * - Markdown: Bold (**), Italic (*), Lists, Headlines (#), etc.
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
    const timeoutId = setTimeout(typesetMath, 50);
    
    return () => clearTimeout(timeoutId);
  }, [content]); // Re-run when content changes

  return (
    <div className={className} ref={containerRef}>
      <div className="markdown-content prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content || ''}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default SafeMathMarkdown;

