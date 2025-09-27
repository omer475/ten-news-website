export default function Newsletter({ onSignup }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const emailInput = e.target.querySelector('input[type="email"]');
    const email = emailInput?.value?.trim();
    
    if (!email || !email.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }

    onSignup(email, emailInput);
  };

  return (
    <div className="text-center py-16 bg-black text-white h-screen w-full flex flex-col justify-center">
      <h2 className="text-4xl lg:text-5xl font-black tracking-tight mb-4">
        <span className="text-primary-500">Stay</span> Informed
      </h2>
      
      <p className="text-lg text-gray-400 mb-10">
        Get Ten News delivered to your inbox every morning
      </p>
      
      <form onSubmit={handleSubmit} className="max-w-md mx-auto flex flex-col gap-4">
        <input 
          type="email" 
          placeholder="Enter your email" 
          className="w-full px-5 py-4 text-base border border-gray-700 rounded-xl bg-gray-800 text-white outline-none transition-colors focus:border-orange-500 placeholder:text-gray-500"
          required
        />
        <button 
          type="submit"
          className="w-full px-8 py-4 bg-white text-black border-none rounded-xl text-base font-semibold cursor-pointer transition-colors hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black"
        >
          Subscribe
        </button>
      </form>
      
      <p className="text-sm text-gray-500 mt-6">
        Join 2.5M+ readers • No spam • Unsubscribe anytime
      </p>
    </div>
  );
}
