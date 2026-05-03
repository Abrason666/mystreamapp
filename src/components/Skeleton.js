import React from 'react';
import './Skeleton.css';

export function SkeletonHero() {
  return (
    <div className="skeleton skeleton-hero">
      <div className="skeleton-hero-content">
        <div className="skeleton skeleton-hero-title" />
        <div className="skeleton skeleton-hero-meta" />
        <div className="skeleton skeleton-hero-desc" />
        <div className="skeleton skeleton-hero-desc" />
        <div className="skeleton-hero-buttons">
          <div className="skeleton skeleton-hero-btn" />
          <div className="skeleton skeleton-hero-btn" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonCarousel() {
  return (
    <div className="skeleton-carousel">
      <div className="skeleton skeleton-carousel-title" />
      <div className="skeleton-carousel-items">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton skeleton-poster" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 12 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton skeleton-grid-card" />
      ))}
    </div>
  );
}

export function SkeletonDetail() {
  return (
    <div className="skeleton-detail">
      <div className="skeleton skeleton-detail-hero" />
      <div className="skeleton-detail-body">
        <div className="skeleton skeleton-detail-title" />
        <div className="skeleton skeleton-detail-meta" />
        <div className="skeleton skeleton-detail-line" />
        <div className="skeleton skeleton-detail-line" />
        <div className="skeleton skeleton-detail-line short" />
        <div className="skeleton-detail-buttons">
          <div className="skeleton skeleton-detail-btn" />
          <div className="skeleton skeleton-detail-btn" />
        </div>
      </div>
    </div>
  );
}
