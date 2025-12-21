import React from 'react';
import './PlaceholderImage.css';

function PlaceholderImage({ 
  type = 'poster', // 'poster', 'backdrop', 'hero'
  title = '',
  width = '100%',
  height = '100%',
  className = ''
}) {

  return (
    <div 
      className={`placeholder-image placeholder-${type} ${className}`}
      style={{ width, height }}
    >
      <div className="placeholder-content">
        <img 
          src="/images/cat-logo.png" 
          alt="CatStreamApp Logo" 
          className="cat-logo"
        />
        <div className="placeholder-text">
          <h3 className="placeholder-title">CatStreamApp</h3>
          {title && (
            <p className="placeholder-subtitle">{title}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlaceholderImage;