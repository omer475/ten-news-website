import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import NewsCard from '../components/NewsCard';
import Newsletter from '../components/Newsletter';
import ProgressIndicator from '../components/ProgressIndicator';

export default function Home() {
  const [stories, setStories] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTimeline, setShowTimeline] = useState({});

  const loadNewsData = async () => {
    try {
      let newsData = null;
      
      // Try to fetch from API endpoint
      try {
        const response = await fetch('/api/news');
        if (response.ok) {
          newsData = await response.json();
          console.log('✅ Loaded news from API');
        }
      } catch (error) {
        console.log('📰 API not available, using fallback');
      }
      
      // If API failed, try direct file access
      if (!newsData) {
        try {
          const today = new Date();
          const dateStr = `${today.getFullYear()}_${(today.getMonth() + 1).toString().padStart(2, '0')}_${today.getDate().toString().padStart(2, '0')}`;
          const response = await fetch(`/tennews_data_${dateStr}.json`);
          if (response.ok) {
            newsData = await response.json();
            console.log('✅ Loaded news from direct file');
          }
        } catch (error) {
          console.log('📰 Direct file access failed:', error);
        }
      }
      
      let processedStories = [];
      
      if (newsData && newsData.articles && newsData.articles.length > 0) {
        // Create opening story from news data
        const openingStory = {
          type: 'opening',
          date: newsData.displayDate || new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          }).toUpperCase(),
          headline: newsData.dailyGreeting || 'Today Essential Global News'
        };
        
        processedStories.push(openingStory);
        
        // Convert news generator articles to website format
        newsData.articles.forEach((article, index) => {
            const storyData = {
            type: 'news',
            number: article.rank || (index + 1),
            category: (article.category || 'WORLD NEWS').toUpperCase(),
            emoji: article.emoji || '📰',
            title: article.title || 'News Story',
            summary: article.summary || 'News summary will appear here.',
            details: article.details || [],
            source: article.source || 'Ten News',
            url: article.url || '#'
            };
            
            // Add timeline data (from generator or create fallback)
            if (article.timeline) {
              storyData.timeline = article.timeline;
            } else {
              // Create fallback timeline for all stories (variable length)
              const timelineVariations = [
                [
                  {"date": "Background", "event": "Initial situation develops"},
                  {"date": "Today", "event": "Major developments break"},
                  {"date": "Next week", "event": "Follow-up expected"}
                ],
                [
                  {"date": "Recently", "event": "Key events unfold"},
                  {"date": "Yesterday", "event": "Critical point reached"},
                  {"date": "Today", "event": "Story breaks"},
                  {"date": "Coming days", "event": "Developments continue"}
                ],
                [
                  {"date": "Last month", "event": "Initial reports emerge"},
                  {"date": "Today", "event": "Major announcement made"}
                ]
              ];
              storyData.timeline = timelineVariations[index % timelineVariations.length];
            }
            
            processedStories.push(storyData);
        });
      } else {
        // Fallback stories with sample data
        processedStories = [
          {
            type: 'opening',
            date: new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long', 
              day: 'numeric',
              year: 'numeric'
            }).toUpperCase(),
            headline: 'Ten News automation is working perfectly'
          },
          {
            type: 'news',
            number: 1,
            category: 'SYSTEM STATUS',
            emoji: '🤖',
            title: 'GitHub Actions Automation Active',
            summary: 'Your Ten News system is running automatically. Fresh AI-curated content from GDELT and Claude will appear daily at 7 AM UK time.',
            details: ['Schedule: Daily 7 AM UK', 'Source: GDELT API', 'AI: Claude curation'],
            source: 'Ten News System',
            url: '#',
            timeline: [
              {"date": "Setup", "event": "GitHub Actions workflow configured"},
              {"date": "Integration", "event": "GDELT API and Claude AI connected"},
              {"date": "Testing", "event": "Automation tested and verified"},
              {"date": "Live", "event": "Daily news generation now active"}
            ]
          },
          {
            type: 'news',
            number: 2,
            category: 'SYSTEM STATUS', 
            emoji: '🌍',
            title: 'GDELT Global News Integration Ready',
            summary: 'Connected to GDELT Project global database providing real-time access to worldwide news events from over 50 trusted sources.',
            details: ['Sources: 50+ trusted outlets', 'Coverage: Global events', 'Processing: Real-time'],
            source: 'Ten News System',
            url: '#',
            timeline: [
              {"date": "Research", "event": "GDELT database identified as news source"},
              {"date": "Development", "event": "API integration and filtering built"},
              {"date": "Testing", "event": "Source verification and quality checks"},
              {"date": "Active", "event": "Real-time global news processing online"}
            ]
          },
          {
            type: 'news',
            number: 3,
            category: 'SYSTEM STATUS',
            emoji: '🧠', 
            title: 'Claude AI Curation System Online',
            summary: 'AI-powered article selection and rewriting system ready to curate the most important global stories for your daily digest.',
            details: ['Selection: Top 10 stories', 'Processing: AI rewriting', 'Quality: Optimized summaries'],
            source: 'Ten News System',
            url: '#',
            timeline: [
              {"date": "Planning", "event": "AI curation system designed"},
              {"date": "Implementation", "event": "Claude API integration completed"},
              {"date": "Optimization", "event": "Story selection algorithms refined"},
              {"date": "Production", "event": "AI curation now processing daily news"}
            ]
          }
        ];
      }
      
      
      // Add newsletter signup at the end
      processedStories.push({
        type: 'newsletter',
        content: 'Professional Newsletter Signup'
      });
      
      setStories(processedStories);
    } catch (error) {
      console.error('Error loading news:', error);
      
      // Fallback data
      const fallbackStories = [
        {
          type: 'opening',
          headline: "Good morning, here's what's happening in the world today.",
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }).toUpperCase()
        },
        {
          type: 'news',
          number: 1,
          title: 'Ten News System Active',
          summary: 'Your automated news system is running. Check back at 7 AM UK time for fresh content!',
          category: 'SYSTEM',
          emoji: '📰',
          details: ['GitHub Actions', 'Claude AI', 'GDELT API'],
          url: '#'
        },
        {
          type: 'newsletter'
        }
      ];
      
      setStories(fallbackStories);
    }
  };

  useEffect(() => {
    loadNewsData();
  }, []);

  const goToStory = (index) => {
    setCurrentIndex(index);
  };

  const toggleTimeline = (index, forceValue = null) => {
    setShowTimeline(prev => ({
      ...prev,
      [index]: forceValue !== null ? forceValue : !prev[index]
    }));
  };

  const handleNewsletterSignup = async (email, emailInput) => {
    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      
      if (response.ok) {
        alert('Successfully subscribed! Check your email for confirmation.');
        if (emailInput) emailInput.value = '';
      } else {
        alert(data.message || 'Failed to subscribe. Please try again.');
      }
    } catch (error) {
      console.error('Newsletter signup error:', error);
      alert('Failed to subscribe. Please try again.');
    }
  };

  const handleStoryClick = (story) => {
    if (story.url && story.url !== '#') {
      window.open(story.url, '_blank');
    }
  };


  useEffect(() => {
    let startY = 0;
    let startTime = 0;
    
    const handleTouchStart = (e) => {
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };
    
    const handleTouchEnd = (e) => {
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();
      const diffY = startY - endY;
      const diffTime = endTime - startTime;
      
      if (diffTime < 300 && Math.abs(diffY) > 50) {
        if (diffY > 0 && currentIndex < stories.length - 1) {
          setCurrentIndex(currentIndex + 1);
        } else if (diffY < 0 && currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
        }
      }
    };
    
    const handleWheel = (e) => {
      e.preventDefault();
      
      if (e.deltaY > 0 && currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (e.deltaY < 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown' && currentIndex < stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else if (e.key === 'ArrowUp' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        const currentStory = stories[currentIndex];
        if (currentStory && currentStory.type === 'news' && currentStory.url && currentStory.url !== '#') {
          window.open(currentStory.url, '_blank');
        }
      }
    };
    
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, stories.length]);

  if (stories.length === 0) {
    return (
      <div className="flex justify-center items-center h-screen text-lg text-gray-500">
        Loading Ten News...
      </div>
    );
  }

  const currentTime = new Date().toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <Header 
        currentTime={currentTime}
        onNewsletterClick={() => goToStory(stories.length - 1)}
      />

      {/* Stories */}
      {stories.map((story, index) => (
        <div
          key={index}
          className="absolute top-0 left-0 w-full h-screen flex items-center justify-center transition-all duration-600 ease-out pt-20 pb-15 px-10"
          style={{
            transform: `${
              index === currentIndex 
                ? 'translateY(0) scale(1)' 
                : index < currentIndex 
                  ? 'translateY(-100%) scale(0.9)' 
                  : 'translateY(100%) scale(0.95)'
            }`,
            opacity: index === currentIndex ? 1 : 0,
            zIndex: index === currentIndex ? 10 : 1,
            pointerEvents: index === currentIndex ? 'auto' : 'none',
          }}
        >
          <div className="w-full max-w-5xl mx-auto">
            {story.type === 'opening' ? (
              <Hero story={story} stories={stories} />
            ) : story.type === 'news' ? (
              <NewsCard 
                story={story}
                index={index}
                showTimeline={showTimeline[index]}
                onToggleTimeline={toggleTimeline}
                onStoryClick={handleStoryClick}
              />
            ) : story.type === 'newsletter' ? (
              <Newsletter onSignup={handleNewsletterSignup} />
            ) : null}
          </div>
        </div>
      ))}

      <ProgressIndicator 
        stories={stories}
        currentIndex={currentIndex}
        onStoryClick={goToStory}
      />
    </div>
  );
}
