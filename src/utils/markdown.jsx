// Markdown parser utility
// Supports: **bold**, *italic*, `code`, ```code blocks```, [links](url)

export const parseMarkdown = (text) => {
  if (!text) return text;

  let parsed = text;

  // Escape HTML
  parsed = parsed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Code blocks (must be before inline code)
  parsed = parsed.replace(/```([^`]+)```/g, '<pre class="bg-dark-input text-dark-text p-2 rounded my-1 overflow-x-auto"><code>$1</code></pre>');

  // Inline code
  parsed = parsed.replace(/`([^`]+)`/g, '<code class="bg-dark-input text-dark-text px-1 py-0.5 rounded text-sm">$1</code>');

  // Bold
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold">$1</strong>');

  // Italic
  parsed = parsed.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Links
  parsed = parsed.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-primary hover:underline">$1</a>');

  // Mentions (@username and @everyone) - clickable without @ symbol
  parsed = parsed.replace(/@(everyone|[a-zA-Z0-9_]+)\b/g, '<span class="text-brand-primary font-medium cursor-pointer hover:underline" data-mention="$1">$1</span>');

  // Line breaks
  parsed = parsed.replace(/\n/g, '<br>');

  return parsed;
};

// React component wrapper for markdown
export const MarkdownText = ({ children, onMentionClick }) => {
  const html = parseMarkdown(children);
  
  const handleClick = (e) => {
    // Check if clicked element is a mention
    const mention = e.target.getAttribute('data-mention');
    if (mention && onMentionClick) {
      onMentionClick(mention);
    }
  };
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: html }}
      className="markdown-content"
      onClick={handleClick}
    />
  );
};
