/**
 * GeographicImpactSection
 * 
 * Shows geographic impact of an event with an interactive world map.
 * Countries are colored based on involvement level.
 * 
 * Design: World map with color-coded countries + list view
 * Apple-inspired minimal design with D3.js Natural Earth projection
 */

import React, { useState, useEffect, useRef } from 'react';

// Involvement level colors (strong colors for specific countries)
const involvementConfig = {
  primary: { color: '#dc2626', bg: '#fee2e2', label: 'Directly Involved' },
  major: { color: '#f97316', bg: '#ffedd5', label: 'Major Impact' },
  moderate: { color: '#eab308', bg: '#fef9c3', label: 'Moderate Impact' },
  minor: { color: '#22c55e', bg: '#dcfce7', label: 'Minor Impact' }
};

// Light colors for regions/continents (background for affected areas)
const regionColors = {
  primary: '#fecaca',   // light red
  major: '#fed7aa',     // light orange
  moderate: '#fef08a',  // light yellow
  minor: '#bbf7d0'      // light green
};

// Region/Continent to country codes mapping
const regionToCountries = {
  // East Asia
  'East Asia': ['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'MNG', 'HKG', 'MAC'],
  'Asia': ['CHN', 'JPN', 'KOR', 'PRK', 'TWN', 'MNG', 'IND', 'PAK', 'BGD', 'LKA', 'NPL', 'BTN', 'MMR', 'THA', 'VNM', 'LAO', 'KHM', 'MYS', 'SGP', 'IDN', 'PHL', 'BRN', 'TLS'],
  'Southeast Asia': ['THA', 'VNM', 'LAO', 'KHM', 'MYS', 'SGP', 'IDN', 'PHL', 'BRN', 'TLS', 'MMR'],
  'South Asia': ['IND', 'PAK', 'BGD', 'LKA', 'NPL', 'BTN', 'MDV', 'AFG'],
  'Central Asia': ['KAZ', 'UZB', 'TKM', 'TJK', 'KGZ'],
  
  // Europe
  'Europe': ['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'PRT', 'NLD', 'BEL', 'LUX', 'CHE', 'AUT', 'POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR', 'GRC', 'HRV', 'SVN', 'SRB', 'MNE', 'MKD', 'ALB', 'BIH', 'XKX', 'UKR', 'BLR', 'MDA', 'LTU', 'LVA', 'EST', 'FIN', 'SWE', 'NOR', 'DNK', 'ISL', 'IRL', 'MLT', 'CYP', 'AND', 'MCO', 'SMR', 'VAT', 'LIE'],
  'Western Europe': ['DEU', 'FRA', 'GBR', 'ITA', 'ESP', 'PRT', 'NLD', 'BEL', 'LUX', 'CHE', 'AUT', 'IRL'],
  'Eastern Europe': ['POL', 'CZE', 'SVK', 'HUN', 'ROU', 'BGR', 'UKR', 'BLR', 'MDA', 'RUS'],
  'Northern Europe': ['FIN', 'SWE', 'NOR', 'DNK', 'ISL', 'LTU', 'LVA', 'EST'],
  'Southern Europe': ['ITA', 'ESP', 'PRT', 'GRC', 'HRV', 'SVN', 'MLT', 'CYP', 'ALB', 'MNE', 'MKD', 'SRB', 'BIH'],
  
  // Americas
  'North America': ['USA', 'CAN', 'MEX'],
  'Central America': ['GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN'],
  'South America': ['BRA', 'ARG', 'CHL', 'PER', 'COL', 'VEN', 'ECU', 'BOL', 'PRY', 'URY', 'GUY', 'SUR'],
  'Latin America': ['MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN', 'BRA', 'ARG', 'CHL', 'PER', 'COL', 'VEN', 'ECU', 'BOL', 'PRY', 'URY', 'GUY', 'SUR', 'CUB', 'DOM', 'HTI', 'JAM', 'PRI'],
  'Americas': ['USA', 'CAN', 'MEX', 'GTM', 'BLZ', 'SLV', 'HND', 'NIC', 'CRI', 'PAN', 'BRA', 'ARG', 'CHL', 'PER', 'COL', 'VEN', 'ECU', 'BOL', 'PRY', 'URY', 'GUY', 'SUR', 'CUB', 'DOM', 'HTI', 'JAM'],
  
  // Middle East
  'Middle East': ['SAU', 'IRN', 'IRQ', 'SYR', 'JOR', 'LBN', 'ISR', 'PSE', 'KWT', 'BHR', 'QAT', 'ARE', 'OMN', 'YEM', 'TUR', 'EGY'],
  'Gulf States': ['SAU', 'KWT', 'BHR', 'QAT', 'ARE', 'OMN'],
  
  // Africa
  'Africa': ['EGY', 'LBY', 'TUN', 'DZA', 'MAR', 'SDN', 'SSD', 'ETH', 'ERI', 'DJI', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'COD', 'COG', 'GAB', 'CMR', 'NGA', 'GHA', 'CIV', 'SEN', 'MLI', 'BFA', 'NER', 'TCD', 'CAF', 'AGO', 'ZMB', 'ZWE', 'BWA', 'NAM', 'ZAF', 'MOZ', 'MWI', 'MDG'],
  'North Africa': ['EGY', 'LBY', 'TUN', 'DZA', 'MAR', 'SDN'],
  'Sub-Saharan Africa': ['ETH', 'ERI', 'DJI', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'COD', 'COG', 'GAB', 'CMR', 'NGA', 'GHA', 'CIV', 'SEN', 'MLI', 'BFA', 'NER', 'TCD', 'CAF', 'AGO', 'ZMB', 'ZWE', 'BWA', 'NAM', 'ZAF', 'MOZ', 'MWI', 'MDG'],
  'West Africa': ['NGA', 'GHA', 'CIV', 'SEN', 'MLI', 'BFA', 'NER', 'GMB', 'GNB', 'GIN', 'SLE', 'LBR', 'TGO', 'BEN'],
  'East Africa': ['ETH', 'ERI', 'DJI', 'SOM', 'KEN', 'UGA', 'TZA', 'RWA', 'BDI', 'SSD'],
  'Southern Africa': ['ZAF', 'BWA', 'NAM', 'ZMB', 'ZWE', 'MOZ', 'MWI', 'LSO', 'SWZ', 'AGO'],
  
  // Oceania
  'Oceania': ['AUS', 'NZL', 'PNG', 'FJI', 'SLB', 'VUT', 'NCL', 'WSM', 'GUM'],
  'Pacific': ['AUS', 'NZL', 'PNG', 'FJI', 'SLB', 'VUT', 'NCL', 'WSM', 'GUM', 'FSM', 'PLW', 'MHL', 'KIR', 'TUV', 'NRU', 'TON']
};

// ISO 2-letter to 3-letter code mapping
const iso2ToIso3 = {
  'US': 'USA', 'CN': 'CHN', 'RU': 'RUS', 'JP': 'JPN', 'DE': 'DEU',
  'GB': 'GBR', 'FR': 'FRA', 'IT': 'ITA', 'CA': 'CAN', 'AU': 'AUS',
  'IN': 'IND', 'BR': 'BRA', 'KR': 'KOR', 'KP': 'PRK', 'MX': 'MEX',
  'ES': 'ESP', 'ID': 'IDN', 'TR': 'TUR', 'SA': 'SAU', 'IR': 'IRN',
  'UA': 'UKR', 'PL': 'POL', 'TW': 'TWN', 'TH': 'THA', 'VN': 'VNM',
  'ZA': 'ZAF', 'EG': 'EGY', 'IL': 'ISR', 'PS': 'PSE', 'IQ': 'IRQ',
  'SY': 'SYR', 'AF': 'AFG', 'PK': 'PAK', 'BD': 'BGD', 'NG': 'NGA',
  'AR': 'ARG', 'CO': 'COL', 'VE': 'VEN', 'CL': 'CHL', 'PE': 'PER',
  'NL': 'NLD', 'BE': 'BEL', 'SE': 'SWE', 'NO': 'NOR', 'DK': 'DNK',
  'FI': 'FIN', 'CH': 'CHE', 'AT': 'AUT', 'GR': 'GRC', 'PT': 'PRT',
  'CZ': 'CZE', 'HU': 'HUN', 'RO': 'ROU', 'PH': 'PHL', 'MY': 'MYS',
  'SG': 'SGP', 'NZ': 'NZL', 'IE': 'IRL', 'ET': 'ETH', 'KE': 'KEN',
  'MA': 'MAR', 'DZ': 'DZA', 'SD': 'SDN', 'MM': 'MMR', 'LK': 'LKA',
  'NP': 'NPL', 'KZ': 'KAZ', 'UZ': 'UZB', 'QA': 'QAT', 'AE': 'ARE',
  'KW': 'KWT', 'BH': 'BHR', 'OM': 'OMN', 'JO': 'JOR', 'LB': 'LBN',
  'YE': 'YEM', 'LY': 'LBY', 'TN': 'TUN', 'CU': 'CUB', 'HT': 'HTI',
  'JM': 'JAM', 'MN': 'MNG', 'HK': 'HKG', 'MO': 'MAC', 'LA': 'LAO',
  'KH': 'KHM', 'BN': 'BRN', 'TL': 'TLS', 'BT': 'BTN', 'MV': 'MDV',
  'TJ': 'TJK', 'TM': 'TKM', 'KG': 'KGZ', 'GT': 'GTM', 'BZ': 'BLZ',
  'SV': 'SLV', 'HN': 'HND', 'NI': 'NIC', 'CR': 'CRI', 'PA': 'PAN',
  'EC': 'ECU', 'BO': 'BOL', 'PY': 'PRY', 'UY': 'URY', 'GY': 'GUY',
  'SR': 'SUR', 'DO': 'DOM', 'PR': 'PRI', 'LU': 'LUX', 'SK': 'SVK',
  'BG': 'BGR', 'HR': 'HRV', 'SI': 'SVN', 'RS': 'SRB', 'ME': 'MNE',
  'MK': 'MKD', 'AL': 'ALB', 'BA': 'BIH', 'XK': 'XKX', 'BY': 'BLR',
  'MD': 'MDA', 'LT': 'LTU', 'LV': 'LVA', 'EE': 'EST', 'IS': 'ISL',
  'MT': 'MLT', 'CY': 'CYP', 'SS': 'SSD', 'ER': 'ERI', 'DJ': 'DJI',
  'SO': 'SOM', 'UG': 'UGA', 'TZ': 'TZA', 'RW': 'RWA', 'BI': 'BDI',
  'CD': 'COD', 'CG': 'COG', 'GA': 'GAB', 'CM': 'CMR', 'GH': 'GHA',
  'CI': 'CIV', 'SN': 'SEN', 'ML': 'MLI', 'BF': 'BFA', 'NE': 'NER',
  'TD': 'TCD', 'CF': 'CAF', 'AO': 'AGO', 'ZM': 'ZMB', 'ZW': 'ZWE',
  'BW': 'BWA', 'NA': 'NAM', 'MZ': 'MOZ', 'MW': 'MWI', 'MG': 'MDG',
  'PG': 'PNG', 'FJ': 'FJI', 'SB': 'SLB', 'VU': 'VUT', 'NC': 'NCL',
  'WS': 'WSM', 'GU': 'GUM'
};

// Country name to ISO3 code mapping (common countries)
const countryNameToCode = {
  'United States': 'USA', 'USA': 'USA', 'US': 'USA', 'America': 'USA',
  'China': 'CHN', 'People\'s Republic of China': 'CHN', 'PRC': 'CHN',
  'Russia': 'RUS', 'Russian Federation': 'RUS',
  'Japan': 'JPN',
  'Germany': 'DEU',
  'United Kingdom': 'GBR', 'UK': 'GBR', 'Britain': 'GBR', 'England': 'GBR',
  'France': 'FRA',
  'Italy': 'ITA',
  'Canada': 'CAN',
  'Australia': 'AUS',
  'India': 'IND',
  'Brazil': 'BRA',
  'South Korea': 'KOR', 'Korea': 'KOR', 'Republic of Korea': 'KOR',
  'North Korea': 'PRK', 'DPRK': 'PRK',
  'Mexico': 'MEX',
  'Spain': 'ESP',
  'Indonesia': 'IDN',
  'Turkey': 'TUR', 'Türkiye': 'TUR',
  'Saudi Arabia': 'SAU',
  'Iran': 'IRN',
  'Ukraine': 'UKR',
  'Poland': 'POL',
  'Taiwan': 'TWN',
  'Thailand': 'THA',
  'Vietnam': 'VNM',
  'South Africa': 'ZAF',
  'Egypt': 'EGY',
  'Israel': 'ISR',
  'Palestine': 'PSE', 'Palestinian Territories': 'PSE',
  'Iraq': 'IRQ',
  'Syria': 'SYR',
  'Afghanistan': 'AFG',
  'Pakistan': 'PAK',
  'Bangladesh': 'BGD',
  'Nigeria': 'NGA',
  'Argentina': 'ARG',
  'Colombia': 'COL',
  'Venezuela': 'VEN',
  'Chile': 'CHL',
  'Peru': 'PER',
  'Netherlands': 'NLD',
  'Belgium': 'BEL',
  'Sweden': 'SWE',
  'Norway': 'NOR',
  'Denmark': 'DNK',
  'Finland': 'FIN',
  'Switzerland': 'CHE',
  'Austria': 'AUT',
  'Greece': 'GRC',
  'Portugal': 'PRT',
  'Czech Republic': 'CZE', 'Czechia': 'CZE',
  'Hungary': 'HUN',
  'Romania': 'ROU',
  'Philippines': 'PHL',
  'Malaysia': 'MYS',
  'Singapore': 'SGP',
  'New Zealand': 'NZL',
  'Ireland': 'IRL',
  'Ethiopia': 'ETH',
  'Kenya': 'KEN',
  'Morocco': 'MAR',
  'Algeria': 'DZA',
  'Sudan': 'SDN',
  'Myanmar': 'MMR', 'Burma': 'MMR',
  'Sri Lanka': 'LKA',
  'Nepal': 'NPL',
  'Kazakhstan': 'KAZ',
  'Uzbekistan': 'UZB',
  'Qatar': 'QAT',
  'UAE': 'ARE', 'United Arab Emirates': 'ARE',
  'Kuwait': 'KWT',
  'Bahrain': 'BHR',
  'Oman': 'OMN',
  'Jordan': 'JOR',
  'Lebanon': 'LBN',
  'Yemen': 'YEM',
  'Libya': 'LBY',
  'Tunisia': 'TUN',
  'Cuba': 'CUB',
  'Haiti': 'HTI',
  'Jamaica': 'JAM',
  'European Union': 'EU', 'EU': 'EU'
};

export default function GeographicImpactSection({ data, accentColor }) {
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const mapRef = useRef(null);
  const svgRef = useRef(null);
  
  if (!data || !data.countries || data.countries.length === 0) return null;
  
  const { countries, primary_region, total_countries_affected, regions_summary } = data;
  
  // Create a map of country codes to their involvement level
  const countryInvolvement = {};
  const regionInvolvement = {};
  
  countries.forEach(country => {
    // Get ISO3 code from name
    const codeFromName = countryNameToCode[country.name];
    if (codeFromName) {
      countryInvolvement[codeFromName] = country.involvement;
    }
    
    // Also convert the country.code (2-letter) to 3-letter if present
    if (country.code) {
      const iso3 = iso2ToIso3[country.code.toUpperCase()] || country.code;
      countryInvolvement[iso3] = country.involvement;
    }
    
    // Also try matching by the country name directly
    countryInvolvement[country.name] = country.involvement;
    
    // Check if this is a region/continent
    if (regionToCountries[country.name]) {
      regionInvolvement[country.name] = country.involvement;
    }
  });
  
  // Also check regions_summary for region coloring
  if (regions_summary && Array.isArray(regions_summary)) {
    regions_summary.forEach(region => {
      const regionName = region.region;
      if (regionToCountries[regionName]) {
        // Default to moderate for regions without specific involvement
        regionInvolvement[regionName] = 'moderate';
      }
    });
  }
  
  // Build a map of country codes that should have region coloring (light color)
  const countryRegionColor = {};
  Object.entries(regionInvolvement).forEach(([regionName, involvement]) => {
    const countryCodes = regionToCountries[regionName] || [];
    countryCodes.forEach(code => {
      // Only apply region color if the country doesn't have a specific involvement
      if (!countryInvolvement[code]) {
        countryRegionColor[code] = involvement;
      }
    });
  });
  
  // Show all countries
  const displayCountries = countries;

  // Load and render D3 map
  useEffect(() => {
    if (!mapRef.current) return;
    
    const loadMap = async () => {
      try {
        // Dynamically import D3 and TopoJSON
        const d3 = await import('d3');
        const topojson = await import('topojson-client');
        
        // Clear previous SVG content
        if (svgRef.current) {
          svgRef.current.innerHTML = '';
        }
        
        const width = 600;
        const height = 260;
        
        const svg = d3.select(svgRef.current)
          .attr('width', '100%')
          .attr('height', height)
          .attr('viewBox', `0 0 ${width} ${height}`)
          .attr('preserveAspectRatio', 'xMidYMid meet');
        
        // Natural Earth projection
        const projection = d3.geoNaturalEarth1()
          .scale(120)
          .translate([width / 2, height / 2 + 10]);
        
        const path = d3.geoPath(projection);
        
        // Fetch world data
        const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json');
        const world = await response.json();
        
        // Filter out Antarctica
        world.objects.countries.geometries = world.objects.countries.geometries.filter(
          g => g.id !== '010' && g.id !== '10' && +g.id !== 10
        );
        
        // Get individual countries
        const countriesGeo = topojson.feature(world, world.objects.countries);
        const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
        
        // Country ID to ISO code mapping (from Natural Earth / World Atlas)
        const idToISO = {
          '840': 'USA', '156': 'CHN', '643': 'RUS', '392': 'JPN', '276': 'DEU',
          '826': 'GBR', '250': 'FRA', '380': 'ITA', '124': 'CAN', '036': 'AUS',
          '356': 'IND', '076': 'BRA', '410': 'KOR', '408': 'PRK', '484': 'MEX',
          '724': 'ESP', '360': 'IDN', '792': 'TUR', '682': 'SAU', '364': 'IRN',
          '804': 'UKR', '616': 'POL', '158': 'TWN', '764': 'THA', '704': 'VNM',
          '710': 'ZAF', '818': 'EGY', '376': 'ISR', '275': 'PSE', '368': 'IRQ',
          '760': 'SYR', '004': 'AFG', '586': 'PAK', '050': 'BGD', '566': 'NGA',
          '032': 'ARG', '170': 'COL', '862': 'VEN', '152': 'CHL', '604': 'PER',
          '528': 'NLD', '056': 'BEL', '752': 'SWE', '578': 'NOR', '208': 'DNK',
          '246': 'FIN', '756': 'CHE', '040': 'AUT', '300': 'GRC', '620': 'PRT',
          '203': 'CZE', '348': 'HUN', '642': 'ROU', '608': 'PHL', '458': 'MYS',
          '702': 'SGP', '554': 'NZL', '372': 'IRL', '231': 'ETH', '404': 'KEN',
          '504': 'MAR', '012': 'DZA', '729': 'SDN', '104': 'MMR', '144': 'LKA',
          '524': 'NPL', '398': 'KAZ', '860': 'UZB', '634': 'QAT', '784': 'ARE',
          '414': 'KWT', '048': 'BHR', '512': 'OMN', '400': 'JOR', '422': 'LBN',
          '887': 'YEM', '434': 'LBY', '788': 'TUN', '192': 'CUB', '332': 'HTI',
          '388': 'JAM'
        };
        
        // Get color for a country
        const getCountryColor = (d) => {
          const iso = idToISO[d.id] || idToISO[d.id?.padStart(3, '0')];
          
          // Check by ISO code - specific country involvement (strong color)
          if (iso && countryInvolvement[iso]) {
            return involvementConfig[countryInvolvement[iso]]?.color || '#e5e7eb';
          }
          
          // Check by country name in properties
          const name = d.properties?.name;
          if (name && countryInvolvement[name]) {
            return involvementConfig[countryInvolvement[name]]?.color || '#e5e7eb';
          }
          
          // Check if country is in an affected region (light color)
          if (iso && countryRegionColor[iso]) {
            return regionColors[countryRegionColor[iso]] || '#e5e7eb';
          }
          
          // Default: light grey for non-impacted
          return '#e5e7eb';
        };
        
        // Draw countries
        svg.selectAll('.country')
          .data(countriesGeo.features)
          .enter()
          .append('path')
          .attr('class', 'country')
          .attr('d', path)
          .attr('fill', d => getCountryColor(d))
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.3)
          .style('transition', 'fill 0.3s ease');
        
        setMapLoaded(true);
        
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };
    
    loadMap();
  }, [countries]);
  
  return (
    <>
      <style jsx>{`
        .geographic-section {
          margin: 20px 0;
          animation: fadeIn 0.5s ease both;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }

        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #86868b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-badge {
          font-size: 11px;
          color: #86868b;
          background: #f5f5f7;
          padding: 3px 8px;
          border-radius: 10px;
          font-weight: 500;
        }

        .map-wrapper {
          position: relative;
          margin: 0 -16px;
        }

        .map-svg {
          display: block;
          width: 100%;
        }

        .map-loading {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .legend-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: center;
          margin-bottom: 12px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #86868b;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 4px;
        }

        .countries-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .country-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: #fff;
          border: 1px solid #f0f0f0;
          border-radius: 20px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .country-pill:hover {
          border-color: #e0e0e0;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
          transform: translateY(-1px);
        }

        .country-pill:active {
          transform: translateY(0);
        }

        .country-pill.selected {
          border-color: #0066CC;
          background: #f0f7ff;
        }

        /* Liquid glass popup */
        .country-detail-popup {
          margin-top: 12px;
          padding: 16px;
          background: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          animation: slideUp 0.25s ease;
        }

        .popup-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .popup-country-name {
          font-size: 16px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .popup-involvement {
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 10px;
        }

        .popup-role {
          font-size: 12px;
          color: #86868b;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .popup-description {
          font-size: 14px;
          color: #1d1d1f;
          line-height: 1.5;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .pill-dot {
          width: 8px;
          height: 8px;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .pill-name {
          font-weight: 500;
          color: #1d1d1f;
        }

        .regions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
        }

        .region-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .region-name {
          font-size: 11px;
          font-weight: 600;
          color: #1d1d1f;
        }

        .region-status {
          font-size: 12px;
          color: #48484a;
          line-height: 1.45;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section className="geographic-section">
        <div className="section-header">
          <span className="section-title">Geographic Impact</span>
          <span className="section-badge">{total_countries_affected || countries.length} countries</span>
        </div>
        
        {/* World Map - no box, edge-to-edge */}
        <div className="map-wrapper" ref={mapRef}>
          <svg ref={svgRef} className="map-svg"></svg>
          {!mapLoaded && (
            <div className="map-loading">
              <span style={{ color: '#86868b', fontSize: '12px' }}>Loading...</span>
            </div>
          )}
        </div>
        
        {/* Compact legend */}
        <div className="legend-row">
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: involvementConfig.primary.color }} />
            <span>Direct</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: involvementConfig.major.color }} />
            <span>Major</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: involvementConfig.moderate.color }} />
            <span>Moderate</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: involvementConfig.minor.color }} />
            <span>Minor</span>
          </div>
          <div className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: '#e5e7eb' }} />
            <span>None</span>
          </div>
        </div>
        
        {/* Compact country pills */}
        <div className="countries-grid">
          {displayCountries.map((country, index) => {
            const config = involvementConfig[country.involvement] || involvementConfig.moderate;
            const isSelected = selectedCountry?.name === country.name;
            
            return (
              <div 
                key={index} 
                className={`country-pill ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedCountry(isSelected ? null : country)}
              >
                <div className="pill-dot" style={{ backgroundColor: config.color }} />
                <span className="pill-name">{country.name}</span>
              </div>
            );
          })}
          
        </div>
        
        {/* Country detail popup (liquid glass) */}
        {selectedCountry && (
          <div className="country-detail-popup">
            <div className="popup-header">
              <span className="popup-country-name">{selectedCountry.name}</span>
              <span 
                className="popup-involvement"
                style={{ 
                  backgroundColor: involvementConfig[selectedCountry.involvement]?.bg || '#f3f4f6',
                  color: involvementConfig[selectedCountry.involvement]?.color || '#6b7280'
                }}
              >
                {involvementConfig[selectedCountry.involvement]?.label || 'Affected'}
              </span>
            </div>
            {selectedCountry.role && (
              <div className="popup-role">{selectedCountry.role}</div>
            )}
            <p className="popup-description">{selectedCountry.description}</p>
          </div>
        )}
        
        {/* Region summary */}
        {regions_summary && regions_summary.length > 0 && (
          <div className="regions-list">
            {regions_summary.map((region, index) => (
              <div key={index} className="region-item">
                <span className="region-name">{region.region}</span>
                <span className="region-status">{region.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
