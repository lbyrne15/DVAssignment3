import { useState, useEffect } from 'react';
import { useFilters } from '../context/filterContext';
import * as d3 from 'd3';

const FilterPanel = ({ data }) => {
  const { filters, updateFilter, resetFilters } = useFilters();
  const [airlines, setAirlines] = useState([]);

  useEffect(() => {
    if (!data || data.length === 0) return;

    const airlineCounts = d3.rollup(
      data,
      v => v.length,
      d => d.airline_name
    );
    
    const topAirlines = Array.from(airlineCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(d => ({ name: d[0], count: d[1] }));
    
    setAirlines(topAirlines);
  }, [data]);

  const handleAirlineToggle = (airline) => {
    const current = filters.selectedAirlines;
    const updated = current.includes(airline)
      ? current.filter(a => a !== airline)
      : [...current, airline];
    updateFilter('selectedAirlines', updated);
  };

  const handleSelectAll = () => {
    updateFilter('selectedAirlines', airlines.map(a => a.name));
  };

  const handleClearAll = () => {
    updateFilter('selectedAirlines', []);
  };

  return (
    <div className="filter-panel">
      <h2 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#2c3e50' }}>
        Filters
      </h2>
      
      <button 
        onClick={resetFilters}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '15px',
          background: '#e74c3c',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 'bold'
        }}
      >
        Reset All Filters
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ 
          fontSize: '14px', 
          marginBottom: '10px',
          color: '#2c3e50',
          fontWeight: 'bold'
        }}>
          Airlines
          <span style={{ 
            fontSize: '11px', 
            color: '#7f8c8d', 
            marginLeft: '5px',
            fontWeight: 'normal'
          }}>
            ({filters.selectedAirlines.length} selected)
          </span>
        </h3>
        
        <div style={{ marginBottom: '10px', display: 'flex', gap: '5px' }}>
          <button onClick={handleSelectAll} style={smallButtonStyle}>
            Select All
          </button>
          <button onClick={handleClearAll} style={smallButtonStyle}>
            Clear
          </button>
        </div>

        <div style={{ 
          maxHeight: '500px', 
          overflowY: 'auto',
          overflowX: 'hidden'
        }}>
          {airlines.map(airline => (
            <label 
              key={airline.name}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                padding: '8px 6px',
                cursor: 'pointer',
                fontSize: '11px',
                borderRadius: '4px',
                marginBottom: '3px',
                background: filters.selectedAirlines.includes(airline.name) 
                  ? '#3498db20' 
                  : 'transparent',
                border: filters.selectedAirlines.includes(airline.name)
                  ? '1px solid #3498db'
                  : '1px solid transparent',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!filters.selectedAirlines.includes(airline.name)) {
                  e.currentTarget.style.background = '#f8f9fa';
                }
              }}
              onMouseLeave={(e) => {
                if (!filters.selectedAirlines.includes(airline.name)) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <input
                type="checkbox"
                checked={filters.selectedAirlines.includes(airline.name)}
                onChange={() => handleAirlineToggle(airline.name)}
                style={{ 
                  marginRight: '8px',
                  marginTop: '2px',
                  flexShrink: 0
                }}
              />
              <span style={{ 
                flex: 1,
                color: '#2c3e50',
                fontWeight: '500',
                lineHeight: '1.3',
                wordBreak: 'break-word'
              }}>
                {airline.name}
              </span>
              <span style={{ 
                color: '#95a5a6', 
                fontSize: '10px',
                marginLeft: '8px',
                flexShrink: 0,
                fontWeight: 'bold'
              }}>
                {airline.count}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div style={{ 
        padding: '12px', 
        background: '#ecf0f1', 
        borderRadius: '6px',
        fontSize: '12px',
        color: '#2c3e50'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
          Dataset Statistics
        </div>
        <div style={{ color: '#7f8c8d' }}>
          Total Reviews: {data.length.toLocaleString()}
        </div>
        <div style={{ color: '#7f8c8d' }}>
          Airlines: {airlines.length}
        </div>
      </div>
    </div>
  );
};

const smallButtonStyle = {
  flex: 1,
  padding: '6px 8px',
  fontSize: '11px',
  background: '#3498db',
  color: 'white',
  border: 'none',
  borderRadius: '3px',
  cursor: 'pointer',
  fontWeight: 'bold',
  transition: 'background 0.2s'
};

export default FilterPanel;
