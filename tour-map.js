import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.11.2/dist/maplibre-gl.mjs';

const shell = document.querySelector('[data-live-map]');

if (shell) {
  const section = document.querySelector('[data-live-map-section]');
  const loading = shell.querySelector('[data-map-loading]');
  const replay = shell.querySelector('[data-map-replay]');
  const mapPhase = shell.querySelector('[data-map-phase]');
  const mapLeg = shell.querySelector('[data-map-leg]');
  const mapRoute = shell.querySelector('[data-map-route]');
  const cityLabel = section?.querySelector('[data-flight-city]');
  const dateLabel = section?.querySelector('[data-flight-date]');
  const venueLabel = section?.querySelector('[data-flight-venue]');
  const stateLabel = section?.querySelector('[data-flight-state]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stops = [
    { city: 'London', date: 'October 16 & 19', venue: 'Top Secret Comedy Club', coordinates: [-0.1276, 51.5072] },
    { city: 'Amsterdam', date: 'October 23', venue: 'Boom Chicago · Rozentheater', coordinates: [4.9041, 52.3676] },
    { city: 'Berlin', date: 'October 26', venue: 'Cosmic Comedy Club', coordinates: [13.405, 52.52] },
    { city: 'Düsseldorf', date: 'October 27', venue: "Felix Lobrecht's Club", coordinates: [6.7735, 51.2277] },
    { city: 'Munich', date: 'October 29', venue: 'Comedy für Freunde', coordinates: [11.582, 48.1351] },
    { city: 'Paris', date: 'November 3–8', venue: 'Choumy Comedy Club', coordinates: [2.3522, 48.8566] }
  ];
  const routeData = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [stops[0].coordinates, stops[0].coordinates] } };
  const flightData = { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [stops[0].coordinates, stops[0].coordinates] } };
  let map;
  let plane;
  let markers = [];
  let currentStop = 0;
  let routeCoordinates = [stops[0].coordinates];
  let timer;
  let running = false;

  const curveControl = (from, to) => {
    const lift = Math.min(.68, Math.max(.28, Math.abs(to[0] - from[0]) * .06));
    return [(from[0] + to[0]) / 2, Math.max(from[1], to[1]) + lift];
  };

  const pointOnCurve = (from, to, control, progress) => {
    const inverse = 1 - progress;
    return [
      inverse * inverse * from[0] + 2 * inverse * progress * control[0] + progress * progress * to[0],
      inverse * inverse * from[1] + 2 * inverse * progress * control[1] + progress * progress * to[1]
    ];
  };

  const createCurve = (from, to, steps = 181, control = curveControl(from, to)) =>
    Array.from({ length: steps }, (_, index) => pointOnCurve(from, to, control, index / (steps - 1)));

  const setDeck = (index, flying = false) => {
    const from = stops[Math.max(0, index - 1)];
    const stop = stops[index];
    if (mapPhase) mapPhase.textContent = flying ? 'Now flying' : index === 0 ? 'Tour begins' : 'Touchdown';
    if (mapLeg) mapLeg.textContent = `${String(index + 1).padStart(2, '0')} / ${String(stops.length).padStart(2, '0')}`;
    if (mapRoute) mapRoute.textContent = flying ? `${from.city} → ${stop.city}` : `${stop.city} · landed`;
  };

  const setStatus = (index, flying = false) => {
    const stop = stops[index];
    if (cityLabel) cityLabel.textContent = flying ? 'Somewhere new…' : `${stop.city}.`;
    if (dateLabel) dateLabel.textContent = flying ? 'Destination incoming' : stop.date;
    if (venueLabel) venueLabel.textContent = flying ? 'The city appears when the plane lands.' : stop.venue;
    if (stateLabel) stateLabel.textContent = flying ? 'In flight' : index === 0 ? 'First destination' : `Arrived in ${stop.city}`;
    setDeck(index, flying);
  };

  const setCurrentMarker = (index) => {
    markers.forEach((marker, markerIndex) => {
      const element = marker.getElement();
      element.classList.toggle('is-current', markerIndex === index);
      if (markerIndex === index) element.classList.add('is-revealed');
    });
  };

  const updateRoute = (coordinates) => {
    routeData.geometry.coordinates = coordinates.length > 1 ? coordinates : [coordinates[0], coordinates[0]];
    map.getSource('tour-route')?.setData(routeData);
  };

  const updateFlight = (coordinates) => {
    const fallback = coordinates[0] || stops[currentStop].coordinates;
    flightData.geometry.coordinates = coordinates.length > 1 ? coordinates : [fallback, fallback];
    map.getSource('active-flight')?.setData(flightData);
  };

  const pointAlong = (from, to, progress) => [
    from[0] + (to[0] - from[0]) * progress,
    from[1] + (to[1] - from[1]) * progress
  ];

  const turnPlane = (from, to, control, progress) => {
    const behind = map.project(pointOnCurve(from, to, control, Math.max(0, progress - .006)));
    const ahead = map.project(pointOnCurve(from, to, control, Math.min(1, progress + .006)));
    const pathAngle = Math.atan2(ahead.y - behind.y, ahead.x - behind.x) * 180 / Math.PI;
    plane.getElement().style.setProperty('--plane-heading', `${pathAngle + 45}deg`);
  };

  const flyTo = (nextIndex) => {
    if (running || nextIndex >= stops.length) return;
    running = true;
    setStatus(nextIndex, true);
    markers.forEach((marker) => marker.getElement().classList.remove('is-current'));
    const from = stops[currentStop].coordinates;
    const to = stops[nextIndex].coordinates;
    const control = curveControl(from, to);
    const curve = createCurve(from, to, 181, control);
    const started = performance.now();
    const duration = reduceMotion ? 1 : 3200;
    const cameraStart = [map.getCenter().lng, map.getCenter().lat];
    const startingZoom = map.getZoom();
    const followZoom = 5.7;
    let lastTrailUpdate = 0;
    plane.getElement().classList.add('is-flying');

    const frame = (now) => {
      const raw = Math.min(1, (now - started) / duration);
      const progress = .5 - Math.cos(raw * Math.PI) / 2;
      const pointIndex = Math.min(curve.length - 1, Math.floor(progress * (curve.length - 1)));
      const point = pointOnCurve(from, to, control, progress);
      plane.setLngLat(point);
      if (!reduceMotion) {
        const cameraCatchUp = Math.min(1, raw / .16);
        map.jumpTo({
          center: pointAlong(cameraStart, point, cameraCatchUp),
          zoom: startingZoom + (followZoom - startingZoom) * Math.min(1, raw / .22),
          pitch: 0,
          bearing: 0
        });
      }
      turnPlane(from, to, control, progress);
      if (raw === 1 || now - lastTrailUpdate >= 48) {
        updateFlight([...curve.slice(0, pointIndex), point]);
        lastTrailUpdate = now;
      }
      if (raw < 1) {
        requestAnimationFrame(frame);
        return;
      }
      currentStop = nextIndex;
      routeCoordinates.push(...curve.slice(1));
      updateRoute(routeCoordinates);
      updateFlight([to]);
      plane.getElement().classList.remove('is-flying');
      setCurrentMarker(currentStop);
      setStatus(currentStop);
      running = false;
      if (currentStop < stops.length - 1) timer = window.setTimeout(() => flyTo(currentStop + 1), 1600);
      else {
        replay.hidden = true;
        if (mapPhase) mapPhase.textContent = 'Route complete';
        if (mapRoute) mapRoute.textContent = 'Restarting from London…';
        window.setTimeout(() => map.easeTo({ center: [6.4, 50.65], zoom: 5.12, pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 1800 }), 900);
        timer = window.setTimeout(resetJourney, 5200);
      }
    };
    requestAnimationFrame(frame);
  };

  const resetJourney = () => {
    window.clearTimeout(timer);
    running = false;
    currentStop = 0;
    routeCoordinates = [stops[0].coordinates];
    updateRoute(routeCoordinates);
    updateFlight([stops[0].coordinates]);
    plane.setLngLat(stops[0].coordinates);
    markers.forEach((marker, index) => {
      marker.getElement().classList.toggle('is-revealed', index === 0);
      marker.getElement().classList.toggle('is-current', index === 0);
    });
    setStatus(0);
    map.easeTo({ center: [6.4, 50.65], zoom: 5.12, pitch: 0, bearing: 0, duration: reduceMotion ? 0 : 1200 });
    replay.hidden = true;
    timer = window.setTimeout(() => flyTo(1), 1800);
  };

  try {
    map = new maplibregl.Map({
      container: 'tour-map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [6.4, 50.65],
      zoom: 5.12,
      pitch: 0,
      bearing: 0,
      maxPitch: 0,
      minZoom: 4.2,
      maxZoom: 11,
      attributionControl: true,
      cooperativeGestures: false,
      dragRotate: false,
      pitchWithRotate: false
    });

    map.on('load', () => {
      map.getStyle().layers
        .filter((layer) => layer.type === 'symbol' && /poi|airport|transit/i.test(layer.id))
        .forEach((layer) => map.setLayoutProperty(layer.id, 'visibility', 'none'));
      const firstSymbol = map.getStyle().layers.find((layer) => layer.type === 'symbol')?.id;
      map.addSource('tour-route', { type: 'geojson', lineMetrics: true, data: routeData });
      map.addLayer({ id: 'tour-route-glow', type: 'line', source: 'tour-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': 8, 'line-opacity': .72, 'line-blur': 2 } }, firstSymbol);
      map.addLayer({ id: 'tour-route-line', type: 'line', source: 'tour-route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-gradient': ['interpolate', ['linear'], ['line-progress'], 0, '#179fc5', 1, '#6242e8'], 'line-width': 3.4, 'line-opacity': .92 } }, firstSymbol);
      map.addSource('active-flight', { type: 'geojson', data: flightData });
      map.addLayer({ id: 'active-flight-glow', type: 'line', source: 'active-flight', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#080713', 'line-width': 9, 'line-opacity': .7, 'line-blur': 1 } }, firstSymbol);
      map.addLayer({ id: 'active-flight-line', type: 'line', source: 'active-flight', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#d7ff3f', 'line-width': 4, 'line-opacity': 1 } }, firstSymbol);

      markers = stops.map((stop, index) => {
        const element = document.createElement('div');
        element.className = `geo-stop${index === 0 ? ' is-revealed is-current' : ''}`;
        element.innerHTML = `<span class="geo-stop-dot"></span><b class="geo-stop-label">${stop.city}</b>`;
        return new maplibregl.Marker({ element, anchor: 'center' }).setLngLat(stop.coordinates).addTo(map);
      });

      const planeElement = document.createElement('div');
      planeElement.className = 'geo-plane';
      planeElement.innerHTML = '<span>✈</span>';
      plane = new maplibregl.Marker({ element: planeElement, anchor: 'center' }).setLngLat(stops[0].coordinates).addTo(map);
      const openingControl = curveControl(stops[0].coordinates, stops[1].coordinates);
      turnPlane(stops[0].coordinates, stops[1].coordinates, openingControl, 0);
      setStatus(0);
      loading?.classList.add('is-ready');
      if (reduceMotion) {
        markers.forEach((marker) => marker.getElement().classList.add('is-revealed'));
        replay.hidden = false;
      } else {
        timer = window.setTimeout(() => flyTo(1), 1800);
      }
    });

    replay?.addEventListener('click', resetJourney);
  } catch (error) {
    if (loading) loading.innerHTML = '<span></span>3D map unavailable on this device';
  }
}
