import React, { useState } from 'react';
import PlaceholderImage from './PlaceholderImage';
import './SmartImage.css';

function SmartImage({ 
  src, 
  alt, 
  title = '',
  type = 'poster', // 'poster', 'backdrop', 'hero'
  className = '',
  style = {},
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setHasError(true);
    console.log(`🖼️ Immagine fallita, usando placeholder: ${src}`);
  };

  // Se non c'è src o c'è stato un errore, mostra placeholder
  if (!src || hasError) {
    return (
      <PlaceholderImage
        type={type}
        title={title || alt}
        className={`smart-image-placeholder ${className}`}
        style={style}
        {...props}
      />
    );
  }

  return (
    <div className={`smart-image-container ${className}`} style={style}>
      {isLoading && (
        <PlaceholderImage
          type={type}
          title={title || alt}
          className="smart-image-loading placeholder-loading"
        />
      )}
      <img
        src={src}
        alt={alt}
        onLoad={handleImageLoad}
        onError={handleImageError}
        className={`smart-image ${isLoading ? 'smart-image-hidden' : 'smart-image-visible'}`}
        {...props}
      />
    </div>
  );
}

export default SmartImage;