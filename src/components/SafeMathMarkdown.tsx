import React, { useEffect } from 'react';
import Latex from 'react-latex-next';

interface Props {
  content: string;
  className?: string;
}

/**
 * SafeMathMarkdown - Renders text content with LaTeX math support
 * 
 * Uses react-latex-next for math rendering, which is more stable than
 * the react-markdown + rehype-katex combination.
 * 
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 */
function SafeMathMarkdown({ content, className }: Props) {
  return (
    <div className={className}>
      <div className="whitespace-pre-wrap m-0">
        <Latex>{content}</Latex>
      </div>
    </div>
  );
}

export default SafeMathMarkdown;

