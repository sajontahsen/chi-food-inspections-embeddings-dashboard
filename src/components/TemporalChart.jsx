import { useEffect, useRef, useState } from 'react';
import embed from 'vega-embed';

const TemporalChart = () => {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [chartData, setChartData] = useState([]);
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

  // Load precomputed quarterly data
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/data/quarterly_failure_rates.json');
        const data = await response.json();
        setChartData(data);
      } catch (err) {
        console.error('Error loading quarterly data:', err);
      }
    };
    loadData();
  }, []);

  // Create Vega-Lite visualization
  useEffect(() => {
    if (!containerRef.current || chartData.length === 0) return;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: dimensions.width,
      height: dimensions.height,
      autosize: { type: 'fit', contains: 'padding' },
      data: { values: chartData },
      layer: [
        {
          mark: {
            type: 'line',
            strokeWidth: 2,
            color: '#95a5a6',
          },
          encoding: {
            x: {
              field: 'Year-Quarter',
              type: 'ordinal',
              sort: null,
              axis: {
                title: 'Quarter',
                labelAngle: -45,
                labelFontSize: 9,
              },
            },
            y: {
              field: 'Failure_Rate',
              type: 'quantitative',
              axis: {
                title: 'Max Failure Rate (%)',
                titleFontSize: 11,
              },
              scale: { domain: [0, 35] },
            },
          },
        },
        {
          mark: {
            type: 'point',
            size: 100,
            filled: true,
            strokeWidth: 1,
            stroke: 'white',
          },
          encoding: {
            x: {
              field: 'Year-Quarter',
              type: 'ordinal',
              sort: null,
            },
            y: {
              field: 'Failure_Rate',
              type: 'quantitative',
            },
            color: {
              field: 'Facility_Type',
              type: 'nominal',
              scale: { scheme: 'tableau10' },
              legend: {
                title: 'Worst Performer',
                orient: 'bottom',
                columns: 2,
                labelFontSize: 9,
                titleFontSize: 10,
              },
            },
            tooltip: [
              { field: 'Year-Quarter', title: 'Quarter' },
              { field: 'Facility_Type', title: 'Worst Performing' },
              { field: 'Failure_Rate', title: 'Max Failure Rate (%)', format: '.1f' },
              { field: 'Failures', title: 'Failures' },
              { field: 'Total', title: 'Inspections' },
            ],
          },
        },
      ],
      config: {
        background: 'transparent',
        view: { stroke: null },
      },
    };

    // Clean up previous view
    if (viewRef.current) {
      viewRef.current.finalize();
      viewRef.current = null;
    }

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
      } catch (err) {
        console.error('Error embedding temporal chart:', err);
      }
    };

    embedChart();

    return () => {
      if (viewRef.current) {
        viewRef.current.finalize();
        viewRef.current = null;
      }
    };
  }, [chartData, dimensions]);

  if (chartData.length === 0) {
    return (
      <div className="vega-container">
        <p>Loading temporal data...</p>
      </div>
    );
  }

  return <div className="vega-container" ref={containerRef}></div>;
};

export default TemporalChart;
