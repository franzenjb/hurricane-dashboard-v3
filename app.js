(function() {
  'use strict';

  // --- Constants ---
  var CATEGORY_COLORS = {
    '-1': '#D3D3D3',
    0: '#8B9DC3',
    1: '#5CB85C',
    2: '#F0AD4E',
    3: '#FF7F00',
    4: '#D9534F',
    5: '#8B008B'
  };

  var MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DEFAULT_ACTIVE_CATEGORIES = new Set([3, 4, 5]);

  // --- State ---
  var storms = [];
  var filteredStorms = [];
  var map = null;
  var mapLayers = [];
  var activeCategories = new Set(DEFAULT_ACTIVE_CATEGORIES);
  var landfallOnly = false;
  var showNames = true;
  var yearMin = 2010;
  var yearMax = 2025;
  var searchQuery = '';

  // --- Init ---
  function init() {
    storms = typeof ATLANTIC_STORMS_ENHANCED !== 'undefined' ? ATLANTIC_STORMS_ENHANCED : [];
    computeKPIs();
    setupFilters();
    initMap();
    applyFilters();
  }

  // --- KPIs ---
  function computeKPIs() {
    document.getElementById('kpi-total').textContent = storms.length.toLocaleString();
    document.getElementById('kpi-cat5').textContent = storms.filter(function(s) { return s.category === 5; }).length;
    document.getElementById('kpi-major').textContent = storms.filter(function(s) { return s.category >= 3; }).length.toLocaleString();
    document.getElementById('kpi-landfall').textContent = storms.filter(function(s) {
      return Array.isArray(s.landfall_states) && s.landfall_states.length > 0;
    }).length.toLocaleString();
  }

  // --- Filters ---
  function setupFilters() {
    // Category pills
    document.querySelectorAll('.filter-pill[data-category]').forEach(function(pill) {
      pill.addEventListener('click', function() {
        var cat = parseInt(pill.dataset.category);
        if (activeCategories.has(cat)) {
          activeCategories.delete(cat);
          pill.classList.remove('active');
        } else {
          activeCategories.add(cat);
          pill.classList.add('active');
        }
        applyFilters();
      });
    });

    // Landfall toggle
    document.getElementById('landfall-toggle').addEventListener('click', function() {
      landfallOnly = !landfallOnly;
      this.classList.toggle('active', landfallOnly);
      applyFilters();
    });

    // Show names toggle
    document.getElementById('names-toggle').addEventListener('click', function() {
      showNames = !showNames;
      this.classList.toggle('active', showNames);
      applyFilters();
    });

    // Search with debounce
    var searchTimeout;
    document.getElementById('search-input').addEventListener('input', function() {
      var self = this;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function() {
        searchQuery = self.value.trim().toLowerCase();
        applyFilters();
      }, 300);
    });

    // Year inputs
    document.getElementById('year-start').addEventListener('change', function() {
      yearMin = parseInt(this.value) || 1851;
      applyFilters();
    });
    document.getElementById('year-end').addEventListener('change', function() {
      yearMax = parseInt(this.value) || 2025;
      applyFilters();
    });
  }

  function applyFilters() {
    filteredStorms = storms.filter(function(s) {
      if (s.year < yearMin || s.year > yearMax) return false;
      if (!activeCategories.has(s.category)) return false;
      if (landfallOnly && (!Array.isArray(s.landfall_states) || s.landfall_states.length === 0)) return false;
      if (searchQuery && !s.name.toLowerCase().includes(searchQuery)) return false;
      return true;
    });
    createTimeline();
  }

  // --- Timeline (Plotly scatter) ---
  function createTimeline() {
    var traces = [{
      x: filteredStorms.map(function(s) { return s.month + (s.day - 1) / 31; }),
      y: filteredStorms.map(function(s) { return s.year + (s.month - 6 + (s.day - 1) / 31) / 7; }),
      text: filteredStorms.map(function(s) { return s.name; }),
      mode: showNames ? 'markers+text' : 'markers',
      type: 'scatter',
      textposition: 'top center',
      textfont: { size: 10, family: 'Source Sans Pro' },
      marker: {
        size: filteredStorms.map(function(s) { return Math.max(8, 10 + (s.wind_mph || 0) / 12); }),
        color: filteredStorms.map(function(s) { return CATEGORY_COLORS[s.category] || '#757575'; }),
        line: { color: 'white', width: 1.5 }
      },
      hovertemplate: '<b>%{text}</b><br>%{customdata[2]} %{customdata[3]}<br>Category %{customdata[0]}<br>%{customdata[1]} mph<extra></extra>',
      customdata: filteredStorms.map(function(s) {
        return [
          s.category === 0 ? 'TS' : s.category,
          s.wind_mph,
          MONTH_NAMES[s.month] || '',
          s.year
        ];
      })
    }];

    // Dynamic y-axis ticks (max ~15 gridlines)
    var range = yearMax - yearMin;
    var interval;
    if (range <= 15) interval = 1;
    else if (range <= 30) interval = 2;
    else if (range <= 75) interval = 5;
    else if (range <= 150) interval = 10;
    else interval = 20;

    var tickVals = [];
    var startTick = Math.ceil(yearMin / interval) * interval;
    for (var y = startTick; y <= yearMax; y += interval) {
      tickVals.push(y);
    }

    var layout = {
      xaxis: {
        tickvals: [6, 7, 8, 9, 10, 11, 12],
        ticktext: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        range: [5.5, 12.5],
        gridcolor: '#e5e5e5',
        title: { text: '' }
      },
      yaxis: {
        autorange: false,
        range: [yearMax + 1, yearMin - 1],
        tickmode: 'array',
        tickvals: tickVals,
        gridcolor: '#e5e5e5',
        title: { text: '' }
      },
      hovermode: 'closest',
      autosize: true,
      margin: { l: 50, r: 20, t: 20, b: 40 },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white',
      font: { family: 'Source Sans Pro', color: '#4a4a4a' }
    };

    var config = { responsive: true, displayModeBar: false, displaylogo: false };

    Plotly.newPlot('timeline', traces, layout, config).then(function(plot) {
      plot.on('plotly_click', function(data) {
        if (!data || !data.points || !data.points.length) return;
        var idx = data.points[0].pointIndex;
        if (filteredStorms[idx]) selectStorm(filteredStorms[idx]);
      });
    });
  }

  // --- Storm Selection ---
  function selectStorm(storm) {
    // Update badge
    var badge = document.getElementById('storm-badge');
    badge.textContent = storm.category === 0 ? 'TS' : storm.category;
    badge.style.backgroundColor = CATEGORY_COLORS[storm.category] || '#757575';

    // Update name
    document.getElementById('storm-name').textContent = storm.name;
    document.getElementById('storm-subtitle').textContent =
      (storm.category === 0 ? 'Tropical Storm' : 'Category ' + storm.category + ' Hurricane') + ' — ' + storm.year;

    // Show and update stats
    document.getElementById('storm-stats').style.display = 'grid';
    document.getElementById('stat-date').textContent = (MONTH_NAMES[storm.month] || '') + ' ' + storm.day + ', ' + storm.year;
    document.getElementById('stat-wind').textContent = storm.wind_mph + ' mph';
    document.getElementById('stat-pressure').textContent = storm.pressure ? storm.pressure + ' mb' : '–';
    document.getElementById('stat-landfall').textContent =
      (storm.landfall_states && storm.landfall_states.length > 0)
        ? storm.landfall_states.join(', ')
        : 'None';

    // Update narrative
    document.getElementById('narrative-text').textContent = storm.narrative ||
      (storm.name + ' was a ' + (storm.category === 0 ? 'tropical storm' : 'Category ' + storm.category + ' hurricane') + ' in ' + storm.year + '.');

    // Show on map
    showStormOnMap(storm);
  }

  // --- Map ---
  function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: false }).setView([25, -70], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);
  }

  function clearMapLayers() {
    mapLayers.forEach(function(layer) { map.removeLayer(layer); });
    mapLayers = [];
  }

  function showStormOnMap(storm) {
    if (!map) return;
    clearMapLayers();

    var decade = Math.floor(storm.year / 10) * 10;
    var pointsFile = 'hurdat2_data/points_' + decade + 's.geojson';

    fetch(pointsFile)
      .then(function(resp) {
        if (!resp.ok) throw new Error('Not found');
        return resp.json();
      })
      .then(function(data) {
        var features = data.features.filter(function(f) {
          return f.properties.storm_id === storm.storm_id;
        });
        if (features.length > 0) {
          drawRainbowTrack(features, storm);
        } else {
          throw new Error('No features');
        }
      })
      .catch(function() {
        // Fallback: try tracks file
        var tracksFile = 'hurdat2_data/tracks_' + decade + 's.geojson';
        fetch(tracksFile)
          .then(function(resp) {
            if (!resp.ok) throw new Error('Not found');
            return resp.json();
          })
          .then(function(data) {
            var feature = data.features.find(function(f) {
              return f.properties.storm_id === storm.storm_id;
            });
            if (feature && feature.geometry.type === 'LineString') {
              var coords = feature.geometry.coordinates.map(function(c) { return [c[1], c[0]]; });
              var line = L.polyline(coords, {
                color: CATEGORY_COLORS[storm.category],
                weight: 4,
                opacity: 0.8
              }).addTo(map);
              mapLayers.push(line);
              map.fitBounds(line.getBounds(), { padding: [20, 20], maxZoom: 8 });
            } else {
              throw new Error('No track');
            }
          })
          .catch(function() {
            // Final fallback: single point
            if (storm.lat && storm.lon) {
              var marker = L.circleMarker([storm.lat, -Math.abs(storm.lon)], {
                color: CATEGORY_COLORS[storm.category],
                fillColor: CATEGORY_COLORS[storm.category],
                fillOpacity: 0.7,
                radius: 8
              }).addTo(map);
              mapLayers.push(marker);
              map.setView([storm.lat, -Math.abs(storm.lon)], 6);
            }
          });
      });
  }

  function drawRainbowTrack(pointFeatures, storm) {
    // Sort by datetime
    pointFeatures.sort(function(a, b) {
      if (a.properties.datetime && b.properties.datetime) {
        return new Date(a.properties.datetime) - new Date(b.properties.datetime);
      }
      return 0;
    });

    var allLatLngs = [];
    var segments = [];

    for (var i = 0; i < pointFeatures.length - 1; i++) {
      var c1 = pointFeatures[i].geometry.coordinates;
      var c2 = pointFeatures[i + 1].geometry.coordinates;
      var ll1 = [c1[1], c1[0]];
      var ll2 = [c2[1], c2[0]];
      allLatLngs.push(ll1);
      if (i === pointFeatures.length - 2) allLatLngs.push(ll2);

      // Wind (knots) to category
      var wind = pointFeatures[i].properties.max_wind || 0;
      var cat = 0;
      if (wind >= 137) cat = 5;
      else if (wind >= 113) cat = 4;
      else if (wind >= 96) cat = 3;
      else if (wind >= 83) cat = 2;
      else if (wind >= 64) cat = 1;

      segments.push({ coords: [ll1, ll2], color: CATEGORY_COLORS[cat] || '#8B9DC3' });
    }

    // Fit bounds first
    if (allLatLngs.length > 0) {
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [20, 20], maxZoom: 8 });
    }

    // Animate segments
    var idx = 0;
    var speed = Math.max(15, 400 / segments.length);

    function drawNext() {
      if (idx < segments.length) {
        var seg = segments[idx];
        var line = L.polyline(seg.coords, { color: seg.color, weight: 5, opacity: 1 }).addTo(map);
        mapLayers.push(line);
        idx++;
        setTimeout(drawNext, speed);
      }
    }
    drawNext();
  }

  // --- Boot ---
  document.addEventListener('DOMContentLoaded', init);
})();
