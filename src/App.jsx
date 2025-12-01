import { useState, useEffect, useMemo } from 'react';
import EmbeddingScatter from './components/EmbeddingScatter';
import ChicagoMap from './components/ChicagoMap';
import FacilityTypeChart from './components/FacilityTypeChart';
import TemporalChart from './components/TemporalChart';
import './App.css';

function App() {
  // Data states for all embedding sources
  const [violationsTsneData, setViolationsTsneData] = useState([]);
  const [violationsUmapData, setViolationsUmapData] = useState([]);
  const [directTsneData, setDirectTsneData] = useState([]);
  const [mlpTsneData, setMlpTsneData] = useState([]);
  const [geoData, setGeoData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Embedding source selection (default to violations UMAP - the primary/newest)
  const [embeddingSource, setEmbeddingSource] = useState('violations_umap');

  // Selection state for linked views
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  // Slider for filtering by number of inspections
  const [maxInspections, setMaxInspections] = useState(5000);

  // Color mode for embedding scatter plot
  const [colorMode, setColorMode] = useState('passFlag');

  // Get current inspection data based on selected embedding source
  const inspectionData = useMemo(() => {
    switch (embeddingSource) {
      case 'violations_tsne':
        return violationsTsneData;
      case 'violations_umap':
        return violationsUmapData;
      case 'direct':
        return directTsneData;
      case 'mlp':
        return mlpTsneData;
      default:
        return violationsUmapData;
    }
  }, [embeddingSource, violationsTsneData, violationsUmapData, directTsneData, mlpTsneData]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        // Load all embedding CSV files in parallel
        const [violationsTsneResponse, violationsUmapResponse, directResponse, mlpResponse, geoResponse] = await Promise.all([
          fetch('data/tsne_violations_with_community.csv'),
          fetch('data/umap_violations_with_community.csv'),
          fetch('data/tsne_direct_with_community.csv'),
          fetch('data/tsne_mlp_with_community.csv'),
          fetch('data/chicago_communities.geojson'),
        ]);

        const [violationsTsneText, violationsUmapText, directText, mlpText, geoJson] = await Promise.all([
          violationsTsneResponse.text(),
          violationsUmapResponse.text(),
          directResponse.text(),
          mlpResponse.text(),
          geoResponse.json(),
        ]);

        const violationsTsneData = parseCSV(violationsTsneText);
        const violationsUmapData = parseCSV(violationsUmapText);
        const directData = parseCSV(directText);
        const mlpData = parseCSV(mlpText);

        setViolationsTsneData(violationsTsneData);
        setViolationsUmapData(violationsUmapData);
        setDirectTsneData(directData);
        setMlpTsneData(mlpData);
        setGeoData(geoJson);
        setLoading(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Parse CSV to array of objects
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');

    return lines.slice(1).map((line) => {
      const values = parseCSVLine(line);
      const obj = {};
      headers.forEach((header, i) => {
        const value = values[i];
        // Convert numeric fields
        if (
          [
            'Inspection_ID',
            'License',
            'Latitude',
            'Longitude',
            'criticalFound',
            'pass_flag',
            'fail_flag',
            'criticalCount',
            'seriousCount',
            'minorCount',
            'tsne_x',
            'tsne_y',
            'area_num',
          ].includes(header)
        ) {
          obj[header] = parseFloat(value) || 0;
        } else {
          obj[header] = value;
        }
      });
      return obj;
    });
  };

  // Handle CSV fields with commas inside quotes
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  // Filter data based on slider and selection
  const filteredData = useMemo(() => {
    // Sort by date descending and take latest N
    const sorted = [...inspectionData].sort(
      (a, b) => new Date(b.Inspection_Date) - new Date(a.Inspection_Date)
    );
    let filtered = sorted.slice(0, maxInspections);

    // Filter by selected community if any
    if (selectedCommunity) {
      filtered = filtered.filter(
        (d) => d.community_name === selectedCommunity
      );
    }

    return filtered;
  }, [inspectionData, maxInspections, selectedCommunity]);

  // Handle community selection from map or scatter plot click
  const handleCommunitySelect = (communityName) => {
    setSelectedCommunity(
      communityName === selectedCommunity ? null : communityName
    );
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedCommunity(null);
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading Chicago Food Inspection Data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <p>Make sure to run the preprocessing script first:</p>
        <code>python scripts/preprocess_data.py</code>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Chicago Food Inspection Embedding Explorer</h1>
        <p className="subtitle">
          Analyzing {filteredData.length.toLocaleString()} food inspections
        </p>
      </header>

      <div className="controls">
        <div className="embedding-source-control">
          <label htmlFor="embedding-source">Embedding Source:</label>
          <select
            id="embedding-source"
            value={embeddingSource}
            onChange={(e) => {
              setEmbeddingSource(e.target.value);
              setSelectedCommunity(null);
            }}
          >
            <option value="violations_umap">Violations Text (UMAP)</option>
            <option value="violations_tsne">Violations Text (t-SNE)</option>
            <option value="direct">Feature-based (t-SNE)</option>
            <option value="mlp">MLP Hidden Layer (t-SNE)</option>
          </select>
        </div>

        <div className="slider-control">
          <label htmlFor="inspection-slider">
            Show latest inspections: {Math.min(maxInspections, inspectionData.length).toLocaleString()} / {inspectionData.length.toLocaleString()}
          </label>
          <input
            id="inspection-slider"
            type="range"
            min="500"
            max={inspectionData.length || 8000}
            step="500"
            value={Math.min(maxInspections, inspectionData.length)}
            onChange={(e) => setMaxInspections(parseInt(e.target.value))}
          />
        </div>

        <div className="color-mode-control">
          <label>Color by:</label>
          <div className="button-group">
            <button
              className={colorMode === 'criticalFound' ? 'active' : ''}
              onClick={() => setColorMode('criticalFound')}
            >
              Critical Violation
            </button>
            <button
              className={colorMode === 'passFlag' ? 'active' : ''}
              onClick={() => setColorMode('passFlag')}
            >
              Pass/Fail
            </button>
            <button
              className={colorMode === 'results' ? 'active' : ''}
              onClick={() => setColorMode('results')}
            >
              Results
            </button>
          </div>
        </div>

        {selectedCommunity && (
          <button className="clear-btn" onClick={clearSelection}>
            Clear Selection
          </button>
        )}

        {selectedCommunity && (
          <span className="selection-badge">
            Selected: {selectedCommunity}
          </span>
        )}
      </div>

      <div className="dashboard">
        <div className="main-views">
          <div className="view-container scatter-container">
            <h2>Embedding Space</h2>
            <EmbeddingScatter
              data={filteredData}
              onPointClick={handleCommunitySelect}
              selectedCommunity={selectedCommunity}
              colorMode={colorMode}
            />
          </div>

          <div className="view-container map-container">
            <h2>Chicago Community Areas</h2>
            <ChicagoMap
              geoData={geoData}
              inspectionData={filteredData}
              selectedCommunity={selectedCommunity}
              onCommunitySelect={handleCommunitySelect}
            />
          </div>
        </div>

        <div className="secondary-views">
          <div className="view-container chart-container">
            <h2>
              Failed Inspections by Facility Type
              {selectedCommunity && ` - ${selectedCommunity}`}
            </h2>
            <FacilityTypeChart
              data={filteredData}
              selectedCommunity={selectedCommunity}
            />
          </div>
          <div className="view-container chart-container">
            <h2>Peak Failure Rate per Quarter</h2>
            <TemporalChart />
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>
          Data source:{' '}
          <a
            href="https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5"
            target="_blank"
            rel="noopener noreferrer"
          >
            Chicago Data Portal - Food Inspections
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
