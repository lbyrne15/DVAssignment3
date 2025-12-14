import { createContext, useContext, useState } from 'react';

const filterContext = createContext();

export const FilterProvider = ({ children }) => {
  const [filters, setFilters] = useState({
    selectedAirlines: [],
    selectedCountries: [],
    dateRange: null,
    ratingRange: [0, 10]
  });

  const [processedData, setProcessedData] = useState(null);

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      selectedAirlines: [],
      selectedCountries: [],
      dateRange: null,
      ratingRange: [0, 10]
    });
  };

  return (
    <filterContext.Provider value={{
      filters,
      updateFilter,
      resetFilters,
      processedData,
      setProcessedData
    }}>
      {children}
    </filterContext.Provider>
  );
};

export const useFilters = () => useContext(filterContext);
