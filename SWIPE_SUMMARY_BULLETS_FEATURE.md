# Swipe to Toggle Summary/Bullet Points Feature

## Overview
This feature allows users to swipe left or right on the news summary text to toggle between the **summary paragraph** view and **summary bullet points** view. The bullet points are a different version of the summary text written in bullet point format (stored in `summary_bullets` field), NOT the details section. The implementation preserves all existing functionality including click navigation to original sources.

## Implementation Details

### State Management
- Added `showBulletPoints` state object to track toggle state for each story
- State persists per story until manually changed by the user
- Each news item maintains independent toggle state

### User Interactions

#### Mobile/Touch Devices
- **Swipe Left/Right on Summary**: Toggles between summary and bullet points
- **Horizontal swipe threshold**: 50px minimum movement
- **Vertical swipes**: Pass through for story navigation (unchanged)
- **Tap/Click**: Still navigates to original source URL

#### Desktop/Keyboard
- **Press 'S' key**: Toggles between summary and bullet points
- **Arrow keys**: Navigate between stories (unchanged)
- **Click anywhere**: Navigates to original source URL

### Technical Implementation

#### Touch Detection
```javascript
onTouchStart={(e) => {
  // Track initial touch position
  const startX = e.touches[0].clientX;
  const startY = e.touches[0].clientY;
  
  // Detect horizontal vs vertical swipes
  // Only toggle on clear horizontal swipes (>50px)
  // Let vertical swipes pass through for story navigation
}}
```

#### Display Logic
```javascript
{!showBulletPoints[index] ? (
  // Show Summary Paragraph (default)
  <p>{renderBoldText(story.summary, story.category)}</p>
) : (
  // Show Summary Bullet Points (from summary_bullets field)
  <ul>
    {story.summary_bullets.map((bullet, i) => (
      <li>{renderBoldText(bullet, story.category)}</li>
    ))}
  </ul>
)}
```

### Visual Indicators
1. **Mode Badge**: Shows "Summary" or "Bullets" in blue
2. **Swipe Hint**: Shows "← Swipe → or press S"
3. **Smooth Transitions**: CSS animations for content changes

### Key Features
- ✅ Non-destructive: All existing functionality preserved
- ✅ Persistent state: Each story remembers its toggle state
- ✅ Multi-modal: Touch, keyboard, and mouse support
- ✅ Clear feedback: Visual indicators show current mode
- ✅ No conflicts: Swipe detection doesn't interfere with navigation

### Files Modified
- `pages/index.js`: Main implementation
  - Added `showBulletPoints` state
  - Added `toggleBulletPoints` function
  - Added swipe detection on summary div
  - Added keyboard 'S' key handler
  - Added visual mode indicators
  - Added CSS transitions
  - Updated data loading to include `summary_bullets` field
- `pages/api/news-supabase.js`: API endpoint
  - Added `summary_bullets` field to API response
  - Now fetches and returns the JSONB array from database

### Data Structure
Uses `story.summary_bullets` array (JSONB field in database) for bullet points - a different version of the summary:
```javascript
story.summary = "A 35-40 word paragraph summary of the news story..."

story.summary_bullets = [
  "First key point from the summary",
  "Second key point from the summary", 
  "Third key point from the summary"
]

// NOTE: story.details is separate and used in the details section below
story.details = [
  "Impact: 500M affected",
  "Timeline: 2 weeks",
  "Scale: Global"
]
```

## User Experience

### Default State
- All stories start in **Summary** mode
- Clear visual indicator shows current mode
- Swipe hint guides users to the feature

### Toggle Behavior
- Swipe left OR right → Toggle mode
- Press 'S' key → Toggle mode
- Each story maintains its own state
- State persists until user changes it or refreshes page

### Navigation Preserved
- Click/tap on story → Opens original source URL
- Vertical swipe → Navigate between stories
- All existing keyboard shortcuts work

## Testing Checklist
- [x] Touch swipe left/right toggles mode
- [x] Keyboard 'S' key toggles mode
- [x] Click still opens original source
- [x] Vertical swipes still navigate stories
- [x] Mode indicator updates correctly
- [x] No linting errors
- [x] State persists per story
- [x] Works across different devices

## Deployment
The feature is now live on the main website (tennews.ai) running on port 3001.

Access at: http://localhost:3001

