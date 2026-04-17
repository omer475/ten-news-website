const data = require('./_articles_48h.json');
const tagCounts = {};
const catTags = {};
data.articles.forEach(a => {
  const tags = a.interest_tags || a.topics || [];
  tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  if (!(a.category in catTags)) catTags[a.category] = {};
  tags.forEach(t => { catTags[a.category][t] = (catTags[a.category][t] || 0) + 1; });
});
const sorted = Object.entries(tagCounts).sort((a,b) => b[1]-a[1]).slice(0,40);
console.log("TOP 40 TAGS:");
sorted.forEach(([t,c]) => console.log("  " + t + ": " + c));
console.log("\nTOP TAGS BY CATEGORY:");
Object.entries(catTags).forEach(([cat, tags]) => {
  const top = Object.entries(tags).sort((a,b) => b[1]-a[1]).slice(0,8);
  console.log(cat + ": " + top.map(([t,c]) => t+"("+c+")").join(", "));
});
