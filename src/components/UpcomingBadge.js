import React from 'react';
import './UpcomingBadge.css';

function UpcomingBadge({ releaseDate, firstAirDate }) {
  // Determina la data di uscita
  const date = new Date(releaseDate || firstAirDate);
  const today = new Date();
  const isUpcoming = date > today;
  
  // Se non è in arrivo, non mostrare nulla
  if (!isUpcoming || (!releaseDate && !firstAirDate)) {
    return null;
  }
  
  return (
    <div className="upcoming-badge">
      <span className="badge-icon">📅</span>
      <span className="badge-text">In arrivo</span>
    </div>
  );
}

export default UpcomingBadge; // 👈 DEVE ESSERCI QUESTA RIGA