'use client';

import React from 'react';

/*
 * CardBoundary — isolates each feed card. If a single article's data makes a
 * card throw during render, only that card is hidden; the rest of the feed
 * keeps working instead of the whole page white-screening.
 */
export default class CardBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // Surface which card failed without taking down the page.
    if (typeof console !== 'undefined') {
      console.error('FeedCard render failed:', error?.message || error);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
