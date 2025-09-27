export default function Timeline({ timeline }) {
  if (!timeline || timeline.length === 0) return null;

  return (
    <div className="flex w-full h-28 overflow-hidden relative">
      <div className="relative pl-5 w-full h-full overflow-y-auto overflow-x-hidden pr-2.5">
        <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary-600 to-gray-200 z-0" />
        
        {timeline.map((event, idx) => (
          <div 
            key={idx} 
            className="relative mb-2.5 pl-5 min-h-[35px] opacity-0 animate-timeline-slide"
            style={{ animationDelay: `${idx * 0.1}s` }}
          >
            <div 
              className={`absolute -left-3.5 top-1.5 w-3 h-3 rounded-full border-2 border-primary-600 z-10 ${
                idx === timeline.length - 1 ? 'bg-primary-600' : 'bg-white'
              }`}
            />
            
            <div className="text-xs font-semibold text-primary-600 mb-1">
              {event.date}
            </div>
            <div className="text-sm text-gray-800 leading-snug">
              {event.event}
            </div>
          </div>
        ))}
        
        {timeline.length > 3 && (
          <div className="sticky bottom-0 text-center text-xs text-gray-400 bg-gradient-to-t from-white pt-2 pb-1 font-medium uppercase tracking-wide">
            ↓ Scroll for More ↓
          </div>
        )}
      </div>
    </div>
  );
}
