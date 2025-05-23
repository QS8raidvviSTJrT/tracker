// Globale Variable für die Karte
let map = null;
let markersLayerGroup = null; // Eine LayerGroup für alle Marker
let isLoadingMapEntries = false; // Flag, um parallele Ausführungen zu verhindern

// Konfiguration für Marker-Farben basierend auf Status (ähnlich wie in app.js)
const statusColorsMap = {
    'Geschrieben': 'var(--success-color, green)',
    'Kein Interesse': 'var(--danger-color, red)',
    'Nicht geöffnet': 'var(--warning-color, orange)',
    'Andere': 'var(--info-color, blue)',
    'null': 'var(--text-color-muted, grey)' // Für Einträge ohne Status oder unbekannten Status
};

/**
 * Initialisiert die Leaflet-Karte.
 * Diese Funktion sollte aufgerufen werden, wenn die Kartenansicht aktiv wird.
 */
function initMap() {
    console.log("[map.js] initMap START");
    const mapElement = document.getElementById('mapViewMapContainer');
    if (!mapElement) {
        console.error("[map.js] Karten-Container 'mapViewMapContainer' nicht im DOM gefunden!");
        if (typeof showErrorNotification === 'function') {
            showErrorNotification("Karten-Container 'mapViewMapContainer' nicht im DOM gefunden!");
        }
        console.log("[map.js] initMap END (no mapElement)");
        return;
    }

    if (map && map.getContainer() === mapElement) {
        console.log("[map.js] initMap: Karte bereits initialisiert und am Container gebunden.");
        if (markersLayerGroup && typeof markersLayerGroup.clearLayers === 'function') {
            console.log("[map.js] initMap: Bestehende markersLayerGroup ist gültig, clearLayers().");
            markersLayerGroup.clearLayers();
        } else {
            console.warn("[map.js] initMap: Bestehende markersLayerGroup war nicht gültig. Erstelle neu.");
            if (markersLayerGroup && typeof markersLayerGroup.remove === 'function') {
                try { markersLayerGroup.remove(); } catch (e) { console.warn("[map.js] Konnte alte, potenziell ungültige markersLayerGroup nicht entfernen:", e); }
            }
            markersLayerGroup = L.layerGroup().addTo(map);
            console.log("[map.js] initMap: Neue markersLayerGroup zur existierenden Karte hinzugefügt.");
        }
        loadAndDisplayEntriesOnMap();
        console.log("[map.js] initMap END (existing map, layers updated/recreated)");
        return;
    }

    if (map) {
        console.log("[map.js] initMap: Entferne existierende, aber nicht passende Karteninstanz.");
        map.remove();
        map = null;
    }
    if (markersLayerGroup) {
        console.log("[map.js] initMap: Entferne existierende markersLayerGroup-Referenz.");
        if (typeof markersLayerGroup.remove === 'function') {
            try {
                markersLayerGroup.remove();
            } catch(e) {
                console.warn("[map.js] Fehler beim Entfernen der alten markersLayerGroup:", e);
            }
        }
        markersLayerGroup = null;
    }

    console.log("[map.js] initMap: Initialisiere Karte und markersLayerGroup neu.");
    map = L.map(mapElement).setView([51.1657, 10.4515], 6);
    console.log("[map.js] initMap: Neue 'map' Instanz erstellt:", map ? 'OK' : 'FEHLER');

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    markersLayerGroup = L.layerGroup().addTo(map);
    console.log("[map.js] initMap: Neue 'markersLayerGroup' Instanz erstellt und zu map hinzugefügt:", markersLayerGroup ? 'OK' : 'FEHLER', markersLayerGroup && markersLayerGroup._map ? 'Verbunden mit Karte' : 'Nicht verbunden');

    // Wichtig: Größe der Karte validieren, nachdem sie sichtbar und im DOM ist
    // Die switchView Funktion sollte sicherstellen, dass der Container sichtbar ist.
    // Ein kleiner Timeout kann helfen, falls CSS-Transitions involviert sind.
    setTimeout(() => {
        if (map) {
            console.log("[map.js] initMap: map.invalidateSize() wird aufgerufen.");
            map.invalidateSize();
        }
    }, 100); // Erhöhter Timeout für invalidateSize

    loadAndDisplayEntriesOnMap();
    console.log("[map.js] initMap END (new map initialized)");
}

