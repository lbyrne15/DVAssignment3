import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const TimeSeriesAnalysis = ({ 
  airlineData, 
  airportData, 
  loungeData, 
  dimensionFilter,
  isPreview = false 
}) => {
  const svgRef = useRef();
  const [yearGrouping, setYearGrouping] = useState('all'); // 'all', 'individual', '5year'

  useEffect(() => {
    if (!airlineData || !airportData || !loungeData || !svgRef.current) return;

    if (isPreview) {
      drawPreviewScatterTimeSeries();
    } else {
      drawScatterTimeSeries();
    }

    return () => {
      d3.selectAll('.timeseries-tooltip').remove();
    };
  }, [airlineData, airportData, loungeData, yearGrouping, dimensionFilter, isPreview]);

  const processMonthlyYearData = (rawData, category) => {
    const parseDate = d3.timeParse('%Y-%m-%d');

    const dataWithDates = rawData
      .filter(d => d.date)
      .map(d => ({
        ...d,
        parsedDate: parseDate(d.date),
        category
      }))
      .filter(d => d.parsedDate);

    // Determine which field to use based on dimensionFilter
    const getRatingValue = (d) => {
      if (!dimensionFilter) {
        return d.overall_rating > 0 ? d.overall_rating : null;
      }

      // Get the field configuration for this category
      const entityType = category === 'Airlines' ? 'airline' : 
                         category === 'Airports' ? 'airport' : 'lounge';
      const fieldConfig = dimensionFilter.fields[entityType];

      if (!fieldConfig) return null;

      const value = d[fieldConfig.field];
      if (!value || value === 0) return null;

      return value * fieldConfig.multiplier;
    };

    // Group by month and year
    const grouped = d3.rollup(
      dataWithDates,
      v => {
        const ratings = v.map(getRatingValue).filter(r => r !== null);
        if (ratings.length === 0) return null;

        return {
          avgRating: Math.min(10, Math.max(0, d3.mean(ratings))),
          count: ratings.length,
          category: v[0].category,
          month: v[0].parsedDate.getMonth(),
          year: v[0].parsedDate.getFullYear()
        };
      },
      d => `${d.parsedDate.getFullYear()}-${d.parsedDate.getMonth()}`
    );

    return Array.from(grouped.values()).filter(v => v !== null);
  };

  const groupDataByYears = (data) => {
    if (yearGrouping === 'all') {
      // Aggregate all years together
      const grouped = d3.rollup(
        data,
        v => ({
          avgRating: d3.mean(v, d => d.avgRating),
          count: d3.sum(v, d => d.count),
          category: v[0].category,
          month: v[0].month,
          yearLabel: 'All Years'
        }),
        d => `${d.month}-${d.category}`
      );
      return Array.from(grouped.values());
    } else if (yearGrouping === 'individual') {
      // Keep individual years
      return data.map(d => ({
        ...d,
        yearLabel: d.year.toString()
      }));
    } else {
      // Group into 5-year periods and AGGREGATE
      const grouped = d3.rollup(
        data,
        v => {
          const periodStart = Math.floor(v[0].year / 5) * 5;
          const periodEnd = periodStart + 4;
          return {
            avgRating: d3.mean(v, d => d.avgRating),
            count: d3.sum(v, d => d.count),
            category: v[0].category,
            month: v[0].month,
            yearLabel: `${periodStart}-${periodEnd}`,
            yearGroup: periodStart
          };
        },
        d => {
          const periodStart = Math.floor(d.year / 5) * 5;
          return `${d.month}-${d.category}-${periodStart}`;
        }
      );
      return Array.from(grouped.values());
    }
  };

  const drawPreviewScatterTimeSeries = () => {
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const margin = { top: 30, right: 15, bottom: 45, left: 45 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const airlineMonthly = processMonthlyYearData(airlineData, 'Airlines');
    const airportMonthly = processMonthlyYearData(airportData, 'Airports');
    const loungeMonthly = processMonthlyYearData(loungeData, 'Lounges');

    const allData = groupDataByYears([...airlineMonthly, ...airportMonthly, ...loungeMonthly]);

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const xScale = d3.scaleBand()
      .domain(monthNames)
      .range([0, width])
      .padding(0.2);

    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([height, 0]);

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(allData, d => d.count)])
      .range([2, 10]);

    const colorScale = d3.scaleLinear()
      .domain([0, 5, 10])
      .range(['#e74c3c', '#f39c12', '#27ae60']);

    // Grid
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

    // Draw shapes
    allData.forEach(d => {
      const monthName = monthNames[d.month];
      const x = xScale(monthName) + xScale.bandwidth() / 2;
      const y = yScale(d.avgRating);
      const size = sizeScale(d.count);
      const color = colorScale(d.avgRating);

      if (d.category === 'Airlines') {
        g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', size)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 0.5);
      } else if (d.category === 'Airports') {
        g.append('rect')
          .attr('x', x - size)
          .attr('y', y - size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 0.5);
      } else {
        const points = [
          [x, y - size * 1.2],
          [x - size, y + size * 0.6],
          [x + size, y + size * 0.6]
        ].map(p => p.join(',')).join(' ');
        g.append('polygon')
          .attr('points', points)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 0.5);
      }
    });

    // Draw trend lines for each category
    if (yearGrouping === 'all') {
      const categories = ['Airlines', 'Airports', 'Lounges'];
      const categoryColors = {
        'Airlines': '#3498db',
        'Airports': '#27ae60',
        'Lounges': '#e67e22'
      };

      categories.forEach(category => {
        const categoryData = allData
          .filter(d => d.category === category)
          .sort((a, b) => a.month - b.month);

        if (categoryData.length > 1) {
          const line = d3.line()
            .x(d => xScale(monthNames[d.month]) + xScale.bandwidth() / 2)
            .y(d => yScale(d.avgRating))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(categoryData)
            .attr('fill', 'none')
            .attr('stroke', categoryColors[category])
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.4)
            .attr('d', line);
        }
      });
    }

    // Calculate overall average per month
    const overallByMonth = d3.rollup(
      allData,
      v => d3.mean(v, d => d.avgRating),
      d => d.month
    );

    Array.from(overallByMonth.entries()).forEach(([month, avgRating]) => {
      const monthName = monthNames[month];
      const x = xScale(monthName) + xScale.bandwidth() / 2;
      const y = yScale(avgRating);

      const star = d3.symbol().type(d3.symbolStar).size(35);

      g.append('path')
        .attr('d', star)
        .attr('transform', `translate(${x},${y})`)
        .attr('fill', '#f39c12')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 1);
    });

    // Draw overall average trend line
    if (yearGrouping === 'all') {
      const overallByMonthArray = Array.from(overallByMonth.entries())
        .map(([month, avgRating]) => ({
          month: month,
          avgRating: avgRating
        }))
        .sort((a, b) => a.month - b.month);

      if (overallByMonthArray.length > 1) {
        const overallLine = d3.line()
          .x(d => xScale(monthNames[d.month]) + xScale.bandwidth() / 2)
          .y(d => yScale(d.avgRating))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(overallByMonthArray)
          .attr('fill', 'none')
          .attr('stroke', '#f39c12')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-dasharray', '5,5')
          .attr('d', overallLine);
      }
    }

    // Axes
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .style('font-size', '7px');

    xAxis.selectAll('text')
      .style('fill', '#2c3e50');
    xAxis.select('.domain')
      .style('stroke', '#2c3e50');
    xAxis.selectAll('.tick line')
      .style('stroke', '#2c3e50');

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .style('font-size', '8px');

    yAxis.selectAll('text')
      .style('fill', '#2c3e50');
    yAxis.select('.domain')
      .style('stroke', '#2c3e50');
    yAxis.selectAll('.tick line')
      .style('stroke', '#2c3e50');

    // Labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 38)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', '#2c3e50')
      .text('Month');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -32)
      .attr('text-anchor', 'middle')
      .style('font-size', '8px')
      .style('fill', '#2c3e50')
      .text(dimensionFilter ? dimensionFilter.dimension : 'Rating');

    // Title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(dimensionFilter 
        ? `Monthly ${dimensionFilter.dimension} Trends` 
        : 'Monthly Service Quality Trends');

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${height + margin.top + 35})`);

    const legendItems = [
      { shape: 'circle', label: 'Airlines', color: '#3498db' },
      { shape: 'square', label: 'Airports', color: '#27ae60' },
      { shape: 'triangle', label: 'Lounges', color: '#e67e22' },
      { shape: 'star', label: 'Overall', color: '#f39c12' }
    ];

    legendItems.forEach((item, i) => {
      const x = i * 60;
      const legendG = legend.append('g').attr('transform', `translate(${x}, 0)`);

      if (item.shape === 'circle') {
        legendG.append('circle').attr('r', 3).attr('fill', item.color).attr('opacity', 0.7);
      } else if (item.shape === 'square') {
        legendG.append('rect').attr('x', -3).attr('y', -3).attr('width', 6).attr('height', 6).attr('fill', item.color).attr('opacity', 0.7);
      } else if (item.shape === 'triangle') {
        const points = [[0, -4], [-3, 2], [3, 2]].map(p => p.join(',')).join(' ');
        legendG.append('polygon').attr('points', points).attr('fill', item.color).attr('opacity', 0.7);
      } else {
        const star = d3.symbol().type(d3.symbolStar).size(25);
        legendG.append('path').attr('d', star).attr('fill', item.color);
      }

      legendG.append('text').attr('x', 7).attr('y', 3).style('font-size', '6px').style('fill', '#2c3e50').text(item.label);
    });
  };

  const drawScatterTimeSeries = () => {
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const margin = { top: 100, right: 40, bottom: 80, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const airlineMonthly = processMonthlyYearData(airlineData, 'Airlines');
    const airportMonthly = processMonthlyYearData(airportData, 'Airports');
    const loungeMonthly = processMonthlyYearData(loungeData, 'Lounges');

    const allData = groupDataByYears([...airlineMonthly, ...airportMonthly, ...loungeMonthly]);

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    const xScale = d3.scaleBand()
      .domain(monthNames)
      .range([0, width])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, 10])
      .range([height, 0]);

    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(allData, d => d.count)])
      .range([4, 20]);

    const colorScale = d3.scaleLinear()
      .domain([0, 5, 10])
      .range(['#e74c3c', '#f39c12', '#27ae60']);

    // Grid
    g.append('g')
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

    // Vertical month dividers
    monthNames.forEach(month => {
      const x = xScale(month);
      g.append('line')
        .attr('x1', x)
        .attr('x2', x)
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#d0d0d0')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,4')
        .attr('opacity', 0.4);
    });

    // Tooltip
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'timeseries-tooltip')
      .style('position', 'fixed')
      .style('background', 'white')
      .style('border', '2px solid #2c3e50')
      .style('border-radius', '6px')
      .style('padding', '10px')
      .style('font-size', '11px')
      .style('color', '#2c3e50') 
      .style('pointer-events', 'none')
      .style('opacity', 0)
      .style('z-index', '10000');

    // Draw shapes with interaction
    allData.forEach(d => {
      const monthName = monthNames[d.month];
      const x = xScale(monthName) + xScale.bandwidth() / 2;
      const y = yScale(d.avgRating);
      const size = sizeScale(d.count);
      const color = colorScale(d.avgRating);

      let shape;

      if (d.category === 'Airlines') {
        shape = g.append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', size)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else if (d.category === 'Airports') {
        shape = g.append('rect')
          .attr('x', x - size)
          .attr('y', y - size)
          .attr('width', size * 2)
          .attr('height', size * 2)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else {
        const points = [
          [x, y - size * 1.2],
          [x - size, y + size * 0.6],
          [x + size, y + size * 0.6]
        ].map(p => p.join(',')).join(' ');
        shape = g.append('polygon')
          .attr('points', points)
          .attr('fill', color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      }

      shape
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('opacity', 1)
            .attr('stroke', '#2c3e50')
            .attr('stroke-width', 3);

          const dimensionLabel = dimensionFilter ? dimensionFilter.dimension : 'Overall';

          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-weight: bold; margin-bottom: 6px;">${d.category}</div>
              <div><strong>Month:</strong> ${monthName}</div>
              <div><strong>Year:</strong> ${d.yearLabel}</div>
              <div><strong>Avg ${dimensionLabel}:</strong> ${d.avgRating.toFixed(2)}/10</div>
              <div><strong>Reviews:</strong> ${d.count.toLocaleString()}</div>
            `)
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY - 40}px`);
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('opacity', 0.6)
            .attr('stroke', 'white')
            .attr('stroke-width', 1.5);
          tooltip.style('opacity', 0);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY - 40}px`);
        });
    });

    // Draw trend lines for each category
    if (yearGrouping === 'all') {
      const categories = ['Airlines', 'Airports', 'Lounges'];
      const categoryColors = {
        'Airlines': '#3498db',
        'Airports': '#27ae60',
        'Lounges': '#e67e22'
      };

      categories.forEach(category => {
        const categoryData = allData
          .filter(d => d.category === category)
          .sort((a, b) => a.month - b.month);

        if (categoryData.length > 1) {
          const line = d3.line()
            .x(d => xScale(monthNames[d.month]) + xScale.bandwidth() / 2)
            .y(d => yScale(d.avgRating))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(categoryData)
            .attr('fill', 'none')
            .attr('stroke', categoryColors[category])
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.4)
            .attr('d', line);
        }
      });
    }

    // Calculate overall average per month
    const overallByMonth = d3.rollup(
      allData,
      v => ({
        avgRating: d3.mean(v, d => d.avgRating),
        totalReviews: d3.sum(v, d => d.count)
      }),
      d => d.month
    );

    Array.from(overallByMonth.entries()).forEach(([month, stats]) => {
      const monthName = monthNames[month];
      const x = xScale(monthName) + xScale.bandwidth() / 2;
      const y = yScale(stats.avgRating);

      const star = d3.symbol().type(d3.symbolStar).size(180);

      const starShape = g.append('path')
        .attr('d', star)
        .attr('transform', `translate(${x},${y})`)
        .attr('fill', '#f39c12')
        .attr('stroke', '#2c3e50')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseover', function(event) {
          d3.select(this)
            .attr('stroke-width', 4)
            .attr('transform', `translate(${x},${y}) scale(1.3)`);

          const dimensionLabel = dimensionFilter ? dimensionFilter.dimension : 'Overall';

          tooltip
            .style('opacity', 1)
            .html(`
              <div style="font-weight: bold; margin-bottom: 6px;">Overall Average</div>
              <div><strong>Month:</strong> ${monthName}</div>
              <div><strong>Period:</strong> ${yearGrouping === 'all' ? 'All Years' : 'Selected Period'}</div>
              <div><strong>Combined ${dimensionLabel}:</strong> ${stats.avgRating.toFixed(2)}/10</div>
              <div><strong>Total Reviews:</strong> ${stats.totalReviews.toLocaleString()}</div>
            `)
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY - 40}px`);
        })
        .on('mouseout', function() {
          d3.select(this)
            .attr('stroke-width', 2)
            .attr('transform', `translate(${x},${y}) scale(1)`);
          tooltip.style('opacity', 0);
        })
        .on('mousemove', function(event) {
          tooltip
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY - 40}px`);
        });
    });

    // Draw overall average trend line
    if (yearGrouping === 'all') {
      const overallByMonthArray = Array.from(overallByMonth.entries())
        .map(([month, stats]) => ({
          month: month,
          avgRating: stats.avgRating
        }))
        .sort((a, b) => a.month - b.month);

      if (overallByMonthArray.length > 1) {
        const overallLine = d3.line()
          .x(d => xScale(monthNames[d.month]) + xScale.bandwidth() / 2)
          .y(d => yScale(d.avgRating))
          .curve(d3.curveMonotoneX);

        g.append('path')
          .datum(overallByMonthArray)
          .attr('fill', 'none')
          .attr('stroke', '#f39c12')
          .attr('stroke-width', 3)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-dasharray', '5,5')
          .attr('d', overallLine);
      }
    }

    // Axes
    const xAxis = g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .style('font-size', '11px');

    xAxis.selectAll('text')
      .style('text-anchor', 'middle')
      .style('fill', '#2c3e50');

    xAxis.select('.domain')
      .style('stroke', '#2c3e50');
    xAxis.selectAll('.tick line')
      .style('stroke', '#2c3e50');

    const yAxis = g.append('g')
      .call(d3.axisLeft(yScale).ticks(10).tickFormat(d => d.toFixed(0)))
      .style('font-size', '11px');

    yAxis.selectAll('text')
      .style('fill', '#2c3e50');

    yAxis.select('.domain')
      .style('stroke', '#2c3e50');
    yAxis.selectAll('.tick line')
      .style('stroke', '#2c3e50');

    // Labels
    g.append('text')
      .attr('x', width / 2)
      .attr('y', height + 65)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Calendar Month');

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -height / 2)
      .attr('y', -50)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(dimensionFilter 
        ? `${dimensionFilter.dimension} Rating (0-10)` 
        : 'Average Rating (0-10)');

    // Title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '17px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text(dimensionFilter 
        ? `${dimensionFilter.dimension} Trends by Month` 
        : 'Service Quality Trends by Month');

    const subtitleText = yearGrouping === 'all'
      ? 'All years combined'
      : yearGrouping === 'individual'
      ? 'Individual years shown'
      : '5-year periods';

    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .style('font-size', '11px')
      .style('fill', '#7f8c8d')
      .text(`${subtitleText} | Circle size = review volume | Color: red (poor) → green (excellent)`);

    // Legend
    const legend = svg.append('g')
      .attr('transform', `translate(${margin.left + 20}, ${margin.top - 20})`);

    const legendItems = [
      { shape: 'circle', label: 'Airlines', color: '#3498db' },
      { shape: 'square', label: 'Airports', color: '#27ae60' },
      { shape: 'triangle', label: 'Lounges', color: '#e67e22' },
      { shape: 'star', label: 'Overall Average', color: '#f39c12' }
    ];

    legendItems.forEach((item, i) => {
      const x = i * 110;
      const legendG = legend.append('g').attr('transform', `translate(${x}, 0)`);

      if (item.shape === 'circle') {
        legendG.append('circle')
          .attr('r', 6)
          .attr('fill', item.color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else if (item.shape === 'square') {
        legendG.append('rect')
          .attr('x', -6)
          .attr('y', -6)
          .attr('width', 12)
          .attr('height', 12)
          .attr('fill', item.color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else if (item.shape === 'triangle') {
        const points = [[0, -7], [-6, 4], [6, 4]].map(p => p.join(',')).join(' ');
        legendG.append('polygon')
          .attr('points', points)
          .attr('fill', item.color)
          .attr('opacity', 0.6)
          .attr('stroke', 'white')
          .attr('stroke-width', 1.5);
      } else {
        const star = d3.symbol().type(d3.symbolStar).size(100);
        legendG.append('path')
          .attr('d', star)
          .attr('fill', item.color)
          .attr('stroke', '#2c3e50')
          .attr('stroke-width', 2);
      }

      legendG.append('text')
        .attr('x', 12)
        .attr('y', 4)
        .style('font-size', '11px')
        .style('fill', '#2c3e50')
        .text(item.label);
    });

    // Color scale legend
    const colorLegend = svg.append('g')
      .attr('transform', `translate(${containerWidth - margin.right - 100}, ${margin.top - 30})`);

    const gradientId = 'rating-gradient';
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '100%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#e74c3c');
    gradient.append('stop').attr('offset', '50%').attr('stop-color', '#f39c12');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#27ae60');

    colorLegend.append('rect')
      .attr('width', 80)
      .attr('height', 12)
      .style('fill', `url(#${gradientId})`);

    colorLegend.append('text').attr('x', 0).attr('y', 24).style('font-size', '9px').style('fill', '#7f8c8d').text('0');
    colorLegend.append('text').attr('x', 80).attr('y', 24).attr('text-anchor', 'end').style('font-size', '9px').style('fill', '#7f8c8d').text('10');
    colorLegend.append('text').attr('x', 40).attr('y', -5).attr('text-anchor', 'middle').style('font-size', '10px').style('fill', '#2c3e50').text('Rating');
  };

  return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        {!isPreview && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 10,
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #d0d0d0',
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              color: '#2c3e50',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Year grouping</div>
            <select
              value={yearGrouping}
              onChange={(e) => setYearGrouping(e.target.value)}
              style={{
                width: 190,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid #cfcfcf',
                background: 'white',
                color: '#2c3e50',
                fontSize: 12,
              }}
            >
              <option value="all">All years (average)</option>
              <option value="individual">Individual years</option>
              <option value="5year">5-year groups</option>
            </select>
          </div>
        )}

        {/* Keep the ref on the element D3 draws into */}
        <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>
    );
};

export default TimeSeriesAnalysis;