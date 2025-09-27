import { useState } from 'react';

export default function Header({ currentTime, onNewsletterClick }) {
  return (
    <header className="fixed top-0 left-0 right-0 h-15 bg-white/97 backdrop-blur-xl z-50 flex items-center justify-between px-5 border-b border-gray-200/50">
      <div className="flex items-center">
        <h1 className="text-xl font-black tracking-tight cursor-pointer transition-opacity hover:opacity-80">
          <span className="text-gray-900">TEN</span>{' '}
          <span className="text-gray-700 font-bold">NEWS</span>
        </h1>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center gap-5 text-sm font-medium">
        <span className="text-gray-400 font-medium hidden sm:block">
          {currentTime}
        </span>
        <button 
          onClick={onNewsletterClick}
          className="px-5 py-2 bg-primary-600 text-white border-none rounded-md text-xs font-semibold tracking-wide uppercase cursor-pointer transition-all hover:bg-primary-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Newsletter
        </button>
      </div>
    </header>
  );
}
