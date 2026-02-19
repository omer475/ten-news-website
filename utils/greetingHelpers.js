// Greeting gradient by time
export const getGreetingGradient = (timeOfDay) => {
  if (timeOfDay === 'morning') return 'linear-gradient(90deg, #f97316 0%, #fbbf24 100%)'; // Orange → Yellow
  if (timeOfDay === 'afternoon') return 'linear-gradient(90deg, #3b82f6 0%, #06b6d4 100%)'; // Blue → Cyan
  return 'linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%)'; // Indigo → Purple
};

// Headline (rest) gradient by time
export const getHeadlineRestGradient = (timeOfDay) => {
  if (timeOfDay === 'morning') return 'linear-gradient(90deg, #7c3aed 0%, #ec4899 100%)'; // Deep Purple → Hot Pink
  if (timeOfDay === 'afternoon') return 'linear-gradient(90deg, #dc2626 0%, #f97316 100%)'; // Red → Orange
  return 'linear-gradient(90deg, #f59e0b 0%, #f87171 100%)'; // Gold → Coral
};

// Opening background gradient by time
export const getOpeningBackground = (timeOfDay) => {
  if (timeOfDay === 'morning') return 'linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)';
  if (timeOfDay === 'afternoon') return 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)';
  return 'linear-gradient(135deg, #f59e0b 0%, #f87171 100%)';
};

// Function to get greeting text based on time
export const getGreetingText = (timeOfDay) => {
  if (timeOfDay === 'morning') {
    return 'Goood morning';
  } else if (timeOfDay === 'afternoon') {
    return 'Goood evening';
  } else {
    return 'Goood night';
  }
};
