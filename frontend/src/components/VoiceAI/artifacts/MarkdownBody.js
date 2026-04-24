// SPDX-License-Identifier: AGPL-3.0-only
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTheme } from '../../../contexts/ThemeContext';

/**
 * Compact markdown renderer for assistant messages.
 * Monochrome + indigo accent, tuned for the chat widget's density.
 */
const MarkdownBody = ({ children }) => {
  const { isDark } = useTheme();
  const muted = isDark ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className={`text-[13px] leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ node, ...props }) => <p className="my-1" {...props} />,
          a: ({ node, children, ...props }) => (
            <a className="text-[#5d6ad3] underline-offset-2 hover:underline"
              target="_blank" rel="noreferrer noopener" {...props}>{children}</a>
          ),
          ul: ({ node, ...props }) => <ul className="list-disc pl-5 my-1 space-y-0.5" {...props} />,
          ol: ({ node, ...props }) => <ol className="list-decimal pl-5 my-1 space-y-0.5" {...props} />,
          li: ({ node, ...props }) => <li {...props} />,
          h1: ({ node, children, ...props }) => <h3 className="font-semibold text-[14px] mt-2 mb-1" {...props}>{children}</h3>,
          h2: ({ node, children, ...props }) => <h4 className="font-semibold text-[13px] mt-2 mb-1" {...props}>{children}</h4>,
          h3: ({ node, children, ...props }) => <h5 className="font-semibold text-[13px] mt-1.5 mb-0.5" {...props}>{children}</h5>,
          hr: () => <hr className={`my-2 border-0 h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />,
          blockquote: ({ node, ...props }) => (
            <blockquote className={`border-l-2 pl-3 my-2 ${isDark ? 'border-white/10' : 'border-gray-300'} ${muted}`} {...props} />
          ),
          code: ({ node, inline, className, children, ...props }) => inline ? (
            <code className={`px-1 py-0.5 rounded text-[12px] font-mono ${isDark ? 'bg-white/5 text-gray-200' : 'bg-gray-100 text-gray-800'}`} {...props}>
              {children}
            </code>
          ) : (
            <pre className={`my-2 p-2 rounded-lg overflow-x-auto text-[12px] font-mono ${isDark ? 'bg-[#0f1012] text-gray-200' : 'bg-gray-100 text-gray-800'}`}>
              <code {...props}>{children}</code>
            </pre>
          ),
          table: ({ node, ...props }) => <table className={`my-2 text-[12px] border-collapse ${isDark ? 'text-gray-200' : 'text-gray-800'}`} {...props} />,
          th: ({ node, ...props }) => <th className={`text-left px-2 py-1 border-b font-medium ${isDark ? 'border-white/10' : 'border-gray-200'}`} {...props} />,
          td: ({ node, ...props }) => <td className={`px-2 py-1 border-b ${isDark ? 'border-white/5' : 'border-gray-100'}`} {...props} />,
          strong: ({ node, ...props }) => <strong className={isDark ? 'text-white' : 'text-gray-900'} {...props} />,
        }}
      >
        {children || ''}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownBody;
