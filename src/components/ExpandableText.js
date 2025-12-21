import React, { useState } from 'react';
import './ExpandableText.css';

function ExpandableText({ 
  text, 
  maxLength = 120, 
  className = '', 
  expandText = 'Continua a leggere', 
  collapseText = 'Riduci' 
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Se il testo è più corto del limite, mostralo intero
  if (!text || text.length <= maxLength) {
    return (
      <p className={`expandable-text ${className}`}>
        {text || 'Nessuna descrizione disponibile.'}
      </p>
    );
  }

  const toggleExpanded = (e) => {
    e.stopPropagation(); // Previene il click sul parent
    setIsExpanded(!isExpanded);
  };

  return (
    <p className={`expandable-text ${className}`}>
      {isExpanded ? (
        <>
          {text}
          <span 
            className="expand-toggle-inline" 
            onClick={toggleExpanded}
          >
            <strong> {collapseText}</strong>
          </span>
        </>
      ) : (
        <>
          {text.substring(0, maxLength)}
          <span 
            className="expand-toggle-inline" 
            onClick={toggleExpanded}
          >
            ... <strong>{expandText}</strong>
          </span>
        </>
      )}
    </p>
  );
}

export default ExpandableText;