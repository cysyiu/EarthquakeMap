let map, popup, popupContent;
let tectonicLayer0, tectonicLayer1, faultLayer;
let selectedFeature = null;
let selectedItem = null;
let fromDateInput, toDateInput, alertDropdown;

const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Hong_Kong', timeZoneName: 'short' };
const defaultCenter = ol.proj.fromLonLat([114.1095, 22.3964]); // Hong Kong
const defaultZoom = 2;

document.addEventListener('DOMContentLoaded', () => {
    // Initialize the OpenLayers map, centered on Hong Kong
    map = new ol.Map({
        target: 'earthquakeMap',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.OSM()
            })
        ],
        view: new ol.View({
            center: defaultCenter,
            zoom: defaultZoom
        })
    });

    const popupContainer = document.createElement('div');
    popupContainer.className = 'ol-popup';
    popupContent = document.createElement('div');
    const popupCloser = document.createElement('a');
    popupCloser.className = 'ol-popup-closer';
    popupContainer.appendChild(popupContent);
    popupContainer.appendChild(popupCloser);

    popup = new ol.Overlay({
        element: popupContainer,
        autoPan: true,
        autoPanAnimation: {
            duration: 250
        }
    });
    map.addOverlay(popup);

    popupCloser.onclick = function () {
        popup.setPosition(undefined);
        popupCloser.blur();
        return false;
    };

    // Single click event for map
    map.on('singleclick', function (evt) {
        popup.setPosition(undefined);
        const feature = map.forEachFeatureAtPixel(evt.pixel, function (f) {
            return f;
        }, {
            layerFilter: function (layer) {
                return layer.get('name') === 'earthquakeLayer';
            }
        });

        if (feature) {
            const coordinates = feature.getGeometry().getCoordinates();
            popupContent.innerHTML = `<div style="font-size: 1.2em;"><strong>${feature.get('title')}</strong></div>
                                      <hr>
                                      <div style="font-size: 0.8em;">${feature.get('formattedTime')}</div>`;
            popup.setPosition(coordinates);

            // Flash feature
            if (selectedFeature) {
                selectedFeature.set('flash', false);
                selectedFeature.set('selected', false);
                selectedFeature.changed();
            }
            feature.set('selected', true);
            flashFeature(feature);
            selectedFeature = feature;

            // Highlight list item
            const id = feature.get('eqId');
            if (selectedItem) {
                selectedItem.classList.remove('selected');
            }
            const item = document.querySelector(`[data-eqid="${id}"]`);
            if (item) {
                item.classList.add('selected');
                selectedItem = item;
                item.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            // Unselect and reset map view
            if (selectedFeature) {
                selectedFeature.set('flash', false);
                selectedFeature.set('selected', false);
                selectedFeature.changed();
                selectedFeature = null;
            }
            if (selectedItem) {
                selectedItem.classList.remove('selected');
                selectedItem = null;
            }
            map.getView().animate({
                center: defaultCenter,
                zoom: defaultZoom
            });
        }
    });

    // Update list on map move
    map.on('moveend', () => {
        updateEarthquakeList();
    });

    // Call functions to add layers and controls
    fetchTectonicPlateData();
    fetchFaultLayer();
    createLayerVisibilityControl();
    createLeftControls();

    // Initial fetch of earthquake data for the last 30 days
    fetchEarthquakeData('', null, null);

    // Resizer functionality
    const resizer = document.getElementById('resizer');
    let isResizing = false;
    let initialWidth = 0;
    let initialMouseX = 0;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault(); // Prevent text selection during drag
        isResizing = true;
        const leftContainer = document.querySelector('.left-container');
        initialWidth = parseFloat(getComputedStyle(leftContainer).width);
        initialMouseX = e.clientX;
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });

    function handleMouseMove(e) {
        if (!isResizing) return;
        const container = document.querySelector('.container');
        const containerRect = container.getBoundingClientRect();
        const deltaX = e.clientX - initialMouseX;
        const newWidth = initialWidth + deltaX;
        const minWidth = 200; // Minimum width for left-container
        const maxWidth = containerRect.width - 200; // Minimum width for earthquakeMap
        if (newWidth >= minWidth && newWidth <= maxWidth) {
            document.querySelector('.left-container').style.width = `${newWidth}px`;
        }
    }

    function stopResizing() {
        isResizing = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', stopResizing);
        map.updateSize(); // Update map size after resizing
    }
});

