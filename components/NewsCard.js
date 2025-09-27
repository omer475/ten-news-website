import { useState } from 'react';
import Timeline from './Timeline';

export default function NewsCard({ story, index, showTimeline, onToggleTimeline, onStoryClick }) {
  const categoryStyles = {
    'WORLD NEWS': { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' },
    'BUSINESS': { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
    'MARKETS': { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200' },
    'TECH & AI': { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
    'SCIENCE': { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
    'HEALTH': { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    'CLIMATE': { bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
    'SPORTS': { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    'ENTERTAINMENT': { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' }
  };

  const categoryStyle = categoryStyles[story.category] || { 
    bg: 'bg-gray-50', 
    text: 'text-gray-600', 
    border: 'border-gray-200' 
  };

  const renderBoldText = (text, category) => {
    if (!text) return '';
    
    return text.split(/(\*\*.*?\*\*)/).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong 
            key={index} 
            className={`${categoryStyle.bg} ${categoryStyle.text} px-1.5 py-0.5 rounded text-sm`}
          >
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;
    let hasMoved = false;
    let swipeDirection = null;
    
    const handleTouchMove = (moveEvent) => {
      const currentX = moveEvent.touches[0].clientX;
      const currentY = moveEvent.touches[0].clientY;
      const diffX = Math.abs(startX - currentX);
      const diffY = Math.abs(startY - currentY);
      
      if (diffX > 15 || diffY > 15) {
        hasMoved = true;
        
        if (diffX > diffY && diffX > 30) {
          swipeDirection = 'horizontal';
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
        } else if (diffY > diffX && diffY > 30) {
          swipeDirection = 'vertical';
        }
      }
    };
    
    const handleTouchEnd = (endEvent) => {
      const endX = endEvent.changedTouches[0].clientX;
      const diffX = startX - endX;
      
      if (hasMoved && swipeDirection === 'horizontal' && Math.abs(diffX) > 25) {
        endEvent.preventDefault();
        endEvent.stopPropagation();
        onToggleTimeline(index);
      } else if (!hasMoved) {
        endEvent.preventDefault();
        endEvent.stopPropagation();
        onToggleTimeline(index);
      }
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {story.number === 1 && (
        <div className="text-center py-8 mb-6 relative">
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-0.5 bg-gradient-to-r from-orange-500 to-cyan-500" />
        </div>
      )}
      
      <article 
        className={`block p-6 border-b border-gray-200 cursor-pointer transition-all rounded-lg relative mx-auto max-w-4xl hover:bg-gradient-to-r hover:from-primary-50/30 hover:to-transparent ${story.number === 1 ? '-mt-10' : ''}`}
        onClick={() => onStoryClick(story)}
      >
        <div className="max-w-3xl mx-auto text-left">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide uppercase mb-3 transition-transform cursor-pointer hover:scale-105 ${categoryStyle.bg} ${categoryStyle.text} ${categoryStyle.border} border`}>
            <span className="text-sm">{story.emoji}</span>
            {story.category}
          </div>
          
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-5 text-black">
            {story.title}
          </h3>
          
          <p className="text-lg text-gray-700 leading-relaxed mb-4 text-left">
            {renderBoldText(story.summary, story.category)}
          </p>
          
          {story.timeline && (
            <div className="flex justify-end mb-4 mt-3">
              <div className="flex bg-gray-100 border border-gray-200 rounded-full p-0.5 shadow-sm backdrop-blur-sm w-28">
                <button
                  className={`flex items-center justify-center px-5 py-1.5 rounded-2xl transition-all ${!showTimeline ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showTimeline) {
                      onToggleTimeline(index, false);
                    }
                  }}
                  aria-label="Show details"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" fill={!showTimeline ? '#3b82f6' : '#94a3b8'} rx="1"/>
                    <rect x="14" y="3" width="7" height="7" fill={!showTimeline ? '#3b82f6' : '#94a3b8'} rx="1"/>
                    <rect x="3" y="14" width="7" height="7" fill={!showTimeline ? '#3b82f6' : '#94a3b8'} rx="1"/>
                    <rect x="14" y="14" width="7" height="7" fill={!showTimeline ? '#3b82f6' : '#94a3b8'} rx="1"/>
                  </svg>
                </button>
                
                <button
                  className={`flex items-center justify-center px-5 py-1.5 rounded-2xl transition-all ${showTimeline ? 'bg-white shadow-sm' : 'bg-transparent'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showTimeline) {
                      onToggleTimeline(index, true);
                    }
                  }}
                  aria-label="Show timeline"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="4" cy="4" r="2" fill={showTimeline ? '#8b5cf6' : '#94a3b8'}/>
                    <circle cx="4" cy="12" r="2" fill={showTimeline ? '#8b5cf6' : '#94a3b8'}/>
                    <circle cx="4" cy="20" r="2" fill={showTimeline ? '#8b5cf6' : '#94a3b8'}/>
                    <line x1="6" y1="4" x2="20" y2="4" stroke={showTimeline ? '#8b5cf6' : '#94a3b8'} strokeWidth="1.5"/>
                    <line x1="6" y1="12" x2="20" y2="12" stroke={showTimeline ? '#8b5cf6' : '#94a3b8'}/>
                    <line x1="6" y1="20" x2="20" y2="20" stroke={showTimeline ? '#8b5cf6' : '#94a3b8'}/>
                  </svg>
                </button>
              </div>
            </div>
          )}
          
          <div 
            className="relative overflow-visible cursor-pointer min-h-[90px] bg-white rounded-2xl p-5 mt-5 border border-gray-200 shadow-sm"
            onTouchStart={handleTouchStart}
          >
            {!showTimeline ? (
              story.details && story.details.map((detail, i) => {
                const [label, value] = detail.split(':');
                const cleanLabel = label?.trim() || '';
                const cleanValue = value?.trim() || '';
                
                const valueMatch = cleanValue.match(/^([^a-z]*[0-9][^a-z]*)\s*(.*)$/i);
                const mainValue = valueMatch ? valueMatch[1].trim() : cleanValue;
                const subtitle = valueMatch ? valueMatch[2].trim() : '';
                
                return (
                  <div key={i} className="flex-1 text-center px-4 border-r border-gray-200 last:border-r-0 flex flex-col justify-center min-h-[38px]">
                    <div className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">
                      {cleanLabel}
                    </div>
                    <div className="text-xl font-black text-gray-800 leading-tight">
                      {mainValue}
                    </div>
                    {subtitle && (
                      <div className="text-xs text-gray-500 font-medium">
                        {subtitle}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <Timeline timeline={story.timeline} />
            )}
            
            <button
              className="absolute left-2 top-1/2 transform -translate-y-1/2 text-xl text-primary-600 cursor-pointer opacity-70 z-10 hidden md:block hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTimeline(index);
              }}
              aria-label="Toggle view"
            >
              ←
            </button>
            
            <button
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xl text-primary-600 cursor-pointer opacity-70 z-10 hidden md:block hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTimeline(index);
              }}
              aria-label="Toggle view"
            >
              →
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
