import { useEffect, useRef, useState } from 'react';
import { useFilters } from '../context/filterContext';
import * as d3 from 'd3';

const MultiEncodingScatterPlot = ({ data, dimensionFilter, isPreview = false }) => {
  const svgRef = useRef();
  const { filters } = useFilters();
  const [highlightDimension, setHighlightDimension] = useState('overall');

  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    if (isPreview) {
      drawPreviewScatterPlot();
    } else {
      drawScatterPlot();
    }

    // Cleanup tooltips on unmount
    return () => {
      d3.selectAll('.airline-tooltip').remove();
    };
  }, [data, filters, dimensionFilter, isPreview, highlightDimension]);

  const processAirlineData = (rawData) => {
    const airlineStats = d3.rollup(
      rawData,
      reviews => {
        const validReviews = reviews.filter(r => r.overall_rating > 0);

        // Normalize 0-5 ratings to 0-10
        const normalize = (rating, max = 5) => {
          if (!rating || rating === 0) return null;
          return max === 5 ? rating * 2 : rating;
        };

        // Calculate recommendation rate
        const recommendationRate = reviews.filter(r => r.recommended === '1').length / reviews.length;

        // Get Y-axis value based on dimension filter
        let yAxisValue;
        let yAxisLabel = 'Overall';

        if (dimensionFilter) {
          const fieldConfig = dimensionFilter.fields.airline;
          if (fieldConfig && fieldConfig.field) {
            const values = validReviews
              .map(r => r[fieldConfig.field])
              .filter(v => v && v > 0);
            yAxisValue = values.length > 0 
              ? d3.mean(values) * fieldConfig.multiplier 
              : null;
            yAxisLabel = dimensionFilter.dimension;
          } else {
            yAxisValue = d3.mean(validReviews, d => d.overall_rating);
          }
        } else {
          yAxisValue = d3.mean(validReviews, d => d.overall_rating);
        }

        return {
          airline_name: reviews[0].airline_name,
          review_count: validReviews.length,
          // Main axes
          value_money: normalize(d3.mean(validReviews, d => d.value_money_rating)),
          overall: yAxisValue,  // This will be the selected dimension or overall
          yAxisLabel: yAxisLabel,
          // Additional encodings
          seat_comfort: normalize(d3.mean(validReviews, d => d.seat_comfort_rating)),
          food_beverages: normalize(d3.mean(validReviews, d => d.food_beverages_rating)),
          cabin_staff: normalize(d3.mean(validReviews, d => d.cabin_staff_rating)),
          entertainment: normalize(d3.mean(validReviews, d => d.inflight_entertainment_rating)),
          // Derived metrics
          recommendationRate
        };
      },
      d => d.airline_name
    );

    return Array.from(airlineStats.values())
      .filter(a => a.review_count >= 10 && a.value_money !== null && a.overall !== null);
  };

  const drawPreviewScatterPlot = () => {
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const margin = { top: 35, right: 120, bottom: 40, left: 45 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const airlines = processAirlineData(data);

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 10])
      .range([0, width])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([height, 0])
      .nice();

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(airlines, d => d.review_count)])
      .range([4, 20]);

    const colorScale = d3.scaleSequential()
      .domain([0, 10])
      .interpolator(d3.interpolateRdYlGn);

    const opacityScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0.3, 0.95]);

    const getBorderWidth = (foodRating, circleRadius) => {
      const basePercent = 0.08 + (0.10 * (circleRadius / 20));
      const baseWidth = circleRadius * basePercent;
      const ratingMultiplier = 0.5 + (foodRating / 10);
      return baseWidth * ratingMultiplier;
    };

    const getRingWidth = (staffRating, circleRadius) => {
      const basePercent = 0.08 + (0.07 * (circleRadius / 20));
      const baseWidth = circleRadius * basePercent;
      const ratingMultiplier = 0.5 + (staffRating / 10);
      return baseWidth * ratingMultiplier;
    };

    // Grid lines
    g.append('g')
      .selectAll('line')
      .data(xScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 0.5);

    g.append('g')
      .selectAll('line')
      .data(yScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 0.5);

    // Quadrant labels
    const quadrants = [
      { x: width * 0.75, y: height * 0.25, label: 'Premium', color: '#27ae60' },
      { x: width * 0.25, y: height * 0.25, label: 'Pricey', color: '#3498db' },
      { x: width * 0.25, y: height * 0.75, label: 'Poor Value', color: '#e74c3c' },
      { x: width * 0.75, y: height * 0.75, label: 'Budget', color: '#f39c12' }
    ];

    quadrants.forEach(q => {
      g.append('text')
        .attr('x', q.x)
        .attr('y', q.y)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', q.color)
        .style('opacity', 0.15)
        .text(q.label);
    });

    // Draw circles
    const circles = g.selectAll('.airline-point')
      .data(airlines)
      .enter()
      .append('g');

    // Inner rings
    circles.append('circle')
      .attr('cx', d => xScale(d.value_money))
      .attr('cy', d => yScale(d.overall))
      .attr('r', d => sizeScale(d.review_count) * 0.55)
      .attr('fill', 'none')
      .attr('stroke', d => colorScale(d.cabin_staff))
      .attr('stroke-width', d => getRingWidth(d.cabin_staff, sizeScale(d.review_count)))
      .attr('opacity', 0.8);

    // Main circles
    circles.append('circle')
      .attr('cx', d => xScale(d.value_money))
      .attr('cy', d => yScale(d.overall))
      .attr('r', d => sizeScale(d.review_count))
      .attr('fill', d => colorScale(d.seat_comfort))
      .attr('opacity', d => opacityScale(d.recommendationRate))
      .attr('stroke', 'white')
      .attr('stroke-width', d => getBorderWidth(d.food_beverages, sizeScale(d.review_count)));

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .style('font-size', '8px');

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .style('font-size', '8px');

    // Axis labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Value for Money →');

    const yAxisLabel = dimensionFilter ? dimensionFilter.dimension : 'Overall Rating';
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -32)
      .attr('text-anchor', 'middle')
      .style('font-size', '9px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(`← ${yAxisLabel}`);

    // Title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Multi-Dimensional Airline Performance');

    // Compact Legend - LARGER VERSION
    const legendX = margin.left + width + 10;
    const legend = svg.append('g')
      .attr('transform', `translate(${legendX}, ${margin.top})`);

    let legendY = 0;

    // Title
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Visual Encodings:');

    legendY += 18;

    // Color gradient
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('font-weight', '500')
      .style('fill', '#2c3e50')
      .text('Fill = Seat');

    legendY += 12;

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'comfort-gradient-preview')
      .attr('x1', '0%')
      .attr('x2', '100%');

    for (let i = 0; i <= 10; i++) {
      gradient.append('stop')
        .attr('offset', `${(i / 10) * 100}%`)
        .attr('stop-color', colorScale(i));
    }

    legend.append('rect')
      .attr('x', 0)
      .attr('y', legendY)
      .attr('width', 90)
      .attr('height', 10)
      .style('fill', 'url(#comfort-gradient-preview)')
      .attr('rx', 2);

    legendY += 22;

    // Size
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('font-weight', '500')
      .style('fill', '#2c3e50')
      .text('Size = Reviews');

    legendY += 12;

    [100, 500].forEach((count, i) => {
      const cx = 12 + i * 40;
      legend.append('circle')
        .attr('cx', cx)
        .attr('cy', legendY + 6)
        .attr('r', sizeScale(count))
        .attr('fill', '#95a5a6')
        .attr('opacity', 0.5)
        .attr('stroke', 'white')
        .attr('stroke-width', 1);

      legend.append('text')
        .attr('x', cx)
        .attr('y', legendY + 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '7px')
        .style('fill', '#7f8c8d')
        .text(count);
    });

    legendY += 32;

    // Opacity
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('font-weight', '500')
      .style('fill', '#2c3e50')
      .text('Opacity = %');

    legendY += 12;

    [30, 100].forEach((percent, i) => {
      const cx = 12 + i * 40;
      legend.append('circle')
        .attr('cx', cx)
        .attr('cy', legendY + 5)
        .attr('r', 8)
        .attr('fill', '#3498db')
        .attr('opacity', percent / 100);

      legend.append('text')
        .attr('x', cx)
        .attr('y', legendY + 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '7px')
        .style('fill', '#7f8c8d')
        .text(`${percent}%`);
    });

    legendY += 32;

    // Border
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('font-weight', '500')
      .style('fill', '#2c3e50')
      .text('Border = Food');

    legendY += 12;

    [2, 9].forEach((rating, i) => {
      const cx = 12 + i * 40;
      const r = 8;
      legend.append('circle')
        .attr('cx', cx)
        .attr('cy', legendY + 5)
        .attr('r', r)
        .attr('fill', '#ecf0f1')
        .attr('stroke', '#e67e22')
        .attr('stroke-width', getBorderWidth(rating, r));

      legend.append('text')
        .attr('x', cx)
        .attr('y', legendY + 20)
        .attr('text-anchor', 'middle')
        .style('font-size', '7px')
        .style('fill', '#7f8c8d')
        .text(rating);
    });

    legendY += 32;

    // Ring
    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('font-weight', '500')
      .style('fill', '#2c3e50')
      .text('Ring = Staff');

    legendY += 12;

    const ringDemo = legend.append('g')
      .attr('transform', `translate(25, ${legendY + 8})`);

    ringDemo.append('circle')
      .attr('r', 11)
      .attr('fill', '#95a5a6')
      .attr('opacity', 0.3);

    ringDemo.append('circle')
      .attr('r', 6)
      .attr('fill', 'none')
      .attr('stroke', colorScale(8))
      .attr('stroke-width', getRingWidth(8, 11))
      .attr('opacity', 0.8);
  };

  const drawScatterPlot = () => {
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const margin = { top: 70, right: 200, bottom: 70, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    let filteredData = data;
    if (filters.selectedAirlines && filters.selectedAirlines.length > 0) {
      filteredData = data.filter(d => filters.selectedAirlines.includes(d.airline_name));
    }

    const airlines = processAirlineData(filteredData);

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleLinear()
      .domain([0, 10])
      .range([0, width])
      .nice();

    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([height, 0])
      .nice();

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(airlines, d => d.review_count)])
      .range([6, 35]);

    const colorScale = d3.scaleSequential()
      .domain([0, 10])
      .interpolator(d3.interpolateRdYlGn);

    const opacityScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0.3, 0.95]);

    const getBorderWidth = (foodRating, circleRadius) => {
      const basePercent = 0.08 + (0.10 * (circleRadius / 35));
      const baseWidth = circleRadius * basePercent;
      const ratingMultiplier = 0.5 + (foodRating / 10);
      return baseWidth * ratingMultiplier;
    };

    const getRingWidth = (staffRating, circleRadius) => {
      const basePercent = 0.08 + (0.07 * (circleRadius / 35));
      const baseWidth = circleRadius * basePercent;
      const ratingMultiplier = 0.5 + (staffRating / 10);
      return baseWidth * ratingMultiplier;
    };

    // Grid lines
    g.append('g')
      .attr('class', 'grid-x')
      .selectAll('line')
      .data(xScale.ticks(10))
      .enter()
      .append('line')
      .attr('x1', d => xScale(d))
      .attr('x2', d => xScale(d))
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 1);

    g.append('g')
      .attr('class', 'grid-y')
      .selectAll('line')
      .data(yScale.ticks(10))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', '#e8e8e8')
      .attr('stroke-width', 1);

    // Draw quadrant labels
    const quadrants = [
      { x: width * 0.75, y: height * 0.20, label: 'Premium Quality', color: '#27ae60' },
      { x: width * 0.25, y: height * 0.20, label: 'Good but Pricey', color: '#3498db' },
      { x: width * 0.25, y: height * 0.80, label: 'Poor Value', color: '#e74c3c' },
      { x: width * 0.75, y: height * 0.80, label: 'Budget Friendly', color: '#f39c12' }
    ];

    quadrants.forEach(q => {
      g.append('text')
        .attr('x', q.x)
        .attr('y', q.y)
        .attr('text-anchor', 'middle')
        .style('font-size', '15px')
        .style('font-weight', 'bold')
        .style('fill', q.color)
        .style('opacity', 0.12)
        .text(q.label);
    });

    // Draw circles
    const circles = g.selectAll('.airline-point')
      .data(airlines)
      .enter()
      .append('g')
      .attr('class', 'airline-point');

    // Inner rings
    const innerRings = circles.append('circle')
      .attr('class', 'inner-ring')
      .attr('cx', d => xScale(d.value_money))
      .attr('cy', d => yScale(d.overall))
      .attr('r', d => sizeScale(d.review_count) * 0.55)
      .attr('fill', 'none')
      .attr('stroke', d => colorScale(d.cabin_staff))
      .attr('stroke-width', d => getRingWidth(d.cabin_staff, sizeScale(d.review_count)))
      .attr('opacity', 0.8)
      .style('pointer-events', 'none');

    // Main circles
    const mainCircles = circles.append('circle')
      .attr('class', 'main-circle')
      .attr('cx', d => xScale(d.value_money))
      .attr('cy', d => yScale(d.overall))
      .attr('r', d => sizeScale(d.review_count))
      .attr('fill', d => colorScale(d.seat_comfort))
      .attr('opacity', d => opacityScale(d.recommendationRate))
      .attr('stroke', 'white')
      .attr('stroke-width', d => getBorderWidth(d.food_beverages, sizeScale(d.review_count)))
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        const radius = sizeScale(d.review_count);
        d3.select(this)
          .attr('stroke', '#2c3e50')
          .attr('stroke-width', getBorderWidth(d.food_beverages, radius) + 2);

        d3.select(this.parentNode).select('.inner-ring')
          .attr('opacity', 1)
          .attr('stroke-width', getRingWidth(d.cabin_staff, radius) + 2.5)
          .attr('stroke', '#2c3e50')
          .style('filter', 'drop-shadow(0 0 6px rgba(44, 62, 80, 0.9))');

        d3.selectAll('.airline-tooltip').remove();

        const tooltip = d3.select('body')
          .append('div')
          .attr('class', 'airline-tooltip')
          .style('position', 'fixed')
          .style('background', 'white')
          .style('border', '3px solid #2c3e50')
          .style('border-radius', '8px')
          .style('padding', '14px')
          .style('box-shadow', '0 4px 16px rgba(0,0,0,0.25)')
          .style('pointer-events', 'none')
          .style('z-index', '10000')
          .style('max-width', '240px')
          .style('font-family', 'Segoe UI, sans-serif');

        const x = Math.min(event.pageX + 20, window.innerWidth - 260);
        const y = Math.max(event.pageY - 100, 10);

        tooltip.style('left', `${x}px`)
          .style('top', `${y}px`);

        tooltip.append('div')
          .style('font-size', '13px')
          .style('font-weight', 'bold')
          .style('color', '#2c3e50')
          .style('margin-bottom', '10px')
          .style('padding-bottom', '8px')
          .style('border-bottom', '2px solid #ecf0f1')
          .text(d.airline_name.length > 35 ? d.airline_name.substring(0, 35) + '...' : d.airline_name);

        const metricsDiv = tooltip.append('div')
          .style('display', 'grid')
          .style('grid-template-columns', '1fr 1fr')
          .style('gap', '6px')
          .style('margin-bottom', '8px');

        const yAxisLabel = d.yAxisLabel || 'Overall';
        const metrics = [
          { label: yAxisLabel, value: d.overall.toFixed(1), color: '#f39c12' },
          { label: 'Value', value: d.value_money.toFixed(1), color: '#27ae60' },
          { label: 'Seat', value: d.seat_comfort.toFixed(1), color: '#3498db' },
          { label: 'Food', value: d.food_beverages.toFixed(1), color: '#e67e22' },
          { label: 'Staff', value: d.cabin_staff.toFixed(1), color: '#9b59b6' },
          { label: 'Entertain', value: d.entertainment.toFixed(1), color: '#e74c3c' }
        ];

        metrics.forEach(m => {
          const metricDiv = metricsDiv.append('div')
            .style('padding', '5px')
            .style('background', '#f8f9fa')
            .style('border-radius', '4px')
            .style('font-size', '10px')
            .style('display', 'flex')
            .style('justify-content', 'space-between')
            .style('align-items', 'center');

          metricDiv.append('span')
            .style('color', '#7f8c8d')
            .text(m.label);

          metricDiv.append('span')
            .style('font-weight', 'bold')
            .style('color', m.color)
            .text(m.value);
        });

        const statsDiv = tooltip.append('div')
          .style('padding-top', '8px')
          .style('border-top', '1px solid #ecf0f1')
          .style('font-size', '9px')
          .style('color', '#7f8c8d')
          .style('display', 'flex')
          .style('justify-content', 'space-between');

        statsDiv.append('span')
          .html(`<strong>${d.review_count}</strong> reviews`);

        statsDiv.append('span')
          .html(`<strong>${(d.recommendationRate * 100).toFixed(0)}%</strong> recommend`);
      })
      .on('mouseout', function(event, d) {
        const radius = sizeScale(d.review_count);
        d3.select(this)
          .attr('stroke', 'white')
          .attr('stroke-width', getBorderWidth(d.food_beverages, radius));

        d3.select(this.parentNode).select('.inner-ring')
          .attr('opacity', 0.8)
          .attr('stroke-width', getRingWidth(d.cabin_staff, radius))
          .attr('stroke', colorScale(d.cabin_staff))
          .style('filter', 'none');

        d3.selectAll('.airline-tooltip').remove();
      })
      .on('mousemove', function(event) {
        const x = Math.min(event.pageX + 20, window.innerWidth - 260);
        const y = Math.max(event.pageY - 100, 10);
        d3.select('.airline-tooltip')
          .style('left', `${x}px`)
          .style('top', `${y}px`);
      });

    // Axes
    const xAxis = d3.axisBottom(xScale).ticks(10);
    const yAxis = d3.axisLeft(yScale).ticks(10);

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .style('font-size', '11px')
      .selectAll('text')
      .style('fill', '#2c3e50');

    g.append('g')
      .call(yAxis)
      .style('font-size', '11px')
      .selectAll('text')
      .style('fill', '#2c3e50');

    // Axis labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 50)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Value for Money Rating (0-10) →');

    const yAxisLabel = dimensionFilter ? `${dimensionFilter.dimension} Rating` : 'Overall Rating';
    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(`← ${yAxisLabel} (0-10)`);

    // Title
    const titleText = dimensionFilter 
      ? `Multi-Dimensional Airline Performance: ${dimensionFilter.dimension} Analysis`
      : 'Multi-Dimensional Airline Performance Analysis';

    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .style('font-size', '17px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(titleText);

    // Full Legend
    const legendX = margin.left + width + 20;
    const legend = svg.append('g')
      .attr('transform', `translate(${legendX}, ${margin.top})`);

    let legendY = 0;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Visual Encodings:');

    legendY += 25;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Fill Color = Seat Comfort');

    legendY += 18;

    const colorGradient = legend.append('g')
      .attr('transform', `translate(0, ${legendY})`);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'comfort-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%');

    for (let i = 0; i <= 10; i++) {
      gradient.append('stop')
        .attr('offset', `${(i / 10) * 100}%`)
        .attr('stop-color', colorScale(i));
    }

    colorGradient.append('rect')
      .attr('width', 140)
      .attr('height', 14)
      .style('fill', 'url(#comfort-gradient)')
      .attr('rx', 3);

    colorGradient.append('text')
      .attr('x', 0)
      .attr('y', 26)
      .style('font-size', '8px')
      .style('fill', '#7f8c8d')
      .text('Poor');

    colorGradient.append('text')
      .attr('x', 140)
      .attr('y', 26)
      .attr('text-anchor', 'end')
      .style('font-size', '8px')
      .style('fill', '#7f8c8d')
      .text('Excellent');

    legendY += 45;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Circle Size = Reviews');

    legendY += 18;

    const sizeExamples = legend.append('g')
      .attr('transform', `translate(0, ${legendY})`);

    const sizeData = [
      { count: 100, cx: 15 },
      { count: 500, cx: 60 },
      { count: 1000, cx: 120 }
    ];

    sizeData.forEach(item => {
      sizeExamples.append('circle')
        .attr('cx', item.cx)
        .attr('cy', 18)
        .attr('r', sizeScale(item.count))
        .attr('fill', '#95a5a6')
        .attr('opacity', 0.5)
        .attr('stroke', 'white')
        .attr('stroke-width', 2);

      sizeExamples.append('text')
        .attr('x', item.cx)
        .attr('y', 40)
        .attr('text-anchor', 'middle')
        .style('font-size', '8px')
        .style('fill', '#7f8c8d')
        .text(item.count);
    });

    legendY += 60;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Opacity = Recommend %');

    legendY += 18;

    const opacityExamples = legend.append('g')
      .attr('transform', `translate(0, ${legendY})`);

    [30, 65, 100].forEach((percent, i) => {
      const cx = 20 + i * 40;
      opacityExamples.append('circle')
        .attr('cx', cx)
        .attr('cy', 12)
        .attr('r', 12)
        .attr('fill', '#3498db')
        .attr('opacity', percent / 100);

      opacityExamples.append('text')
        .attr('x', cx)
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .style('font-size', '8px')
        .style('fill', '#7f8c8d')
        .text(`${percent}%`);
    });

    legendY += 50;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Border = Food Rating');

    legendY += 15;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('fill', '#7f8c8d')
      .style('font-style', 'italic')
      .text('(width scales with rating)');

    legendY += 15;

    const borderExamples = legend.append('g')
      .attr('transform', `translate(0, ${legendY})`);

    [2, 5, 9].forEach((rating, i) => {
      const cx = 20 + i * 40;
      const radius = 12;
      borderExamples.append('circle')
        .attr('cx', cx)
        .attr('cy', 12)
        .attr('r', radius)
        .attr('fill', '#ecf0f1')
        .attr('stroke', '#e67e22')
        .attr('stroke-width', getBorderWidth(rating, radius));

      borderExamples.append('text')
        .attr('x', cx)
        .attr('y', 32)
        .attr('text-anchor', 'middle')
        .style('font-size', '8px')
        .style('fill', '#7f8c8d')
        .text(rating.toFixed(0));
    });

    legendY += 50;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Inner Ring = Staff Rating');

    legendY += 15;

    legend.append('text')
      .attr('x', 0)
      .attr('y', legendY)
      .style('font-size', '8px')
      .style('fill', '#7f8c8d')
      .style('font-style', 'italic')
      .text('(width scales with rating)');

    legendY += 18;

    const ringExample = legend.append('g')
      .attr('transform', `translate(35, ${legendY + 15})`);

    ringExample.append('circle')
      .attr('r', 18)
      .attr('fill', '#95a5a6')
      .attr('opacity', 0.3);

    ringExample.append('circle')
      .attr('r', 10)
      .attr('fill', 'none')
      .attr('stroke', colorScale(8.5))
      .attr('stroke-width', getRingWidth(8.5, 18))
      .attr('opacity', 0.8);

    // Add spacing before dimension selector
    legendY += 40;
      
  };

  return (
    <div ref={svgRef} style={{ width: '100%', height: '100%' }}>
      {/* 6 dimensions encoded: X/Y axes, size, color, opacity, border thickness. Hover circles for details. */}
    </div>
  );
};

export default MultiEncodingScatterPlot;