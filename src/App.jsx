import { useEffect, useState } from 'react';
import Papa from 'papaparse';
import { FilterProvider } from './context/filterContext';
import FilterPanel from './components/FilterPanel';
import AirlineRatingHeatmap from './components/ParallelCoordinates';
import TimeSeriesAnalysis from './components/TimeSeries';
import PerformanceDistributionMatrix from './components/PerformanceDistributionMatrix';
import {
  processAirlineData,
  processAirportData,
  processLoungeData,
} from './utils/dataProcessor';
import './App.css';

function App() {
  const [airlineData, setAirlineData] = useState([]);
  const [airportData, setAirportData] = useState([]);
  const [loungeData, setLoungeData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusedView, setFocusedView] = useState(null);
  const [dimensionFilter, setDimensionFilter] = useState(null);

  useEffect(() => {
    let loadedCount = 0;
    const totalFiles = 3;

    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === totalFiles) setLoading(false);
    };

    // Files placed in: public/data/*.csv
    // Use BASE_URL so this works under /DVAssignment3/ on GitHub Pages.
    const csvUrl = (filename) => `${import.meta.env.BASE_URL}data/${filename}`;

    Papa.parse(csvUrl('airline.csv'), {
      download: true,
      header: true,
      complete: (results) => {
        try {
          const processed = processAirlineData(results.data);
          setAirlineData(processed);
        } catch (err) {
          console.error('Airline data error:', err);
          setError((prev) => prev ?? 'Failed to process airline.csv');
        }
        checkComplete();
      },
      error: (err) => {
        console.error('Airline CSV error:', err);
        setError((prev) => prev ?? 'Failed to load airline.csv');
        checkComplete();
      },
    });

    Papa.parse(csvUrl('airport.csv'), {
      download: true,
      header: true,
      complete: (results) => {
        try {
          const processed = processAirportData(results.data);
          setAirportData(processed);
        } catch (err) {
          console.error('Airport data error:', err);
          setError((prev) => prev ?? 'Failed to process airport.csv');
        }
        checkComplete();
      },
      error: (err) => {
        console.error('Airport CSV error:', err);
        setError((prev) => prev ?? 'Failed to load airport.csv');
        checkComplete();
      },
    });

    Papa.parse(csvUrl('lounge.csv'), {
      download: true,
      header: true,
      complete: (results) => {
        try {
          const processed = processLoungeData(results.data);
          setLoungeData(processed);
        } catch (err) {
          console.error('Lounge data error:', err);
          setError((prev) => prev ?? 'Failed to process lounge.csv');
        }
        checkComplete();
      },
      error: (err) => {
        console.error('Lounge CSV error:', err);
        setError((prev) => prev ?? 'Failed to load lounge.csv');
        checkComplete();
      },
    });
  }, []);

  const handleDimensionFilterChange = (filter) => {
    setDimensionFilter(filter);
    console.log('Dimension filter changed:', filter);
  };

  const handleBackToOverview = () => {
    setFocusedView(null);
    setDimensionFilter(null);
  };

  const handleCardClick = (view, e) => {
    if (
      e.target.closest('.cell-group') ||
      e.target.closest('rect[style*="cursor: pointer"]')
    ) {
      return;
    }
    setFocusedView(view);
  };

  if (loading)
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        Loading datasets...
      </div>
    );

  if (error)
    return (
      <div style={{ padding: '40px', color: 'red' }}>
        Error: {error}
      </div>
    );

  if (!airlineData || airlineData.length === 0)
    return <div style={{ padding: '40px' }}>No airline data loaded</div>;

  return (
    <FilterProvider>
      <div className={`App ${focusedView ? 'is-focused' : 'is-overview'}`}>
        <header>
          <div className="header-content">
            <div>
              <h1>SkyTrax Review Explorer</h1>
              <p>
                Interactive analysis of {airlineData.length.toLocaleString()} airline,{' '}
                {airportData.length.toLocaleString()} airport, and{' '}
                {loungeData.length.toLocaleString()} lounge reviews.
              </p>
            </div>

            {focusedView && (
              <button
                onClick={handleBackToOverview}
                style={{
                  padding: '10px 20px',
                  fontSize: '12px',
                  fontWeight: '600',
                  background: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => (e.target.style.background = '#7f8c8d')}
                onMouseLeave={(e) => (e.target.style.background = '#95a5a6')}
              >
                ← Back to Overview
              </button>
            )}
          </div>
        </header>

        {!focusedView && (
          <div
            className="dashboard-grid"
            style={{
              gridTemplateColumns: 'repeat(2, 1fr)',
              gridTemplateRows: '1fr 1fr',
            }}
          >
            <div className="dashboard-card" onClick={(e) => handleCardClick('parallel', e)}>
              <div className="card-content">
                <AirlineRatingHeatmap
                  data={airlineData}
                  dimensionFilter={dimensionFilter}
                  isPreview={true}
                />
              </div>
            </div>

            <div className="dashboard-card" onClick={(e) => handleCardClick('timeseries', e)}>
              <div className="card-content">
                <TimeSeriesAnalysis
                  airlineData={airlineData}
                  airportData={airportData}
                  loungeData={loungeData}
                  dimensionFilter={dimensionFilter}
                  isPreview={true}
                />
              </div>
            </div>

            <div
              className="dashboard-card"
              style={{ gridColumn: '1 / -1', position: 'relative', cursor: 'default' }}
            >
              <div className="card-content" style={{ pointerEvents: 'auto' }}>
                <PerformanceDistributionMatrix
                  airlineData={airlineData}
                  airportData={airportData}
                  loungeData={loungeData}
                  onFilterChange={handleDimensionFilterChange}
                  isPreview={true}
                />
              </div>
            </div>
          </div>
        )}

        {focusedView && (
          <div className="focused-view-container">
            <div className="filter-and-viz">
              {focusedView === 'parallel' && (
                <FilterPanel data={airlineData} activeView={focusedView} />
              )}

              <div
                className={`main-visualization ${
                  focusedView === 'matrix' || focusedView === 'timeseries' ? 'full-width' : ''
                }`}
              >
                {focusedView === 'parallel' && (
                  <AirlineRatingHeatmap
                    data={airlineData}
                    dimensionFilter={dimensionFilter}
                    isPreview={false}
                  />
                )}

                {focusedView === 'timeseries' && (
                  <TimeSeriesAnalysis
                    airlineData={airlineData}
                    airportData={airportData}
                    loungeData={loungeData}
                    dimensionFilter={dimensionFilter}
                    isPreview={false}
                  />
                )}

                {focusedView === 'matrix' && (
                  <PerformanceDistributionMatrix
                    airlineData={airlineData}
                    airportData={airportData}
                    loungeData={loungeData}
                    onFilterChange={handleDimensionFilterChange}
                    isPreview={false}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </FilterProvider>
  );
}

export default App;
