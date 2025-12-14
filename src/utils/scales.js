import * as d3 from 'd3';

/**
 * Create standardized color scales for airlines
 */
export const createAirlineColorScale = (airlines) => {
  return d3.scaleOrdinal()
    .domain(airlines)
    .range(d3.schemeCategory10);
};

/**
 * Create rating scale (0-10 range)
 */
export const createRatingScale = (height) => {
  return d3.scaleLinear()
    .domain([0, 10])
    .range([height, 0])
    .nice();
};

/**
 * Create time scale for temporal data
 */
export const createTimeScale = (data, width) => {
  const extent = d3.extent(data, d => d.parsedDate || new Date(d.date));
  return d3.scaleTime()
    .domain(extent)
    .range([0, width]);
};

/**
 * Create ordinal scale for categorical data
 */
export const createCategoryScale = (categories, width) => {
  return d3.scaleBand()
    .domain(categories)
    .range([0, width])
    .padding(0.1);
};

/**
 * Create quantile scale for binning data into groups
 */
export const createQuantileScale = (data, accessor, colors) => {
  const values = data.map(accessor).filter(v => v != null);
  return d3.scaleQuantile()
    .domain(values)
    .range(colors);
};

/**
 * Create histogram bins for distribution analysis
 */
export const createHistogramBins = (data, accessor, numBins = 20) => {
  const histogram = d3.histogram()
    .value(accessor)
    .domain(d3.extent(data, accessor))
    .thresholds(numBins);
  
  return histogram(data);
};

/**
 * Normalize rating values to 0-1 range for comparisons
 */
export const normalizeRating = (value, min = 0, max = 10) => {
  return (value - min) / (max - min);
};

/**
 * Create diverging color scale for performance metrics
 */
export const createPerformanceColorScale = () => {
  return d3.scaleSequential()
    .domain([0, 10])
    .interpolator(d3.interpolateRdYlGn);
};

/**
 * Calculate optimal number of bins using Sturges' formula
 */
export const calculateOptimalBins = (dataLength) => {
  return Math.ceil(Math.log2(dataLength) + 1);
};