/**
 * Lädt Hausnummern-Einträge aus der Datenbank und zeigt sie auf der Karte an.
 */
async function loadAndDisplayEntriesOnMap() {
    if (isLoadingMapEntries) {
        console.warn("[map.js] loadAndDisplayEntriesOnMap wird bereits ausgeführt. Neuer Aufruf ignoriert.");
        return;
    }
    isLoadingMapEntries = true;
    console.log("[map.js] loadAndDisplayEntriesOnMap START");

    const currentMapInstanceAtStart = map; // Globale 'map' Instanz zu Beginn merken
    const targetMarkersLayerGroup = markersLayerGroup; // Globale 'markersLayerGroup' Instanz zu Beginn merken

    console.log("[map.js] loadAndDisplayEntriesOnMap: currentMapInstanceAtStart", currentMapInstanceAtStart ? 'OK' : 'NULL');
    console.log("[map.js] loadAndDisplayEntriesOnMap: targetMarkersLayerGroup", targetMarkersLayerGroup ? 'OK' : 'NULL', targetMarkersLayerGroup && targetMarkersLayerGroup._map ? `Verbunden mit Karte ID: ${targetMarkersLayerGroup._map._leaflet_id}` : 'Nicht verbunden oder _map fehlt');
    if(currentMapInstanceAtStart) console.log("[map.js] loadAndDisplayEntriesOnMap: currentMapInstanceAtStart ID:", currentMapInstanceAtStart._leaflet_id);


    const mapLoadingIndicator = document.getElementById('mapViewLoadingIndicator');

    if (!currentMapInstanceAtStart || !targetMarkersLayerGroup) {
        console.warn("[map.js] Karte oder targetMarkersLayerGroup nicht initialisiert beim Start von loadAndDisplayEntriesOnMap.");
        if (mapLoadingIndicator) mapLoadingIndicator.style.display = 'none';
        isLoadingMapEntries = false;
        console.log("[map.js] loadAndDisplayEntriesOnMap END (early exit, no map/layergroup)");
        return;
    }

    if (typeof targetMarkersLayerGroup.clearLayers === 'function') {
        targetMarkersLayerGroup.clearLayers();
        console.log("[map.js] loadAndDisplayEntriesOnMap: targetMarkersLayerGroup.clearLayers() aufgerufen.");
    } else {
        console.warn("[map.js] loadAndDisplayEntriesOnMap: targetMarkersLayerGroup hat keine clearLayers Methode.");
        if (mapLoadingIndicator) mapLoadingIndicator.style.display = 'none';
        isLoadingMapEntries = false;
        console.log("[map.js] loadAndDisplayEntriesOnMap END (early exit, no clearLayers)");
        return;
    }
    
    if (typeof supabaseClient === 'undefined') {
        console.error("[map.js] Supabase Client nicht verfügbar.");
        if (typeof showErrorNotification === 'function') showErrorNotification("Supabase Client nicht verfügbar für Kartenfunktion.");
        if (mapLoadingIndicator) mapLoadingIndicator.style.display = 'none';
        isLoadingMapEntries = false;
        console.log("[map.js] loadAndDisplayEntriesOnMap END (no supabaseClient)");
        return;
    }

    if (mapLoadingIndicator) mapLoadingIndicator.style.display = 'flex';

    try {
        const { data: streets, error: streetsError } = await supabaseClient
            .from('streets')
            .select('id, name, postal_code');

        if (map !== currentMapInstanceAtStart) {
            console.warn("[map.js] Karteninstanz nach DB-Abfrage (streets) geändert. Breche ab.");
            isLoadingMapEntries = false; return;
        }
        if (streetsError) {
            console.error("Fehler beim Abrufen der Straßen für die Karte:", streetsError);
            if (typeof showErrorNotification === 'function') showErrorNotification("Fehler beim Laden der Straßendaten für die Karte: " + streetsError.message);
            isLoadingMapEntries = false; return;
        }
        if (!streets || streets.length === 0) {
            console.log("Keine Straßen in der Datenbank gefunden.");
            isLoadingMapEntries = false; return;
        }

        const streetInfoMap = new Map();
        streets.forEach(street => streetInfoMap.set(street.id, street));

        const { data: entries, error: entriesError } = await supabaseClient
            .from('house_entries')
            .select('id, street_id, house_number, name, status, notes');
        
        if (map !== currentMapInstanceAtStart) {
            console.warn("[map.js] Karteninstanz nach DB-Abfrage (entries) geändert. Breche ab.");
            isLoadingMapEntries = false; return;
        }
        if (entriesError) {
            console.error("Fehler beim Abrufen der Hausnummern-Einträge für die Karte:", entriesError);
            if (typeof showErrorNotification === 'function') showErrorNotification("Fehler beim Laden der Einträge für die Karte: " + entriesError.message);
            isLoadingMapEntries = false; return;
        }
        if (!entries || entries.length === 0) {
            console.log("Keine Hausnummern-Einträge gefunden.");
            const noDataMessage = L.control({position: 'center'});
            noDataMessage.onAdd = function (mapCtrl) {
                var div = L.DomUtil.create('div', 'no-data-map-message');
                div.innerHTML = "<h4>Keine Einträge vorhanden</h4><p>Es wurden noch keine Daten erfasst, die auf der Karte angezeigt werden können.</p>";
                return div;
            };
            if (map === currentMapInstanceAtStart && !currentMapInstanceAtStart.hasLayer(noDataMessage) && !document.querySelector('.no-data-map-message')) {
            }
            isLoadingMapEntries = false; return;
        }

        console.log(`[map.js] Verarbeite ${entries.length} Einträge für die Karte.`);
        let geocodedCount = 0;
        const geocodingPromises = [];

        for (let i = 0; i < entries.length; i++) {
            if (map !== currentMapInstanceAtStart) {
                console.warn("[map.js] Karteninstanz während der Geokodierungsschleife geändert. Breche ab.");
                isLoadingMapEntries = false; return;
            }

            const entry = entries[i];
            const streetData = streetInfoMap.get(entry.street_id);
            if (streetData && entry.house_number) {
                const address = `${streetData.name} ${entry.house_number}, ${streetData.postal_code}, Deutschland`;
                geocodingPromises.push(
                    geocodeAddressWithCache(address)
                    .then(coords => {
                        if (map !== currentMapInstanceAtStart || !targetMarkersLayerGroup || !targetMarkersLayerGroup._map || targetMarkersLayerGroup._map !== map ) {
                            console.warn(`[map.js] Karten- oder LayerGroup-Instanz ungültig vor Marker-Hinzufügung für ${address}. Aktuelle Map ID: ${map ? map._leaflet_id : 'null'}, Start Map ID: ${currentMapInstanceAtStart._leaflet_id}. LayerGroup Map ID: ${targetMarkersLayerGroup && targetMarkersLayerGroup._map ? targetMarkersLayerGroup._map._leaflet_id : 'null'}`);
                            return;
                        }
                        console.log(`[map.js] Geokodierung für ${address} ERFOLGREICH: ${coords ? JSON.stringify(coords) : 'null'}`);
                        if (coords) {
                            geocodedCount++;
                            const color = statusColorsMap[entry.status] || statusColorsMap['null'];
                            const marker = L.circleMarker([coords.lat, coords.lon], {
                                radius: 7,
                                fillColor: color,
                                color: "var(--border-color-strong, #333)",
                                weight: 1,
                                opacity: 1,
                                fillOpacity: 0.8
                            }).addTo(targetMarkersLayerGroup); // Marker zur targetMarkersLayerGroup hinzufügen

                            let popupContent = `<b>${mapEscapeHtml(streetData.name)} ${mapEscapeHtml(entry.house_number)}</b><br>PLZ: ${mapEscapeHtml(streetData.postal_code)}`;
                            if (entry.name) popupContent += `<br>Name: ${mapEscapeHtml(entry.name)}`;
                            popupContent += `<br>Status: ${mapEscapeHtml(entry.status) || 'Unbekannt'}`;
                            if (entry.notes) popupContent += `<br>Notiz: ${mapEscapeHtml(entry.notes.substring(0,70))}${entry.notes.length > 70 ? '...' : ''}`;
                            marker.bindPopup(popupContent);
                            console.log(`[map.js] Marker für ${address} zu targetMarkersLayerGroup (ID: ${targetMarkersLayerGroup._leaflet_id}) hinzugefügt. Aktuelle Layer Count in target: ${targetMarkersLayerGroup.getLayers().length}`);
                        } else {
                            console.warn(`[map.js] Adresse konnte nicht geokodiert werden: ${address}`);
                        }
                    })
                    .catch(err => console.error(`[map.js] Fehler bei Geokodierung für ${address}:`, err))
                );
            }
            if (i > 0 && i % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
                 if (map !== currentMapInstanceAtStart) {
                    console.warn("[map.js] Karteninstanz nach Pause in Geokodierungsschleife geändert. Breche ab.");
                    isLoadingMapEntries = false; return;
                }
            }
        }

        await Promise.allSettled(geocodingPromises);
        console.log(`[map.js] loadAndDisplayEntriesOnMap: Promise.allSettled für Geokodierung abgeschlossen.`);

        if (map !== currentMapInstanceAtStart) {
            console.warn("[map.js] Karteninstanz nach Promise.allSettled geändert. Breche fitBounds ab.");
            isLoadingMapEntries = false; return;
        }

        console.log(`[map.js] loadAndDisplayEntriesOnMap: ${geocodedCount} von ${entries.length} Einträgen geokodiert.`);
        console.log(`[map.js] loadAndDisplayEntriesOnMap: targetMarkersLayerGroup (lokal, zu der hinzugefügt wurde) Layer Count VOR fitBounds: ${targetMarkersLayerGroup ? targetMarkersLayerGroup.getLayers().length : 'targetMarkersLayerGroup ist null/undefined'}`);
        console.log(`[map.js] loadAndDisplayEntriesOnMap: Globale 'markersLayerGroup' Layer Count VOR fitBounds: ${markersLayerGroup ? markersLayerGroup.getLayers().length : 'markersLayerGroup ist null/undefined'}`);


        // Wichtig: Verwende 'map' (die aktuelle globale Karte) und 'targetMarkersLayerGroup'
        // (die LayerGroup, zu der Marker hinzugefügt wurden und die zu Beginn die globale war).
        // Die entscheidende Prüfung ist, ob 'targetMarkersLayerGroup' immer noch mit der *aktuellen* 'map' verbunden ist.
        if (!map || !targetMarkersLayerGroup || !targetMarkersLayerGroup._map || targetMarkersLayerGroup._map !== map) {
             console.warn("[map.js] loadAndDisplayEntriesOnMap: Globale 'map' oder 'targetMarkersLayerGroup' ungültig/nicht synchron VOR fitBounds. Breche ab.",
                `map: ${map ? map._leaflet_id : 'null'}`,
                `targetMarkersLayerGroup: ${targetMarkersLayerGroup ? targetMarkersLayerGroup._leaflet_id : 'null'}`,
                `targetMarkersLayerGroup._map: ${targetMarkersLayerGroup && targetMarkersLayerGroup._map ? targetMarkersLayerGroup._map._leaflet_id : 'null'}`
             );
             isLoadingMapEntries = false; return;
        }

        // Nun prüfen wir die LayerGroup, zu der die Marker tatsächlich hinzugefügt wurden.
        if (targetMarkersLayerGroup.getLayers && targetMarkersLayerGroup.getLayers().length > 0 && typeof targetMarkersLayerGroup.getBounds === 'function') {
            try {
                const bounds = targetMarkersLayerGroup.getBounds();
                if (bounds && bounds.isValid()) {
                    console.log("[map.js] loadAndDisplayEntriesOnMap: Gültige Bounds von targetMarkersLayerGroup gefunden, rufe map.fitBounds auf.");
                    map.fitBounds(bounds, { padding: [50, 50] });
                } else {
                    // Fallback, wenn Bounds nicht valide sind, aber Marker existieren sollten
                    console.warn(`[map.js] targetMarkersLayerGroup.getBounds() gab ungültige Bounds zurück, obwohl ${geocodedCount} Marker geokodiert wurden und ${targetMarkersLayerGroup.getLayers().length} Layer vorhanden sind. Setze Standardansicht.`);
                    map.setView([51.1657, 10.4515], geocodedCount > 0 ? 10 : 6);
                }
            } catch (e) {
                console.error("[map.js] Fehler beim Aufrufen von map.fitBounds oder targetMarkersLayerGroup.getBounds:", e);
                if (typeof showErrorNotification === 'function') showErrorNotification("Fehler beim Anpassen der Kartenansicht.");
                map.setView([51.1657, 10.4515], 6);
            }
        } else if (entries && entries.length > 0 && geocodedCount === 0) {
            console.log("[map.js] loadAndDisplayEntriesOnMap: Einträge vorhanden, aber keiner geokodiert. Setze Standardansicht.");
            if (typeof showErrorNotification === 'function') showErrorNotification("Keiner der Einträge konnte geokodiert werden. Überprüfen Sie die Adressen.");
            map.setView([51.1657, 10.4515], 6);
        } else {
            console.log(`[map.js] loadAndDisplayEntriesOnMap: Bedingung für fitBounds mit targetMarkersLayerGroup NICHT erfüllt. Layer Count: ${targetMarkersLayerGroup.getLayers ? targetMarkersLayerGroup.getLayers().length : 'getLayers nicht vorhanden'}. typeof getBounds: ${typeof targetMarkersLayerGroup.getBounds}. Setze Standardansicht.`);
            map.setView([51.1657, 10.4515], 6);
        }

    } catch (error) {
        console.error("[map.js] Allgemeiner Fehler in loadAndDisplayEntriesOnMap:", error);
        if (typeof showErrorNotification === 'function') showErrorNotification("Karten-Daten konnten nicht vollständig geladen werden: " + error.message);
    } finally {
        if (mapLoadingIndicator) mapLoadingIndicator.style.display = 'none';
        isLoadingMapEntries = false;
        console.log("[map.js] loadAndDisplayEntriesOnMap END");
    }
}

