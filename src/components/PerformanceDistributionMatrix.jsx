import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const PerformanceDistributionMatrix = ({ 
  airlineData, 
  airportData, 
  loungeData, 
  onFilterChange,
  isPreview = false 
}) => {
  const svgRef = useRef();
  const [selectedDimension, setSelectedDimension] = useState(null);

  useEffect(() => {
    if (!airlineData || !airportData || !loungeData || !svgRef.current) return;
    drawDimensionCards();
  }, [airlineData, airportData, loungeData, selectedDimension, isPreview]);

  const getDimensionMetrics = () => {
    const dimensions = [
      { 
        label: 'Comfort', 
        key: 'comfort',
        fields: {
          airline: { field: 'seat_comfort_rating', multiplier: 2 },
          airport: null,
          lounge: { field: 'comfort_rating', multiplier: 1 }
        }
      },
      { 
        label: 'Staff', 
        key: 'staff',
        fields: {
          airline: { field: 'cabin_staff_rating', multiplier: 2 },
          airport: { field: 'airport_staff_rating', multiplier: 1 },
          lounge: { field: 'staff_service_rating', multiplier: 1 }
        }
      },
      { 
        label: 'Food', 
        key: 'food',
        fields: {
          airline: { field: 'food_beverages_rating', multiplier: 2 },
          airport: { field: 'food_beverages_rating', multiplier: 1 },
          lounge: { field: 'catering_rating', multiplier: 1 }
        }
      },
      { 
        label: 'Clean', 
        key: 'cleanliness',
        fields: {
          airline: null,
          airport: { field: 'terminal_cleanliness_rating', multiplier: 1 },
          lounge: { field: 'cleanliness_rating', multiplier: 1 }
        }
      },
      { 
        label: 'Overall', 
        key: 'overall',
        fields: {
          airline: { field: 'overall_rating', multiplier: 1 },
          airport: { field: 'overall_rating', multiplier: 1 },
          lounge: { field: 'overall_rating', multiplier: 1 }
        }
      }
    ];

    const dataMap = { airline: airlineData, airport: airportData, lounge: loungeData };
    const entityColors = { airline: '#3498db', airport: '#27ae60', lounge: '#e67e22' };
    const entityLabels = { airline: 'Airlines', airport: 'Airports', lounge: 'Lounges' };

    return dimensions.map(dim => {
      const entityAverages = [];

      ['airline', 'airport', 'lounge'].forEach(entity => {
        const fieldConfig = dim.fields[entity];
        if (!fieldConfig) {
          entityAverages.push({
            entity,
            label: entityLabels[entity],
            average: null,
            count: 0,
            color: entityColors[entity]
          });
          return;
        }

        const data = dataMap[entity];
        const validRatings = data
          .map(d => d[fieldConfig.field])
          .filter(r => r != null && r > 0)
          .map(r => r * fieldConfig.multiplier);

        entityAverages.push({
          entity,
          label: entityLabels[entity],
          average: validRatings.length > 0 ? d3.mean(validRatings) : null,
          count: validRatings.length,
          color: entityColors[entity],
          field: fieldConfig.field
        });
      });

      const hasData = entityAverages.some(e => e.average !== null);

      return {
        ...dim,
        entityAverages,
        hasData
      };
    });
  };

  const handleDimensionClick = (dimension) => {
    const newDimension = selectedDimension?.key === dimension.key ? null : dimension;
    setSelectedDimension(newDimension);

    if (onFilterChange) {
      if (newDimension) {
        onFilterChange({
          dimension: newDimension.label,
          dimensionKey: newDimension.key,
          fields: newDimension.fields,
          entityAverages: newDimension.entityAverages
        });
      } else {
        onFilterChange(null);
      }
    }
  };

  const drawDimensionCards = () => {
    const containerWidth = svgRef.current.clientWidth;
    const containerHeight = svgRef.current.clientHeight;
    const margin = isPreview 
      ? { top: 50, right: 20, bottom: 20, left: 20 }
      : { top: 70, right: 30, bottom: 30, left: 30 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3.select(svgRef.current)
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const dimensions = getDimensionMetrics();
    const cols = 5;
    const rows = Math.ceil(dimensions.length / cols);
    const cardWidth = width / cols;
    const cardHeight = height / rows;
    const cardPadding = isPreview ? 6 : 10;

    dimensions.forEach((dim, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const x = col * cardWidth;
      const y = row * cardHeight;

      const isSelected = selectedDimension?.key === dim.key;

      const cardG = g.append('g')
        .attr('transform', `translate(${x},${y})`)
        .style('cursor', dim.hasData ? 'pointer' : 'not-allowed')
        .on('click', function() {
          if (dim.hasData) {
            handleDimensionClick(dim);
          }
        });

      // Card background
      cardG.append('rect')
        .attr('x', cardPadding)
        .attr('y', cardPadding)
        .attr('width', cardWidth - cardPadding * 2)
        .attr('height', cardHeight - cardPadding * 2)
        .attr('fill', isSelected ? '#e3f2fd' : 'white')
        .attr('stroke', isSelected ? '#2196f3' : '#e0e0e0')
        .attr('stroke-width', isSelected ? 3 : 1.5)
        .attr('rx', 8)
        .on('mouseover', function() {
          if (dim.hasData && !isSelected) {
            d3.select(this)
              .attr('fill', '#f5f5f5')
              .attr('stroke', '#2196f3')
              .attr('stroke-width', 2);
          }
        })
        .on('mouseout', function() {
          if (!isSelected) {
            d3.select(this)
              .attr('fill', 'white')
              .attr('stroke', '#e0e0e0')
              .attr('stroke-width', 1.5);
          }
        });

      if (dim.hasData) {
        // Icon
        cardG.append('text')
          .attr('x', cardWidth / 2)
          .attr('y', cardPadding + 20)
          .attr('text-anchor', 'middle')
          .style('font-size', isPreview ? '18px' : '24px')
          .style('pointer-events', 'none')
          .text(dim.icon);

        // Dimension label
        cardG.append('text')
          .attr('x', cardWidth / 2)
          .attr('y', cardPadding + (isPreview ? 38 : 48))
          .attr('text-anchor', 'middle')
          .style('font-size', isPreview ? '10px' : '12px')
          .style('font-weight', isSelected ? 'bold' : '600')
          .style('fill', isSelected ? '#2196f3' : '#2c3e50')
          .style('pointer-events', 'none')
          .text(dim.label);

        // Mini bar chart showing entity averages
        const barAreaY = cardPadding + (isPreview ? 50 : 65);
        const barAreaHeight = cardHeight - barAreaY - cardPadding - 5;
        const barWidth = (cardWidth - cardPadding * 2 - 10) / 3;
        const barScale = d3.scaleLinear()
          .domain([0, 10])
          .range([0, barAreaHeight]);

        dim.entityAverages.forEach((entity, i) => {
          const barX = cardPadding + 5 + i * barWidth;
          
          if (entity.average !== null) {
            const barHeight = barScale(entity.average);
            const barY = barAreaY + barAreaHeight - barHeight;

            // Bar
            cardG.append('rect')
              .attr('x', barX)
              .attr('y', barY)
              .attr('width', barWidth - 4)
              .attr('height', barHeight)
              .attr('fill', entity.color)
              .attr('opacity', 0.7)
              .attr('rx', 2)
              .style('pointer-events', 'none');

            // Value label on bar (always show)
            cardG.append('text')
              .attr('x', barX + (barWidth - 4) / 2)
              .attr('y', barY - 3)
              .attr('text-anchor', 'middle')
              .style('font-size', isPreview ? '9px' : '10px')
              .style('font-weight', 'bold')
              .style('fill', entity.color)
              .style('pointer-events', 'none')
              .text(entity.average.toFixed(1));
          }
        });

      } else {
        // No data available
        cardG.append('text')
          .attr('x', cardWidth / 2)
          .attr('y', cardHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '10px')
          .style('fill', '#bdc3c7')
          .style('font-style', 'italic')
          .style('pointer-events', 'none')
          .text('No data');
      }
    });

    // Title
    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', isPreview ? '12px' : '16px')
      .style('font-weight', 'bold')
      .style('fill', '#2c3e50')
      .text('Dimension Selector');

    svg.append('text')
      .attr('x', containerWidth / 2)
      .attr('y', isPreview ? 35 : 40)
      .attr('text-anchor', 'middle')
      .style('font-size', isPreview ? '9px' : '11px')
      .style('fill', '#7f8c8d')
      .text('Click any dimension to update both visualizations above');

    // Active filter indicator
    if (selectedDimension) {
      svg.append('text')
        .attr('x', 15)
        .attr('y', containerHeight - 10)
        .style('font-size', '11px')
        .style('font-weight', 'bold')
        .style('fill', '#2196f3')
        .text(`Active: ${selectedDimension.label} ratings`);

      // Reset button
      if (!isPreview) {
        const resetButton = svg.append('g')
          .attr('transform', `translate(${containerWidth - 100}, 15)`)
          .style('cursor', 'pointer')
          .on('click', function() {
            setSelectedDimension(null);
            if (onFilterChange) {
              onFilterChange(null);
            }
          });

        resetButton.append('rect')
          .attr('width', 85)
          .attr('height', 28)
          .attr('fill', '#e74c3c')
          .attr('rx', 5)
          .on('mouseover', function() {
            d3.select(this).attr('fill', '#c0392b');
          })
          .on('mouseout', function() {
            d3.select(this).attr('fill', '#e74c3c');
          });

        resetButton.append('text')
          .attr('x', 42.5)
          .attr('y', 14)
          .attr('text-anchor', 'middle')
          .attr('dy', '0.35em')
          .style('font-size', '11px')
          .style('font-weight', 'bold')
          .style('fill', 'white')
          .style('pointer-events', 'none')
          .text('Reset');
      }
    }

    // Legend (entity colors)
    const legendY = containerHeight - (isPreview ? 5 : 8);
    const legendSpacing = 80;
    const legendStartX = containerWidth / 2 - legendSpacing * 1.5;

    const entities = [
      { name: 'Airlines', color: '#3498db' },
      { name: 'Airports', color: '#27ae60' },
      { name: 'Lounges', color: '#e67e22' }
    ];

    entities.forEach((entity, i) => {
      const x = legendStartX + i * legendSpacing;

      svg.append('rect')
        .attr('x', x)
        .attr('y', legendY - 6)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', entity.color)
        .attr('opacity', 0.7)
        .attr('rx', 2);

      svg.append('text')
        .attr('x', x + 16)
        .attr('y', legendY)
        .attr('dy', '0.35em')
        .style('font-size', isPreview ? '9px' : '10px')
        .style('fill', '#7f8c8d')
        .text(entity.name);
    });
  };

  return (
    <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
  );
};

export default PerformanceDistributionMatrix;
