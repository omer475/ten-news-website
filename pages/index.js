import React, { useState, useEffect } from 'react';
import { Moon, Sun, Play, Users, CheckCircle, MessageCircle, Clock, Zap, TrendingUp, Sparkles, ChevronRight } from 'lucide-react';

export default function EnhancedNewsApp() {
  const [darkMode, setDarkMode] = useState(false);
  const [currentStory, setCurrentStory] = useState(0);
  const [readerCount, setReaderCount] = useState(2347);

  const [alertCount, setAlertCount] = useState(23);

  const stories = [
    {
      title: "Critical NATO-Russia tensions dominate today's headlines.",
      subtitle: "NATO Issues Stern Wa...",
      category: "World",
      readTime: "8 min",
      reactions: { worry: { emoji: '😟', count: 45 }, think: { emoji: '💭', count: 32 }, chart: { emoji: '📊', count: 23 } },
      discussing: 247,
      verified: true
    },
    {
      title: "Breakthrough in renewable energy: Solar efficiency hits 50%",
      subtitle: "Scientists Achieve Record...",
      category: "Tech",
      readTime: "5 min",
      reactions: { party: { emoji: '🎉', count: 67 }, bulb: { emoji: '💡', count: 54 }, star: { emoji: '🌟', count: 41 } },
      discussing: 189,
      verified: true
    },
    {
      title: "Global markets rally as inflation concerns ease worldwide",
      subtitle: "Major Indices Surge...",
      category: "Business",
      readTime: "6 min",
      reactions: { chart: { emoji: '📈', count: 38 }, money: { emoji: '💰', count: 29 }, thumbs: { emoji: '👍', count: 52 } },
      discussing: 156,
      verified: true
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setReaderCount(prev => prev + Math.floor(Math.random() * 10 - 3));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const bgColor = darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 via-purple-50 to-white';
  const textColor = darkMode ? 'text-white' : 'text-gray-900';
  const cardBg = darkMode ? 'bg-gray-800' : 'bg-white';

  return (
    <div className={`h-screen ${bgColor} ${textColor} transition-all duration-500 flex flex-col overflow-hidden`}>
      {/* Header - Compact */}
      <div className="flex-shrink-0 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">TEN NEWS</h1>
          <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full animate-pulse">LIVE</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-semibold">
            NEWSLETTER
          </button>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-1.5 rounded-full ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}
          >
            {darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Live Ticker - Compact */}
      <div className={`flex-shrink-0 ${darkMode ? 'bg-red-900/30' : 'bg-red-50'} border-l-4 border-red-500 px-5 py-2`}>
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-red-500 animate-pulse" />
          <span className="text-[11px] font-bold text-red-600">BREAKING:</span>
          <span className="text-[11px]">Markets respond • UN meets on conflicts</span>
        </div>
      </div>

      {/* Main Content Area - Scrollable within view */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Swipeable Categories */}
        <div className="mb-3 -mx-5 px-5">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {['🌍 World', '💼 Business', '⚡ Tech', '🏅 Sports', '🎬 Entertainment', '🔬 Science'].map((cat) => (
              <button
                key={cat}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap ${
                  darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-white hover:bg-gray-100 shadow-md'
                } transition-all`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Greeting Section */}
        <div className="text-center mb-4">
          <p className="text-red-500 font-semibold mb-2 text-xs tracking-wider">WEDNESDAY, SEPTEMBER 24, 2025</p>
          <h2 className="text-4xl font-bold mb-3">
            <span className="bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
              Goood evening!
            </span>
          </h2>
          <h3 className="text-xl font-bold mb-1 leading-tight px-2">{stories[currentStory].title}</h3>
          <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Today: <span className="text-red-500 font-semibold">{stories[currentStory].subtitle}</span>
          </p>
        </div>

        {/* Story Navigation Dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {stories.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStory(idx)}
              className={`h-1 rounded-full transition-all ${
                idx === currentStory ? 'w-6 bg-gradient-to-r from-blue-500 to-purple-500' : 'w-1 bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Today's Overview Card */}
        <div className={`${cardBg} rounded-2xl shadow-2xl p-4 mb-3 relative overflow-hidden`}>
          {/* Animated Background Effect */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-500/10 to-pink-500/10 rounded-full blur-3xl" />

          <div className="relative">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-bold">Today's Briefing</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-gray-500 font-semibold">Live</span>
              </div>
            </div>

            {/* What's Happening Today - Compact */}
            <div className={`${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'} rounded-xl p-2.5 mb-2`}>
              <h4 className="text-[9px] font-bold mb-1.5 opacity-75">WHAT'S HAPPENING</h4>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-red-500 rounded-full mt-1 flex-shrink-0 animate-pulse" />
                  <span className="text-[10px] leading-relaxed font-semibold">International tensions rise as NATO addresses security</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-green-500 rounded-full mt-1 flex-shrink-0" />
                  <span className="text-[10px] leading-relaxed font-semibold">Solar energy efficiency reaches record 50%</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-1 h-1 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                  <span className="text-[10px] leading-relaxed font-semibold">Global markets rally on positive outlook</span>
                </div>
              </div>
            </div>

            {/* Today in History */}
            <div className={`${darkMode ? 'bg-gray-700/30' : 'bg-gray-50'} rounded-xl p-2.5 mb-3`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-sm">📅</span>
                <h4 className="text-[9px] font-bold opacity-75">TODAY IN HISTORY</h4>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0">1789</span>
                  <span className="text-[10px] leading-relaxed font-semibold">US Congress proposes Bill of Rights</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0">1957</span>
                  <span className="text-[10px] leading-relaxed font-semibold">Nine students integrate Little Rock High School</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0">2001</span>
                  <span className="text-[10px] leading-relaxed font-semibold">Apple releases first iPod, revolutionizing music</span>
                </div>
              </div>
            </div>

            {/* Alerts Button */}
            <button
              className={`w-full py-3 rounded-xl font-bold text-sm ${
                darkMode ? 'bg-gradient-to-r from-blue-900 to-purple-900 hover:from-blue-800 hover:to-purple-800' : 'bg-gradient-to-r from-blue-100 to-purple-100 hover:from-blue-200 hover:to-purple-200'
              } transition-all flex items-center justify-center gap-2 relative overflow-hidden group`}
            >
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              <div className="relative flex items-center gap-2">
                <div className="relative">
                  <span className="text-xl">🔔</span>
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </div>
                <span>View {alertCount} New Alert{alertCount !== 1 ? 's' : ''}</span>
              </div>
            </button>
          </div>
        </div>

        {/* AI Briefing - Compact */}
        <div className={`${darkMode ? 'bg-gradient-to-r from-purple-900/60 to-blue-900/60' : 'bg-gradient-to-r from-purple-100 to-blue-100'} rounded-xl p-3 mb-3`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <h4 className="font-bold text-sm">AI Briefing</h4>
              </div>
              <p className="text-[10px] opacity-75">60-sec personalized summary</p>
            </div>
            <button className="bg-white text-purple-600 p-3 rounded-full shadow-lg">
              <Play className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Topic Pills - Compact */}
        <div className="mb-3">
          <h4 className="text-[10px] font-bold opacity-75 mb-2">EXPLORE TOPICS</h4>
          <div className="flex flex-wrap gap-1.5">
            {['Tech', 'Sports', 'Climate', 'Politics', 'Science', 'Culture'].map((topic) => (
              <button
                key={topic}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  darkMode ? 'bg-gray-700' : 'bg-white shadow-md'
                }`}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>

        {/* Live Counter */}
        <div className="flex items-center justify-center gap-2 py-2">
          <Users className="w-4 h-4 text-green-500" />
          <span className="text-xs font-semibold">
            <span className="text-green-500">{readerCount.toLocaleString()}</span> reading now
          </span>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        </div>

        <p className="text-center text-[10px] opacity-50 pb-2">SCROLL TO CONTINUE ↓</p>
      </div>
    </div>
  );
}
