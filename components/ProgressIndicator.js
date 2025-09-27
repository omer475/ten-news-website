export default function ProgressIndicator({ stories, currentIndex, onStoryClick }) {
  return (
    <div className="fixed right-6 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-50">
      {stories.map((_, index) => (
        <button
          key={index}
          className={`w-1.5 h-1.5 rounded-full cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
            index === currentIndex 
              ? 'w-1.5 h-5 rounded-sm bg-gradient-to-b from-gray-800 to-black' 
              : 'bg-gray-300 hover:bg-gray-400'
          }`}
          onClick={() => onStoryClick(index)}
          aria-label={`Go to story ${index + 1}`}
        />
      ))}
    </div>
  );
}