// Function to flash the feature
const flashFeature = (feature) => {
    feature.set('flash', true);
    feature.changed();
    let flashCount = 0;
    const flashInterval = setInterval(() => {
        feature.set('flash', !feature.get('flash'));
        feature.changed();
        flashCount++;
        if (flashCount >= 6) {
            clearInterval(flashInterval);
            feature.set('flash', false);
            feature.set('selected', true); // Maintain selection
            feature.changed();
        }
    }, 300);
};

// Fetch Tectonic Plate
const fetchTectonicPlateData = () => {
    tectonicLayer0 = new ol.layer.Vector({
        source: new ol.source.Vector({
            loader: function (extent, resolution, projection) {
                const url = 'https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Tectonic_Plates_and_Boundaries/FeatureServer/0/query/?f=json&where=1%3D1&returnGeometry=true&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=102100&inSR=102100';
                fetch(url).then(response => response.json()).then(data => {
                    const format = new ol.format.EsriJSON();
                    const features = format.readFeatures(data, {
                        featureProjection: projection
                    });
                    tectonicLayer0.getSource().addFeatures(features);
                });
            }
        }),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'brown',
                width: 1
            })
        })
    });

    tectonicLayer1 = new ol.layer.Vector({
        source: new ol.source.Vector({
            loader: function (extent, resolution, projection) {
                const url = 'https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Tectonic_Plates_and_Boundaries/FeatureServer/1/query/?f=json&where=1%3D1&returnGeometry=true&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=102100&inSR=102100';
                fetch(url).then(response => response.json()).then(data => {
                    const format = new ol.format.EsriJSON();
                    const features = format.readFeatures(data, {
                        featureProjection: projection
                    });
                    tectonicLayer1.getSource().addFeatures(features);
                });
            }
        }),
        style: function (feature) {
            const label = feature.get('PlateName');
            const labelStyle = new ol.style.Text({
                text: label,
                overflow: false,
                placement: 'polygon',
                textBaseline: 'middle',
                fill: new ol.style.Fill({
                    color: '#000'
                })
            });
            return new ol.style.Style({
                text: labelStyle
            });
        }
    });
    
    map.addLayer(tectonicLayer0);
    map.addLayer(tectonicLayer1);
};

// Fetch Fault Layer
const fetchFaultLayer = () => {
    faultLayer = new ol.layer.Vector({
        source: new ol.source.Vector({
            loader: function (extent, resolution, projection) {
                const url = 'https://services.arcgis.com/jIL9msH9OI208GCb/arcgis/rest/services/Active_Faults/FeatureServer/0/query/?f=json&where=1%3D1&returnGeometry=true&spatialRel=esriSpatialRelIntersects&outFields=*&outSR=102100&inSR=102100';
                fetch(url).then(response => response.json()).then(data => {
                    const format = new ol.format.EsriJSON();
                    const features = format.readFeatures(data, {
                        featureProjection: projection
                    });
                    faultLayer.getSource().addFeatures(features);
                });
            }
        }),
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'orange',
                width: 1
            })
        })
    });
    map.addLayer(faultLayer);
};

