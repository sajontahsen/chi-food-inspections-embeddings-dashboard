import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import embed from 'vega-embed';

const ChicagoMap = ({
  geoData,
  inspectionData,
  selectedCommunity,
  onCommunitySelect,
}) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 400 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(width - 20, 300),
          height: Math.max(height - 20, 300),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Compute community statistics from inspection data
  const communityStats = useMemo(() => {
    if (!inspectionData || inspectionData.length === 0) return {};

    const stats = {};
    inspectionData.forEach((d) => {
      const community = d.community_name;
      if (!community || community === 'Unknown') return;

      if (!stats[community]) {
        stats[community] = {
          total: 0,
          critical: 0,
          passed: 0,
        };
      }
      stats[community].total += 1;
      stats[community].critical += d.criticalFound || 0;
      stats[community].passed += d.pass_flag || 0;
    });

    // Calculate rates
    Object.keys(stats).forEach((community) => {
      const s = stats[community];
      s.criticalRate = s.total > 0 ? (s.critical / s.total) * 100 : 0;
      s.passRate = s.total > 0 ? (s.passed / s.total) * 100 : 0;
    });

    return stats;
  }, [inspectionData]);

  // Prepare GeoJSON with stats
  const geoDataWithStats = useMemo(() => {
    if (!geoData) return null;

    const features = geoData.features.map((feature) => {
      const communityName = feature.properties.community_name;
      const stats = communityStats[communityName] || {
        total: 0,
        critical: 0,
        criticalRate: 0,
        passRate: 0,
      };

      return {
        ...feature,
        properties: {
          ...feature.properties,
          ...stats,
          isSelected: communityName === selectedCommunity,
        },
      };
    });

    return { ...geoData, features };
  }, [geoData, communityStats, selectedCommunity]);

  // Memoize click handler
  const handleClick = useCallback(
    (_, item) => {
      if (item && item.datum && item.datum.properties) {
        onCommunitySelect(item.datum.properties.community_name);
      }
    },
    [onCommunitySelect]
  );

  // Create and update Vega-Lite visualization
  useEffect(() => {
    if (!containerRef.current || !geoDataWithStats) return;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: dimensions.width,
      height: dimensions.height,
      autosize: { type: 'fit', contains: 'padding' },
      data: {
        values: geoDataWithStats,
        format: { type: 'json', property: 'features' },
      },
      projection: { type: 'mercator' },
      params: [
        {
          name: 'highlight',
          select: { type: 'point', on: 'pointerover' },
        },
      ],
      mark: {
        type: 'geoshape',
        stroke: '#fff',
        strokeWidth: 1,
        cursor: 'pointer',
      },
      encoding: {
        color: {
          field: 'properties.criticalRate',
          type: 'quantitative',
          scale: {
            scheme: 'reds',
            domain: [0, 30],
          },
          legend: {
            title: 'Critical Rate (%)',
            orient: 'bottom-right',
          },
        },
        opacity: {
          condition: {
            test: selectedCommunity
              ? `datum.properties.community_name === '${selectedCommunity}'`
              : 'false',
            value: 1,
          },
          value: selectedCommunity ? 0.4 : 0.8,
        },
        strokeWidth: {
          condition: [
            { param: 'highlight', empty: false, value: 2 },
            {
              test: selectedCommunity
                ? `datum.properties.community_name === '${selectedCommunity}'`
                : 'false',
              value: 3,
            },
          ],
          value: 1,
        },
        stroke: {
          condition: {
            test: selectedCommunity
              ? `datum.properties.community_name === '${selectedCommunity}'`
              : 'false',
            value: '#2563eb',
          },
          value: '#fff',
        },
        tooltip: [
          { field: 'properties.community_name', title: 'Community' },
          { field: 'properties.total', title: 'Total Inspections' },
          { field: 'properties.critical', title: 'Critical Violations' },
          {
            field: 'properties.criticalRate',
            title: 'Critical Rate (%)',
            format: '.1f',
          },
          {
            field: 'properties.passRate',
            title: 'Pass Rate (%)',
            format: '.1f',
          },
        ],
      },
      config: {
        background: 'transparent',
        view: { stroke: null },
      },
    };

    // Clean up previous view if it exists
    if (viewRef.current) {
      viewRef.current.finalize();
      viewRef.current = null;
    }

    // Clear the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    const embedChart = async () => {
      try {
        const result = await embed(containerRef.current, spec, {
          actions: false,
          renderer: 'canvas',
        });

        viewRef.current = result.view;

        // Listen for click selection
        result.view.addEventListener('click', handleClick);
      } catch (err) {
        console.error('Error embedding map:', err);
      }
    };

    embedChart();

    // Cleanup function
    return () => {
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }
    };
  }, [geoDataWithStats, dimensions, selectedCommunity, handleClick]);

  if (!geoData) {
    return (
      <div className="vega-container">
        <p>Loading map data...</p>
      </div>
    );
  }

  return <div className="vega-container" ref={containerRef}></div>;
};

export default ChicagoMap;
