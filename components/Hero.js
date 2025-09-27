import { useState, useEffect } from 'react';

export default function Hero({ story, stories }) {
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
  };

  const getGreetingText = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getGreetingGradient = () => {
    const t = getTimeOfDay();
    if (t === 'morning') return 'from-orange-500 to-yellow-400';
    if (t === 'afternoon') return 'from-blue-500 to-cyan-400';
    return 'from-indigo-600 to-purple-600';
  };

  const renderGreeting = (headline) => {
    const correctGreeting = getGreetingText();
    const gradientClass = getGreetingGradient();
    
    const greetingPatterns = ['good morning', 'good evening', 'good night', 'good afternoon'];
    const lowerHeadline = headline.toLowerCase();
    let foundGreeting = null;
    
    for (const pattern of greetingPatterns) {
      if (lowerHeadline.startsWith(pattern)) {
        foundGreeting = pattern;
        break;
      }
    }
    
    if (foundGreeting) {
      const restOfText = headline.substring(foundGreeting.length);
      return (
        <>
          <span className={`bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
            {correctGreeting}
          </span>
          <span className="text-gray-900">{restOfText}</span>
        </>
      );
    }
    return headline;
  };

  const categoryColors = {
    'WORLD NEWS': 'text-red-600',
    'BUSINESS': 'text-orange-500',
    'MARKETS': 'text-cyan-500',
    'TECH & AI': 'text-purple-500',
    'SCIENCE': 'text-blue-500',
    'HEALTH': 'text-emerald-500',
    'CLIMATE': 'text-green-500',
    'SPORTS': 'text-amber-500',
    'ENTERTAINMENT': 'text-pink-500'
  };

  const newsStories = stories.filter(s => s.type === 'news').slice(0, 5);

  return (
    <div className="text-center max-w-4xl mx-auto px-5 flex flex-col justify-center min-h-[calc(100vh-140px)]">
      <div className="text-xs font-semibold tracking-[2px] text-red-600 uppercase mb-10">
        {story.date}
      </div>
      
      <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-10 text-gray-900">
        {renderGreeting(story.headline)}
      </h1>
      
      <div className="text-lg sm:text-xl lg:text-2xl leading-relaxed mb-10 text-center">
        <div className="inline-block">
          <span className="font-semibold text-gray-600">Today: </span>
          <span className="relative inline-block min-w-[200px] h-7 align-middle">
            {newsStories.map((newsStory, i) => {
              const colorClass = categoryColors[newsStory.category] || 'text-primary-600';
              const shortTitle = newsStory.title.length > 20 
                ? newsStory.title.substring(0, 20) + '...' 
                : newsStory.title;
              
              return (
                <span
                  key={i}
                  className={`absolute left-0 whitespace-nowrap opacity-0 ${colorClass} font-bold transition-opacity duration-500 animate-topic-rotate`}
                  style={{
                    animationDelay: `${i * 3}s`,
                  }}
                >
                  {shortTitle}
                </span>
              );
            })}
          </span>
        </div>
      </div>
      
      <div className="flex justify-center items-center gap-5 mb-12 text-sm text-gray-600 font-medium tracking-wide uppercase">
        <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded border border-primary-200">
          10 Stories
        </span>
        <span className="text-gray-300">•</span>
        <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded border border-blue-200">
          2 Min Read
        </span>
      </div>
      
      <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 text-xs text-gray-400 uppercase tracking-[1.5px] font-semibold animate-gentle-bounce opacity-70">
        Scroll to Continue ↓
      </div>
    </div>
  );
}