// Fetch Earthquake Data
let allEarthquakes = []; // Store all fetched earthquakes
const fetchEarthquakeData = async (alertLevel, inputStartDate, inputEndDate) => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const startDate = inputStartDate || thirtyDaysAgo;
    const endDate = inputEndDate || today;

    try {
        const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startDate.toISOString()}&endtime=${endDate.toISOString()}`;
        const response = await fetch(url);
        const earthquake = await response.json();

        // Clear existing earthquake layers
        const layersToRemove = [];
        map.getLayers().forEach((layer) => {
            if (layer.get('name') === 'earthquakeLayer') {
                layersToRemove.push(layer);
            }
        });
        layersToRemove.forEach((layer) => map.removeLayer(layer));

        const vectorSource = new ol.source.Vector();
        allEarthquakes = [];

        // Process each earthquake feature
        earthquake.features.forEach((featureData) => {
            const { mag, place, time, alert, title } = featureData.properties;
            const [lon, lat] = featureData.geometry.coordinates;

            // Check if alert is not null and matches the selected alert level
            if (alert !== null && (!alertLevel || alert === alertLevel)) {
                const eventTime = new Date(time);

                // Filter by date range
                if (eventTime >= startDate && eventTime <= endDate) {
                    const formattedTime = eventTime.toLocaleString('en-HK', options);
                    let color;
                    switch (alert) {
                        case 'green':
                            color = 'green';
                            break;
                        case 'yellow':
                            color = 'yellow';
                            break;
                        case 'orange':
                            color = 'orange';
                            break;
                        case 'red':
                            color = 'red';
                            break;
                        default:
                            color = 'gray';
                    }

                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
                    });
                    feature.set('eqId', featureData.id);
                    feature.set('alertColor', color);
                    feature.set('mag', mag);
                    feature.set('place', place);
                    feature.set('time', time);
                    feature.set('title', title);
                    feature.set('formattedTime', formattedTime);
                    feature.set('flash', false);
                    feature.set('selected', false);

                    vectorSource.addFeature(feature);

                    allEarthquakes.push({
                        id: featureData.id,
                        mag,
                        place,
                        alert,
                        lon,
                        lat,
                        feature,
                        formattedTime
                    });
                }
            }
        });

        const vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            name: 'earthquakeLayer',
            style: function (feature) {
                const color = feature.get('alertColor');
                const radius = feature.get('mag');
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: feature.get('flash') ? radius * 1.5 : radius,
                        stroke: new ol.style.Stroke({
                            color: color,
                            width: feature.get('flash') ? 4 : (feature.get('selected') ? 3 : 2.5)
                        }),
                        fill: new ol.style.Fill({
                            color: feature.get('flash') ? 'rgba(255, 255, 255, 0.5)' : (feature.get('selected') ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 0, 0, 0.0)')
                        })
                    })
                });
            }
        });

        map.addLayer(vectorLayer);

        // Update list based on current map extent
        updateEarthquakeList();

        // Reset map view to default
        map.getView().animate({
            center: defaultCenter,
            zoom: defaultZoom
        });
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
    }
};

// Update Earthquake List based on map extent
const updateEarthquakeList = () => {
    const extent = map.getView().calculateExtent(map.getSize());
    const listUl = document.getElementById('eq-list');
    listUl.innerHTML = `
        <li class="eq-item header">
            <span class="location">Location</span>
            <span class="magnitude">Magnitude</span>
        </li>
    `;
    allEarthquakes
        .filter(eq => {
            const coords = ol.proj.fromLonLat([eq.lon, eq.lat]);
            return ol.extent.containsXY(extent, coords[0], coords[1]);
        })
        .sort((a, b) => b.mag - a.mag)
        .forEach(eq => {
            const li = document.createElement('li');
            li.className = 'eq-item';
            li.innerHTML = `
                <span class="location">${eq.place}<br><small>${eq.formattedTime}</small></span>
                <span class="magnitude">${eq.mag}</span>
            `;
            li.dataset.eqid = eq.id;
            li.onclick = () => {
                if (selectedItem === li) {
                    // Unselect
                    li.classList.remove('selected');
                    selectedItem = null;
                    if (selectedFeature) {
                        selectedFeature.set('flash', false);
                        selectedFeature.set('selected', false);
                        selectedFeature.changed();
                        selectedFeature = null;
                    }
                    map.getView().animate({
                        center: defaultCenter,
                        zoom: defaultZoom
                    });
                } else {
                    // Select
                    if (selectedItem) {
                        selectedItem.classList.remove('selected');
                    }
                    li.classList.add('selected');
                    selectedItem = li;
                    if (selectedFeature) {
                        selectedFeature.set('flash', false);
                        selectedFeature.set('selected', false);
                        selectedFeature.changed();
                    }
                    eq.feature.set('selected', true);
                    flashFeature(eq.feature);
                    selectedFeature = eq.feature;
                    const coord = ol.proj.fromLonLat([eq.lon, eq.lat]);
                    map.getView().animate({
                        center: coord,
                        zoom: 8
                    });
                }
            };
            listUl.appendChild(li);
            if (selectedFeature && eq.id === selectedFeature.get('eqId')) {
                li.classList.add('selected');
                selectedItem = li;
            }
        });
};

// Create Layer Visibility Control
const createLayerVisibilityControl = () => {
    const layerControl = document.createElement('div');
    layerControl.className = 'layer-control';

    // Checkbox for Tectonic Plates
    const tectonicCheckbox = document.createElement('input');
    tectonicCheckbox.type = 'checkbox';
    tectonicCheckbox.checked = true;
    tectonicCheckbox.onchange = function () {
        tectonicLayer0.setVisible(this.checked);
        tectonicLayer1.setVisible(this.checked);
    };

    const tectonicLabel = document.createElement('label');
    tectonicLabel.textContent = 'Tectonic Plates';
    layerControl.appendChild(tectonicCheckbox);
    layerControl.appendChild(tectonicLabel);
    layerControl.appendChild(document.createElement('br'));

    // Checkbox for Fault Layer
    const faultCheckbox = document.createElement('input');
    faultCheckbox.type = 'checkbox';
    faultCheckbox.checked = true;
    faultCheckbox.onchange = function () {
        faultLayer.setVisible(this.checked);
    };

    const faultLabel = document.createElement('label');
    faultLabel.textContent = 'Fault Lines';
    layerControl.appendChild(faultCheckbox);
    layerControl.appendChild(faultLabel);

    document.getElementById('earthquakeMap').appendChild(layerControl);
};

// Create Left Controls
const createLeftControls = () => {
    const leftContainer = document.querySelector('.left-container');

    // Earthquake list title
    const listTitle = document.createElement('h4');
    listTitle.textContent = 'Earthquakes List';
    listTitle.className = 'list-title';
    leftContainer.appendChild(listTitle);

    // Date selectors
    const dateDiv = document.createElement('div');
    dateDiv.className = 'date-selector';

    const fromLabel = document.createElement('label');
    fromLabel.textContent = 'From: ';
    const fromDate = document.createElement('input');
    fromDate.type = 'date';
    fromDateInput = fromDate;

    const toLabel = document.createElement('label');
    toLabel.textContent = ' To: ';
    const toDate = document.createElement('input');
    toDate.type = 'date';
    toDateInput = toDate;

    const today = new Date();
    const thirtyDaysAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const formatDate = (date) => date.toISOString().split('T')[0];

    fromDate.min = formatDate(thirtyDaysAgo);
    fromDate.max = formatDate(today);
    fromDate.value = formatDate(thirtyDaysAgo);

    toDate.min = formatDate(thirtyDaysAgo);
    toDate.max = formatDate(today);
    toDate.value = formatDate(today);

    dateDiv.appendChild(fromLabel);
    dateDiv.appendChild(fromDate);
    dateDiv.appendChild(toLabel);
    dateDiv.appendChild(toDate);
    leftContainer.appendChild(dateDiv);

    // Alert wrapper for selector and reference chart
    const alertWrapper = document.createElement('div');
    alertWrapper.className = 'alert-wrapper';

    // Alert selector
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert-selector';

    const alertLabel = document.createElement('label');
    alertLabel.textContent = 'Alert Level: ';
    const dropdown = document.createElement('select');
    alertDropdown = dropdown;
    const alertOptions = [
        { value: '', text: 'All Alerts' },
        { value: 'green', text: 'Green Alert' },
        { value: 'yellow', text: 'Yellow Alert' },
        { value: 'orange', text: 'Orange Alert' },
        { value: 'red', text: 'Red Alert' }
    ];

    alertOptions.forEach(optionData => {
        const option = document.createElement('option');
        option.value = optionData.value;
        option.text = optionData.text;
        dropdown.appendChild(option);
    });

    alertDiv.appendChild(alertLabel);
    alertDiv.appendChild(dropdown);

    const infoBtn = document.createElement('button');
    infoBtn.className = 'info-btn';
    infoBtn.textContent = '?';
    alertDiv.appendChild(infoBtn);
    alertWrapper.appendChild(alertDiv);

    // Reference chart
    const referenceContainer = document.createElement('div');
    referenceContainer.className = 'pager-tooltip';
    referenceContainer.innerHTML = `
        <div class="reference-content">
            <h3>The PAGER Earthquake Impact Scale</h3>
            <table>
                <thead>
                    <tr>
                        <th>Alert Level</th>
                        <th>Fatalities</th>
                        <th>Losses (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="color: red;">Red</td>
                        <td>1,000+</td>
                        <td>$1B+</td>
                    </tr>
                    <tr>
                        <td style="color: orange;">Orange</td>
                        <td>100–999</td>
                        <td>$100M–$1B</td>
                    </tr>
                    <tr>
                        <td style="color: yellow;">Yellow</td>
                        <td>1–99</td>
                        <td>$1M–$100M</td>
                    </tr>
                    <tr>
                        <td style="color: green;">Green</td>
                        <td>0</td>
                        <td>&lt; $1M</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
    alertWrapper.appendChild(referenceContainer);

    leftContainer.appendChild(alertWrapper);

    // Earthquake list
    const listUl = document.createElement('ul');
    listUl.id = 'eq-list';
    listUl.className = 'earthquake-list';
    leftContainer.appendChild(listUl);

    // Event listeners
    const updateData = async () => {
        let start = new Date(fromDateInput.value);
        let end = new Date(toDateInput.value);
        end.setHours(23, 59, 59, 999);
        if (start > end) {
            start = end;
        }
        await fetchEarthquakeData(alertDropdown.value, start, end);
    };

    fromDate.onchange = updateData;
    toDate.onchange = updateData;
    dropdown.onchange = updateData;
};
