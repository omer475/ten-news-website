import React from 'react';
import { ChevronRight, Clock, TrendingUp } from 'lucide-react';

export default function NewFirstPage({ onContinue }) {
  const scrollRef = React.useRef(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [activeCategory, setActiveCategory] = React.useState('All');

  const categories = ['All', 'News', 'Exclusives', 'Guides', 'Recommended'];

  const todayInHistory = [
    { year: '1492', event: 'Christopher Columbus discovers America' },
    { year: '1968', event: 'Apollo 7 launched, first crewed Apollo mission' },
    { year: '2001', event: 'iPod was first introduced by Apple Inc.' }
  ];

  const trendingTopics = [
    { title: 'Climate Summit', articles: 234 },
    { title: 'Tech Innovation', articles: 189 },
    { title: 'Space Exploration', articles: 156 },
    { title: 'Global Economy', articles: 142 }
  ];

  React.useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const cardWidth = 256; // w-64 = 256px
    const gap = 8; // gap-2 = 8px
    const totalWidth = cardWidth + gap;

    const autoScroll = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % todayInHistory.length;
        scrollContainer.scrollTo({
          left: nextIndex * totalWidth,
          behavior: 'smooth'
        });
        return nextIndex;
      });
    }, 3000); // Scroll every 3 seconds

    return () => clearInterval(autoScroll);
  }, [todayInHistory.length]);

  // Handle manual scroll to update currentIndex
  React.useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const cardWidth = 256;
      const gap = 8;
      const totalWidth = cardWidth + gap;
      const scrollLeft = scrollContainer.scrollLeft;
      const newIndex = Math.round(scrollLeft / totalWidth);
      setCurrentIndex(newIndex);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto">
      {/* Header */}
      <header className="px-3 py-2.5 flex items-center justify-between bg-white border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xs">+</span>
          </div>
          <span className="font-bold">News+</span>
        </div>
        <button className="text-xs text-gray-600 px-2.5 py-1 border border-gray-200 rounded-lg">EN</button>
      </header>

      <div className="pb-16">
        {/* Category Navigation */}
        <div className="px-3 pt-3 pb-2 bg-white border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeCategory === cat
                    ? 'bg-red-100 text-red-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Hero CTA */}
        <div className="px-3 pt-3 pb-2">
          <div 
            className="relative rounded-xl overflow-hidden h-44 cursor-pointer group"
            onClick={onContinue}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-300 rounded-full blur-2xl"></div>
              </div>
            </div>
            
            <div className="relative h-full flex items-end justify-end p-4">
              <button className="bg-white/20 backdrop-blur-md text-white font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 text-sm border border-white/30 group-hover:bg-white/30 transition-all">
                Read 10 News for Today
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Today in History */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              Today in History
            </h3>
            <div className="flex gap-1">
              {todayInHistory.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    index === currentIndex ? 'bg-indigo-600 w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          
          <div 
            ref={scrollRef} 
            className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
          >
            {todayInHistory.map((item, index) => (
              <div key={index} className="flex-shrink-0 w-64 bg-white rounded-lg border border-gray-100 overflow-hidden snap-center">
                <div className="h-32 bg-gradient-to-br from-indigo-400 to-purple-500 p-3 flex flex-col justify-end">
                  <span className="inline-block text-white font-bold text-sm mb-1.5">{item.year}</span>
                  <p className="text-sm text-white leading-snug font-medium">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trending Topics */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Trending Topics
            </h3>
          </div>
          
          <div className="grid grid-cols-2 gap-1.5">
            {trendingTopics.map((topic, index) => (
              <div key={index} className="bg-white rounded-lg p-2.5 border border-gray-100">
                <h4 className="font-semibold text-xs text-gray-900 mb-0.5">{topic.title}</h4>
                <p className="text-xs text-gray-500">{topic.articles} articles</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 max-w-[430px] mx-auto">
        <div className="flex items-center justify-around">
          <button className="flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 bg-indigo-600 rounded-lg"></div>
            <span className="text-xs font-medium text-indigo-600">Home</span>
          </button>
          <button className="flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 bg-gray-300 rounded-lg"></div>
            <span className="text-xs text-gray-500">Explore</span>
          </button>
          <button className="flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 bg-gray-300 rounded-lg"></div>
            <span className="text-xs text-gray-500">Saved</span>
          </button>
          <button className="flex flex-col items-center gap-0.5">
            <div className="w-5 h-5 bg-gray-300 rounded-lg"></div>
            <span className="text-xs text-gray-500">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
