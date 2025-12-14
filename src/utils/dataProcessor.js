import * as d3 from 'd3';

export const processAirlineData = (rawData) => {
  // Filter rows with sufficient rating data
  const validData = rawData.filter(row => 
    row.overall_rating && 
    row.seat_comfort_rating &&
    row.cabin_staff_rating &&
    row.value_money_rating
  );

  // Parse dates
  validData.forEach(row => {
    row.parsedDate = new Date(row.date);
    row.overall_rating = +row.overall_rating;
    row.seat_comfort_rating = +row.seat_comfort_rating;
    row.cabin_staff_rating = +row.cabin_staff_rating;
    row.food_beverages_rating = +row.food_beverages_rating || null;
    row.inflight_entertainment_rating = +row.inflight_entertainment_rating || null;
    row.value_money_rating = +row.value_money_rating;
  });

  return validData;
};

export const getTopAirlines = (data, n = 10) => {
  const airlineCounts = d3.rollup(
    data,
    v => ({
      count: v.length,
      avgRating: d3.mean(v, d => d.overall_rating)
    }),
    d => d.airline_name
  );

  return Array.from(airlineCounts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, n)
    .map(d => d[0]);
};

export const aggregateByCountry = (data) => {
  return d3.rollup(
    data,
    v => ({
      count: v.length,
      avgRating: d3.mean(v, d => d.overall_rating * 2),
      avgSeatComfort: d3.mean(v, d => d.seat_comfort_rating * 2),
      avgCabinStaff: d3.mean(v, d => d.cabin_staff_rating * 2)
    }),
    d => d.author_country
  );
};

export const aggregateByMonth = (data) => {
  return d3.rollup(
    data,
    v => ({
      count: v.length,
      avgRating: d3.mean(v, d => d.overall_rating)
    }),
    d => d3.timeMonth(d.parsedDate)
  );
};

export const processAirportData = (rawData) => {
  const validData = rawData.filter(row => 
    row.airport_name && 
    row.overall_rating &&
    !isNaN(+row.overall_rating)
  );

  validData.forEach(row => {
    row.parsedDate = new Date(row.date);
    row.overall_rating = +row.overall_rating;
    row.queuing_rating = +row.queuing_rating || null;
    row.terminal_cleanliness_rating = +row.terminal_cleanliness_rating || null;
    row.airport_shopping_rating = +row.airport_shopping_rating || null;
  });

  return validData;
};

export const processLoungeData = (rawData) => {
  const validData = rawData.filter(row => 
    row.lounge_name && 
    row.airport &&
    row.overall_rating &&
    !isNaN(+row.overall_rating)
  );

  validData.forEach(row => {
    row.parsedDate = new Date(row.date);
    row.overall_rating = +row.overall_rating * 2;
    row.comfort_rating = +row.comfort_rating * 2 || null;
    row.cleanliness_rating = +row.cleanliness_rating * 2 || null;
    row.staff_service_rating = +row.staff_service_rating * 2 || null;
  });

  return validData;
};

export const aggregateAirportsByLocation = (airportData, loungeData) => {
  // Group airport reviews by airport name
  const airportsByName = d3.rollup(
    airportData,
    v => ({
      count: v.length,
      avgRating: d3.mean(v, d => d.overall_rating),
      avgQueuing: d3.mean(v, d => d.queuing_rating * 2),
      avgCleanliness: d3.mean(v, d => d.terminal_cleanliness_rating * 2),
      avgShopping: d3.mean(v, d => d.airport_shopping_rating * 2),
      reviews: v
    }),
    d => d.airport_name
  );

  // Group lounges by airport
  const loungesByAirport = d3.rollup(
    loungeData,
    v => ({
      count: v.length,
      avgRating: d3.mean(v, d => d.overall_rating),
      lounges: v.map(l => ({
        name: l.lounge_name,
        rating: l.overall_rating,
        comfort: l.comfort_rating,
        cleanliness: l.cleanliness_rating,
        staff: l.staff_service_rating
      }))
    }),
    d => d.airport
  );

  // Combine airport and lounge data
  const combined = Array.from(airportsByName.entries()).map(([airportName, airportStats]) => {
    const loungeStats = loungesByAirport.get(airportName) || { count: 0, avgRating: null, lounges: [] };
    
    return {
      name: airportName,
      airport: airportStats,
      lounges: loungeStats
    };
  });

  return combined;
};

export const aggregateByCountryRatings = (airportData, loungeData) => {
  // Aggregate airports by country
  const airportByCountry = d3.rollup(
    airportData,
    v => ({
      airportCount: v.length,
      avgAirportRating: d3.mean(v, d => d.overall_rating)
    }),
    d => d.author_country
  );

  // Aggregate lounges by country (extract from airport field)
  const loungeByCountry = d3.rollup(
    loungeData,
    v => ({
      loungeCount: v.length,
      avgLoungeRating: d3.mean(v, d => d.overall_rating)
    }),
    d => d.author_country
  );

  // Combine both
  const allCountries = new Set([
    ...airportByCountry.keys(),
    ...loungeByCountry.keys()
  ]);

  return Array.from(allCountries).map(country => {
    const airport = airportByCountry.get(country) || { airportCount: 0, avgAirportRating: 0 };
    const lounge = loungeByCountry.get(country) || { loungeCount: 0, avgLoungeRating: 0 };
    
    const totalReviews = airport.airportCount + lounge.loungeCount;
    const combinedRating = totalReviews > 0
      ? ((airport.avgAirportRating * airport.airportCount) + 
         (lounge.avgLoungeRating * lounge.loungeCount)) / totalReviews
      : 0;

    return {
      country,
      airportCount: airport.airportCount,
      loungeCount: lounge.loungeCount,
      avgAirportRating: airport.avgAirportRating,
      avgLoungeRating: lounge.avgLoungeRating,
      combinedRating,
      totalReviews
    };
  }).filter(d => d.totalReviews > 0);
};

export const aggregateAirlineRatings = (data) => {
  // Group by airline and calculate average ratings
  const airlineAggregates = d3.rollup(
    data,
    v => ({
      airline_name: v[0].airline_name,
      count: v.length,
      seat_comfort_rating: d3.mean(v, d => d.seat_comfort_rating * 2),
      cabin_staff_rating: d3.mean(v, d => d.cabin_staff_rating * 2),
      food_beverages_rating: d3.mean(v, d => d.food_beverages_rating * 2),
      inflight_entertainment_rating: d3.mean(v, d => d.inflight_entertainment_rating * 2),
      value_money_rating: d3.mean(v, d => d.value_money_rating * 2),
      overall_rating: d3.mean(v, d => d.overall_rating)
    }),
    d => d.airline_name
  );

  // Convert to array and filter out airlines with insufficient data
  return Array.from(airlineAggregates.values())
    .filter(airline => airline.count >= 10) // At least 10 reviews
    .sort((a, b) => b.count - a.count); // Sort by review count
};