const geocodeCache = new Map();
const GEOCODE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Stunden
let nominatimRequestQueue = Promise.resolve(); // Sequenzielle Warteschlange für Nominatim-Anfragen

async function geocodeAddressWithCache(address) {
    const cached = geocodeCache.get(address);
    if (cached && (Date.now() - cached.timestamp < GEOCODE_CACHE_DURATION)) {
        // console.log(`[Cache HIT] Geocode für: ${address}`);
        return cached.coords;
    }

    return nominatimRequestQueue = nominatimRequestQueue.then(async () => {
        await new Promise(resolve => setTimeout(resolve, 1100)); 

        console.log(`[API Call] Geocode für: ${address}`);
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&addressdetails=0`;

        try {
            const response = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (!response.ok) {
                console.warn(`[map.js] Nominatim API Fehler für "${address}": ${response.status} ${response.statusText}`);
                if (response.status === 429 && typeof showErrorNotification === 'function') {
                    showErrorNotification("Nominatim API Limit erreicht. Bitte später erneut versuchen.");
                }
                geocodeCache.set(address, { coords: null, timestamp: Date.now() });
                return null;
            }
            const data = await response.json();

            if (data && data.length > 0) {
                const result = data[0];
                const coords = { lat: parseFloat(result.lat), lon: parseFloat(result.lon) };
                geocodeCache.set(address, { coords: coords, timestamp: Date.now() });
                return coords;
            } else {
                console.warn(`[map.js] Keine Geokodierungsergebnisse für: ${address}`);
                geocodeCache.set(address, { coords: null, timestamp: Date.now() });
                return null;
            }
        } catch (error) {
            console.error(`[map.js] Netzwerkfehler/JSON-Parse-Fehler beim Geokodieren von "${address}":`, error);
            return null;
        }
    }).catch(err => {
        console.error(`[map.js] Fehler in Nominatim Request Queue für Adresse ${address}:`, err);
        return null;
    });
}

function mapEscapeHtml(unsafe) {
    if (typeof escapeHtml === 'function') {
        return escapeHtml(unsafe);
    }
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return String(unsafe)
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Die globale showErrorNotification Funktion wird hier als existent angenommen.
// Falls sie nicht global ist, muss sie hierher kopiert oder importiert werden.
// function showErrorNotification(message) { ... }
