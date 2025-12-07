

# Chicago Food Inspection Embedding Explorer


This is an interactive dashboard for exploring 100,000+ food inspection records from the Chicago Data Portal. The project compares different embedding approaches and provides linked views to analyze violations across neighborhoods, facility types, and time. You can find:
- **Live Dashboard**: [sajontahsen.github.io/chi-food-inspections-embeddings-dashboard/](https://sajontahsen.github.io/chi-food-inspections-embeddings-dashboard/)
- **Presentation Slides**: [PDF](./docs/CS24A4-FoodInspections.pdf)

*Developed for CS424 (Visualization & Visual Analytics) at UIC, Fall 2025.*

<!-- **Repository Structure:**
- `/src` - React visualization dashboard code
- `/scripts` - Data processing and embedding generation scripts
- `/docs` - Project documentation and presentation slides
- `/public/data` - Processed datasets for visualization -->


## Pipeline Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                     DATA ACQUISITION                            │
├─────────────────────────────────────────────────────────────────┤
│  Chicago Data Portal APIs                                       │
│  ├── Food Inspections                                          │
│  ├── Business Licenses                                         │
│  ├── Crime (Burglary)                                          │
│  ├── Garbage Cart Complaints                                   │
│  └── Sanitation Complaints                                     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE ENGINEERING                          │
├─────────────────────────────────────────────────────────────────┤
│  R Scripts (updated existing pipeline)                          │
│  ├── Violation matrix calculation                              │
│  ├── Heat map values (spatial density)                         │
│  ├── Inspection history features                               │
│  └── Business license features                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING GENERATION                         │
├─────────────────────────────────────────────────────────────────┤
│  Approach 1: Direct features → Scale → t-SNE                   │
│  Approach 2: Features → MLP → Hidden layer → t-SNE             │
│  Approach 3: Violations text → Sentence Transformers → t-SNE/UMAP    |
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      VISUALIZATION                              │
├─────────────────────────────────────────────────────────────────┤
│  ├── Spatial join with community boundaries                    │
│  ├── Aggregate statistics by community                         │
│  └── Vega-Lite / React visualization                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Dataset Overview

This project uses two datasets from the Chicago Data Portal:

### Food Inspections Dataset
- **Source**: [Chicago Data Portal - Food Inspections](https://data.cityofchicago.org/Health-Human-Services/Food-Inspections/4ijn-s7e5)
- **Records**: ~100,000+ inspection records
- **Time Period**: January 2010 - Present

Key attributes:
- `Results` - Inspection outcome (Pass, Fail, Pass w/ Conditions)
- `Violations` - Free-text field describing what violations were found
- `Inspection_Date` - Date of inspection
- `Latitude/Longitude` - Geographic coordinates
- `Facility_Type` - Type of establishment (Restaurant, Grocery Store, School, etc.)

### Community Areas Dataset
- **Source**: [Chicago Data Portal - Community Areas](https://data.cityofchicago.org/Facilities-Geographic-Boundaries/Boundaries-Community-Areas/igwz-8jzy)
- **Features**: 77 officially recognized Chicago community areas with polygon boundaries
- **Purpose**: Enables neighborhood-level spatial analysis through point-in-polygon joins

---

## 2. Embedding Construction

### The Problem
Each food inspection record needed to be represented as a numerical vector (embedding) such that similar inspections would be close together in the embedding space. The challenge was defining what "similar" means for inspections.

### Iteration 1: Feature-Based Embeddings

**Approach**: I started by building on [Chicago's existing food inspection evaluation project](https://github.com/Chicago/food-inspections-evaluation), which uses engineered features to predict inspection outcomes.

**Features used (13 total)**:

| Feature | Type | Description |
|---------|------|-------------|
| `pastSerious` | Binary | Had serious violations in previous inspection |
| `pastCritical` | Binary | Had critical violations in previous inspection |
| `pastMinor` | Binary | Had minor violations in previous inspection |
| `timeSinceLast` | Numeric | Years since last inspection (capped at 2) |
| `ageAtInspection` | Numeric | Years since business license issued (capped at 10) |
| `heat_burglary` | Numeric | Burglary density in area |
| `heat_sanitation` | Numeric | Sanitation complaint density |
| `heat_garbage` | Numeric | Garbage complaint density |
| `firstRecord` | Binary | Is this the first inspection? |
| `consumption_on_premises` | Binary | Has on-premises consumption license |
| `tobacco` | Binary | Has tobacco license |
| `is_Restaurant` | Binary | Facility type is Restaurant |
| `is_Grocery` | Binary | Facility type is Grocery Store |

**Process**:
1. Loaded feature-engineered data from Chicago's R pipeline
2. Normalized all features to [0,1] range using StandardScaler
3. Applied t-SNE (perplexity=30, 1000 iterations) to get 2D projection

**Result**: The embeddings showed no meaningful clustering. Pass and Fail inspections were completely mixed. Points appeared randomly scattered regardless of outcome or violation type.

**Why it failed**: These features capture business context (age, neighborhood, history) but not the content of what actually went wrong during inspections. Two restaurants in the same neighborhood with similar ages can have completely different violations.

---

### Iteration 2: MLP Hidden Layer Embeddings

**What changed**: Instead of using raw features directly, I trained a neural network to predict critical violations and extracted learned representations from a hidden layer.

**Architecture**:
```
Input (13 features) → 64 → 32 → 16 (embedding layer) → 1 (output)
```

**Process**:
1. Trained MLP to predict `criticalFound` (binary classification)
2. Extracted 16-dimensional activations from the third hidden layer
3. Applied t-SNE to these learned embeddings

**Result**: Similar to Iteration 1 - weak clustering. The neural network was still working with the same underlying features, so it couldn't learn violation-type patterns that weren't present in the input.

---

### Iteration 3: Violations Text Embeddings (Final Approach)

**The realization**: The `Violations` field contains rich semantic information about what actually went wrong:

```
"OBSERVED RODENT DROPPINGS IN STORAGE AREA"
"FOOD NOT HELD AT PROPER TEMPERATURE - COLD FOOD AT 52F"
"DIRTY FOOD CONTACT SURFACES, DEBRIS ON FLOOR"
```

These descriptions capture similarity in a way that business metadata cannot - rodent problems should cluster with rodent problems, temperature issues with temperature issues.


**Process**:
1. **Text cleaning**: Lowercase, remove special characters, collapse whitespace
2. **Text embedding**: Used Sentence Transformers (`all-MiniLM-L6-v2`) to convert each violations description into a 384-dimensional vector
3. **Dimensionality reduction**: Applied both UMAP and t-SNE to project to 2D

**Why both UMAP and t-SNE?** To demonstrate that the violations text approach produces meaningful structure regardless of the projection method. Both show similar clustering patterns, confirming the embeddings themselves are semantically meaningful - not an artifact of a specific algorithm.

**Data Statistics**
| Metric | Value |
|--------|-------|
| Total inspections (violations dataset) | 8,074 |
| Critical violations | ~15% |
| Pass rate | ~65% |
| Unique facility types | 50+ |
| Community areas | 77 |
| Time range (temporal chart) | 2020-2025 |

**Parameters**:
- t-SNE: perplexity=30, 1000 iterations
- UMAP: n_neighbors=15, min_dist=0.1


**Result**: Clear clustering by violation type. Inspections with similar problems (pest issues, temperature violations, cleanliness problems) now group together in the embedding space.

---

## 3. Dimensionality Reduction

### Methods Used
- **t-SNE** (t-distributed Stochastic Neighbor Embedding)
- **UMAP** (Uniform Manifold Approximation and Projection)

### Rationale

Both methods are non-linear dimensionality reduction techniques suitable for visualizing high-dimensional data:

- **t-SNE** excels at preserving local neighborhood structure - points that are similar in high dimensions stay close in 2D
- **UMAP** often preserves more global structure and runs faster on large datasets

Using both methods serves two purposes:
1. **Validation**: If clusters appear in both projections, the structure is likely real (not an artifact of the algorithm)
2. **Comparison**: Users can switch between projections in the interface to see different perspectives

For the violations text embeddings, both t-SNE and UMAP produce similar clustering patterns, which gives confidence that the semantic structure in the text is being captured.

---

## 4. Visualization Interface (this repo)

### Architecture
Built with React + Vite using Vega-Lite for declarative visualizations.

```
viz/
├── public/data/           # Processed data files
├── src/
│   ├── App.jsx            # Main application
│   └── components/
│       ├── EmbeddingScatter.jsx    # Main embedding view
│       ├── ChicagoMap.jsx          # Choropleth map
│       ├── FacilityTypeChart.jsx   # Bar chart
│       └── TemporalChart.jsx       # Timeline
```

### Views

| View | Type | Encoding | Interaction |
|------|------|----------|-------------|
| Embedding Scatter | Main | Position: projection coords, Color: violation status | Click to select community |
| Chicago Map | Spatial | Choropleth by critical rate | Click to filter by community |
| Facility Type | Detail | Bar chart of failures by type | Updates on selection |
| Temporal | Context | Line + points showing quarterly failure rates | Tooltips |

### Controls

- **Embedding Source**: Switch between Violations (UMAP), Violations (t-SNE), Feature-based (t-SNE), MLP (t-SNE)
- **Color Mode**: Critical Violation / Pass-Fail / Results
- **Inspection Slider**: Filter to show N most recent inspections
- **Clear Selection**: Reset all filters

### Interactions

The views are linked through a shared `selectedCommunity` state:

1. **Click point in scatter plot** → Selects that point's community area → Map highlights community → Bar chart filters to that community
2. **Click community on map** → Scatter plot highlights points from that community → Bar chart filters
3. **Click same selection again** → Clears selection (toggle behavior)

---

## 5. Initial Findings

### Embedding Space Patterns

1. **Violations text embeddings show meaningful structure**: Unlike the feature-based approaches, the text embeddings produce visible clusters that correspond to violation types.

2. **Both t-SNE and UMAP confirm the pattern**: The clustering is consistent across projection methods, indicating real semantic structure in the embeddings rather than algorithmic artifacts.

### Geographic Patterns

3. **Critical violation rates vary significantly across communities**: Ranges from near 0% to over 30% depending on the neighborhood.

### Temporal Patterns

4. **Schools frequently have highest failure rates**: Particularly visible in certain quarters, likely due to seasonal inspection patterns.

5. **Facility types take turns as worst performers**: No single facility type dominates - Bakery, School, Grocery Store, and Daycare all appear as the worst performer in different quarters.

---

## 6. Screenshots

### Embedding Space - Violations Text 
TODO: (put both umap and t-sne in a single image with captions showing which is which)
![Embedding Scatter Plot](screenshots/embedding_scatter.png)
*The violations text embeddings show clustering by violation type. Points are colored by critical violation status (green=no, red=yes). Clicking a point selects its community area.*

### Linked Views - Community Selected
TODO: (put gif of dashboard - first, select TSNE, drag latest inspections to all - then select WEST TOWN on map)
![Linked Views](screenshots/linked_views.png)
*When a community is selected on the map, the scatter plot highlights points from that community, and the bar chart shows failure distribution for that area.*

### Facility Distribution & Temporal Patterns 

TODO: (screenshot of bottom two)
![Temporal Chart](screenshots/temporal_chart.png)
*Peak failure rate per quarter (2020-2025). Gray line shows the maximum rate; colored points indicate which facility type was the worst performer that quarter.*

### Embedding Comparison
TODO: (compare as described here)
![Embedding Comparison](screenshots/embedding_comparison.png)
*Comparing different embedding approaches. Left: Feature-based shows random scatter. Right: Violations text shows meaningful clusters.*

---

## 7. Iteration Summary

| Iteration | Input | Change | Rationale | Effect |
|-----------|-------|--------|-----------|--------|
| 1 | 13 numeric features | Starting point | Build on Chicago's existing work | No clustering - features capture context, not content |
| 2 | Same features → MLP | Add learned representations | Maybe NN can find better patterns | Similar result - still limited by input features |
| 3 | Violations text → Sentence Transformers | Switch to text embeddings | Text describes what actually went wrong | Clear clustering by violation type |
| 3b | Same text → UMAP + t-SNE | Add second projection method | Validate that structure is real | Both methods show similar patterns |

---


