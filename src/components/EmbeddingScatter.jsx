import { useEffect, useRef, useState, useMemo } from 'react';
import embed from 'vega-embed';

const EmbeddingScatter = ({ data, onPointClick, selectedCommunity, colorMode }) => {
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

  // Get color encoding based on colorMode
  const getColorEncoding = useMemo(() => {
    const baseEncoding = {
      criticalFound: {
        field: 'criticalFound',
        type: 'nominal',
        scale: {
          domain: [0, 1],
          range: ['#48BB78', '#F56565'],
        },
        legend: {
          title: 'Critical Violation',
          labelExpr: "datum.value == 0 ? 'No' : 'Yes'",
          orient: 'bottom-right',
        },
      },
      passFlag: {
        field: 'pass_flag',
        type: 'nominal',
        scale: {
          domain: [0, 1],
          range: ['#F56565', '#48BB78'],
        },
        legend: {
          title: 'Inspection Outcome',
          labelExpr: "datum.value == 0 ? 'Failed' : 'Passed'",
          orient: 'bottom-right',
        },
      },
      results: {
        field: 'Results',
        type: 'nominal',
        scale: {
          domain: ['Pass', 'Fail', 'Pass w/ Conditions', 'No Entry', 'Not Ready', 'Out of Business'],
          range: ['#48BB78', '#F56565', '#ECC94B', '#A0AEC0', '#9F7AEA', '#718096'],
        },
        legend: {
          title: 'Result',
          orient: 'bottom-right',
        },
      },
    };

    return baseEncoding[colorMode] || baseEncoding.criticalFound;
  }, [colorMode]);

  // Create and update Vega-Lite visualization
  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const spec = {
      $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
      width: dimensions.width,
      height: dimensions.height,
      autosize: { type: 'fit', contains: 'padding' },
      data: { values: data },
      params: [
        {
          name: 'highlight',
          select: {
            type: 'point',
            on: 'pointerover',
            clear: 'pointerout',
          },
        },
      ],
      mark: {
        type: 'circle',
        stroke: '#333',
        strokeWidth: 0.5,
        cursor: 'pointer',
      },
      encoding: {
        x: {
          field: 'tsne_x',
          type: 'quantitative',
          scale: { zero: false },
          axis: {
            title: 't-SNE Dimension 1',
            grid: true,
            gridOpacity: 0.3,
          },
        },
        y: {
          field: 'tsne_y',
          type: 'quantitative',
          scale: { zero: false },
          axis: {
            title: 't-SNE Dimension 2',
            grid: true,
            gridOpacity: 0.3,
          },
        },
        color: getColorEncoding,
        opacity: {
          condition: {
            test: selectedCommunity
              ? `datum.community_name === '${selectedCommunity}'`
              : 'true',
            value: 0.7,
          },
          value: 0.15,
        },
        size: {
          condition: {
            param: 'highlight',
            value: 80,
          },
          value: selectedCommunity ? 50 : 30,
        },
        tooltip: [
          { field: 'DBA_Name', title: 'Business' },
          { field: 'Address', title: 'Address' },
          { field: 'Results', title: 'Result' },
          { field: 'Inspection_Date', title: 'Date' },
          { field: 'community_name', title: 'Community' },
          { field: 'Facility_Type', title: 'Facility Type' },
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

        // Listen for click events on points
        result.view.addEventListener('click', (event, item) => {
          if (item && item.datum && item.datum.community_name) {
            onPointClick(item.datum.community_name);
          }
        });
      } catch (err) {
        console.error('Error embedding scatter plot:', err);
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
  }, [data, dimensions, getColorEncoding, selectedCommunity, onPointClick]);

  return <div className="vega-container" ref={containerRef}></div>;
};

export default EmbeddingScatter;
