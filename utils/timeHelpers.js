// Function to calculate time since published
export const getTimeAgo = (publishedAt) => {
  if (!publishedAt) return '';

  try {
    const publishedDate = new Date(publishedAt);
    const now = new Date();
    const diffInMs = now - publishedDate;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInHours < 24) return `${diffInHours}h`;
    if (diffInDays < 7) return `${diffInDays}d`;

    const weeks = Math.floor(diffInDays / 7);
    return `${weeks}w`;
  } catch (error) {
    return '';
  }
};
