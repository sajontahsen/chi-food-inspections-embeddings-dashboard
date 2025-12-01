import { useEffect, useRef, useState, useMemo } from 'react';
import embed from 'vega-embed';

const FacilityTypeChart = ({ data, selectedCommunity }) => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 250 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: Math.max(width - 40, 400),
          height: Math.max(height - 20, 200),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Compute failure distribution by facility type (top 10)
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Filter by selected community if any
    let filteredData = data;
    if (selectedCommunity) {
      filteredData = data.filter((d) => d.community_name === selectedCommunity);
    }

    // Filter only failures (Results === 'Fail')
    const failures = filteredData.filter((d) => d.Results === 'Fail');

    if (failures.length === 0) return [];

    // Count by facility type
    const counts = {};
    failures.forEach((d) => {
      const type = d.Facility_Type || 'Unknown';
      counts[type] = (counts[type] || 0) + 1;
    });

    // Convert to array and sort by count descending, take top 10
    const result = Object.entries(counts)
      .map(([facilityType, count]) => ({ facilityType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return result;
  }, [data, selectedCommunity]);

  // Create and update Vega-Lite visualization
  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous view if it exists
    if (viewRef.current) {
      viewRef.current.finalize();
      viewRef.current = null;
    }

    // Clear the container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
    }

    if (chartData.length === 0) return;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: dimensions.width,
      height: dimensions.height,
      autosize: { type: 'fit', contains: 'padding' },
      data: { values: chartData },
      mark: {
        type: 'bar',
        cornerRadiusTopRight: 4,
        cornerRadiusBottomRight: 4,
        color: '#F56565',
      },
      encoding: {
        y: {
          field: 'facilityType',
          type: 'nominal',
          axis: {
            title: null,
            labelLimit: 200,
          },
          sort: '-x',
        },
        x: {
          field: 'count',
          type: 'quantitative',
          axis: {
            title: 'Number of Failed Inspections',
            grid: true,
            gridOpacity: 0.3,
          },
        },
        tooltip: [
          { field: 'facilityType', title: 'Facility Type' },
          { field: 'count', title: 'Failed Inspections' },
        ],
      },
      config: {
        background: 'transparent',
        view: { stroke: null },
      },
    };

    const embedChart = async () => {
      try {
        const result = await embed(containerRef.current, spec, {
          actions: false,
          renderer: 'canvas',
        });
        viewRef.current = result.view;
      } catch (err) {
        console.error('Error embedding facility chart:', err);
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
  }, [chartData, dimensions]);

  return (
    <div className="vega-container" ref={containerRef} style={{ position: 'relative' }}>
      {chartData.length === 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#718096',
          }}
        >
          No failed inspections in current selection
        </div>
      )}
    </div>
  );
};

export default FacilityTypeChart;
