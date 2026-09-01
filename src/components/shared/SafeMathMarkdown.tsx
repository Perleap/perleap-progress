import React, { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  className?: string;
}

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
const SafeMathMarkdown = ({ content, className }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const typesetMath = async () => {
      if (window.MathJax && window.MathJax.typesetPromise && containerRef.current) {
        try {
          if (window.MathJax.startup?.promise) {
            await window.MathJax.startup.promise;
          }
          await window.MathJax.typesetPromise([containerRef.current]);
        } catch (error) {
          console.warn('MathJax rendering error (non-critical):', error);
        }
      }
    };

    const timeoutId = setTimeout(typesetMath, 50);

    return () => clearTimeout(timeoutId);
  }, [content]);

  return (
    <div className={className} ref={containerRef}>
      <div className="markdown-content prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-100 dark:prose-pre:bg-slate-800 prose-headings:mb-2 prose-headings:mt-4 first:prose-headings:mt-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || ''}</ReactMarkdown>
      </div>
    </div>
  );
};

export default SafeMathMarkdown;
