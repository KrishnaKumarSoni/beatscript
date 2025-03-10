const DDG = require('duck-duck-scrape');

async function searchLyricsOnDuckDuckGo(searchQuery) {
  const searchResults = await DDG.search(searchQuery, { safeSearch: DDG.SafeSearchType.STRICT });
  // console.log(searchResults);
  return searchResults;
}

const DDGresult = async (song) => {
  const response = await searchLyricsOnDuckDuckGo(`genius ${song} lyrics `);
  return response;
};

// const demoSearch = async () => {
//   try {
//     const song = "Shape of You Ed Sheeran";
//     const results = await DDGresult(song);
//     // console.log("Search results for:", song);
//     // console.log(results);
//     return results;
//   } catch (error) {
//     console.error("Error searching lyrics:", error);
//   }
// };

module.exports = {
  DDGresult,

};
