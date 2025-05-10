const supabaseUrl = 'https://pvjjtwuaofclmsvsaneo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amp0d3Vhb2ZjbG1zdnNhbmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzM2OTksImV4cCI6MjA2MjQ0OTY5OX0.yc4F3gKDGKMmws60u3KOYSM8t06rvDiJgOvEAuiYRa8'
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        let deferredPrompt;
let currentUser = null;
let currentSelectedStreetId = null; // ID der aktuell ausgewählten Straße
let currentHouseEntries = []; // Einträge für die aktuell ausgewählte Straße
let currentEditingEntryId = null; // ID des Eintrags, der gerade bearbeitet wird
let statsChartInstance = null; // Variable für die Chart-Instanz
let currentAlphabetFilter = null; // Aktuell ausgewählter Buchstabe

// --- DOM Elemente ---
const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const plzInput = document.getElementById('plzInput');
const streetListContainer = document.getElementById('streetListContainer');
const streetDetailContainer = document.getElementById('streetDetailContainer');
const searchStreetButton = document.getElementById('searchStreetButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorDisplay = document.getElementById('errorDisplay');

// NEU: Referenzen für Views und Navigationsleiste
const viewContainer = document.getElementById('viewContainer');
const views = document.querySelectorAll('.view'); // Alle Elemente mit der Klasse 'view'
const navItems = document.querySelectorAll('.nav-item'); // Alle Navigations-Buttons
const currentViewTitleElement = document.getElementById('currentViewTitle'); // Element für den Titel

// --- DOM Elemente für neue Views ---
const statsLoadingIndicator = document.getElementById('statsLoadingIndicator');
const statsErrorDisplay = document.getElementById('statsErrorDisplay');
const statsContent = document.getElementById('statsContent');
const statTotalEntries = document.getElementById('statTotalEntries');
const statCompletedEntries = document.getElementById('statCompletedEntries');
const statInterestedEntries = document.getElementById('statInterestedEntries');
const statNotInterestedEntries = document.getElementById('statNotInterestedEntries');
const statRevisitEntries = document.getElementById('statRevisitEntries');
const statNotMetEntries = document.getElementById('statNotMetEntries');
const statGeschriebenEntries = document.getElementById('statGeschriebenEntries');
const statNichtGeoeffnetEntries = document.getElementById('statNichtGeoeffnetEntries');
const statusChartCanvas = document.getElementById('statusChart');

const leaderboardLoadingIndicator = document.getElementById('leaderboardLoadingIndicator');
const leaderboardErrorDisplay = document.getElementById('leaderboardErrorDisplay');
const leaderboardContent = document.getElementById('leaderboardContent');
const leaderboardTableBody = document.querySelector('#leaderboardTable tbody');

const settingsLoadingIndicator = document.getElementById('settingsLoadingIndicator');
const settingsErrorDisplay = document.getElementById('settingsErrorDisplay');
const settingsContent = document.getElementById('settingsContent');
const displayNameInput = document.getElementById('displayNameInput');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const settingsStatus = document.getElementById('settingsStatus');

const streetListPlaceholder = document.getElementById('streetListPlaceholder'); // Referenz zum Platzhalter
const alphabetFilterContainer = document.getElementById('alphabetFilterContainer'); // NEU

// NEU: Referenzen für Login-Elemente
const loginEmailInput = document.getElementById('loginEmail'); // E-Mail-Feld
const loginPasswordInput = document.getElementById('loginPassword'); // Passwortfeld

// --- PWA Installationslogik ---
        function isIos() {
    const userAgent = navigator.userAgent;
    return /iPhone|iPad|iPod/.test(userAgent) || (userAgent.includes("Mac") && "ontouchend" in document);
        }
        
        function isInStandaloneMode() {
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

        window.addEventListener('load', () => {
            const installPopup = document.getElementById('installPopup');
    if (!installPopup) return; // Falls Element nicht existiert

            const installMessage = document.getElementById('installMessage');
            const installButton = document.getElementById('installButton');
            const isAppInstalled = isInStandaloneMode();

        if (isAppInstalled) {
            installPopup.style.display = 'none';
        return;
        }

        if (isIos()) {
            installPopup.style.display = 'flex';
            installMessage.innerHTML = 'Um diese App zu installieren, tippe auf <span class="material-icons" style="vertical-align: 1%; font-size: 1.2rem;">ios_share</span> und suche nach "Zum Home-Bildschirm <span class="material-symbols-outlined" style="vertical-align: top; font-size: 1.2rem;">add_box</span>"';
        installButton.style.display = 'none';
        } else {
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
            installPopup.style.display = 'flex'; // Zeige Popup erst, wenn Prompt verfügbar
            });

            installButton.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        deferredPrompt = null;
                        installPopup.style.display = 'none';
                    });
                }
            });
        }
    });

// --- Session & Auth ---
        async function checkSession() {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            if (error) {
                console.error('Error checking session:', error.message);
        showLogin(); // Zeige Login bei Fehler
                return;
            }
            if (session) {
                currentUser = session.user;
        showApp();
    } else {
        showLogin();
    }
}

        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
        showApp();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
        showLogin();
    }
});

function showLogin() {
    loginContainer.style.display = 'block';
    appContainer.style.display = 'none';
    // Reset App State
    resetAppState();
}

function showApp() {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    getPostalCodeFromLocation(); // Versuche PLZ zu holen
    // Standardansicht beim Laden der App anzeigen
    switchView('mainView', 'SellX Solutions'); // Startet mit der Hauptansicht
    updateGreetingPlaceholder(); // NEU: Platzhalter-Begrüßung aktualisieren
    // === STELLT SICHER, DASS LISTENER HINZUGEFÜGT WERDEN ===
    setupInputFocusListeners();
    // === ENDE ===
}

function resetAppState() {
    plzInput.value = '';
    streetListContainer.innerHTML = '';
    if (streetListPlaceholder) {
         streetListContainer.appendChild(streetListPlaceholder);
         streetListPlaceholder.style.display = 'flex';
    }
    streetListContainer.style.display = 'flex';
    streetDetailContainer.innerHTML = '';
    streetDetailContainer.style.display = 'none';
    // === NEU: Alphabet-Filter ausblenden ===
    if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';
    currentAlphabetFilter = null; // Filter zurücksetzen
    // === ENDE NEU ===
    currentSelectedStreetId = null;
    currentHouseEntries = [];
    currentEditingEntryId = null;
    clearError();
    // Ladeanzeige ausblenden
    loadingIndicator.style.display = 'none';
}


window.login = async function() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    clearError(); // Vorherige Fehler löschen

    const loginButton = document.getElementById('login');
    loginButton.disabled = true; // Button deaktivieren
    loginButton.classList.add('loading'); // Ladeanimation hinzufügen

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            // Überprüfen, ob der Fehlerstatus 400 ist
            if (error.status === 400) {
                loginButton.classList.add('error'); // Füge die Fehlerklasse hinzu
            }
            throw error; // Fehler weiterwerfen
        }
        // onAuthStateChange behandelt das Anzeigen der App
    } catch (error) {
        showError('Fehler beim Login: ' + error.message);
    } finally {
        loginButton.disabled = false; // Button wieder aktivieren
        loginButton.classList.remove('loading'); // Ladeanimation entfernen
    }
};

        window.register = async function() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
    clearError();
    try {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registrierung erfolgreich! Bitte E-Mail-Adresse bestätigen und erneut einloggen.');
        // Zurück zum Login-Interface
        document.getElementById('register').classList.add('hidden');
        document.getElementById('login').classList.remove('hidden');
        const registerLink = document.getElementById('registerText');
        if(registerLink) registerLink.style.display = 'block'; // Zeige "Neu hier?" wieder an
        const existingAccountLink = document.querySelector('#loginContainer > div > a[href="/"]');
         if (existingAccountLink) existingAccountLink.parentElement.remove(); // Entferne "Bereits ein Konto?"

    } catch (error) {
        showError('Registrierung fehlgeschlagen: ' + error.message);
    }
};

        window.logout = async function() {
    clearError();
    try {
            const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        // onAuthStateChange behandelt das Anzeigen des Logins
    } catch (error) {
        showError('Fehler beim Logout: ' + error.message);
    }
};

// Wechsle zwischen Login und Registrieren Ansicht
window.registerNow = function() {
    document.getElementById('register').classList.remove('hidden');
    document.getElementById('login').classList.add('hidden');
    const registerLink = document.getElementById('registerText');
    if (registerLink) registerLink.style.display = 'none';

    // Füge Link hinzu, um zum Login zurückzukehren, falls nicht schon vorhanden
    if (!document.querySelector('#loginContainer > div > a[href="/"]')) {
        const loginLinkDiv = document.createElement('div');
        loginLinkDiv.style.marginTop = '10px'; // Etwas Abstand
        loginLinkDiv.innerHTML = `<a href="#" onclick="showLoginInterface(); return false;" style="text-decoration: none; color: var(--text-color);">Du hast bereits ein Konto? <u>Anmelden</u></a>`;
        document.getElementById('loginContainer').appendChild(loginLinkDiv);
    }
    document.getElementById('resetText').style.display = 'none'; // Passwort vergessen ausblenden
};

// Funktion, um von Registrieren zu Login zurückzuwechseln
window.showLoginInterface = function() {
    document.getElementById('register').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    const registerLink = document.getElementById('registerText');
    if (registerLink) registerLink.style.display = 'block';
    const existingAccountLink = document.querySelector('#loginContainer > div > a[href="#"]');
    if (existingAccountLink) existingAccountLink.parentElement.remove();
     document.getElementById('resetText').style.display = 'block'; // Passwort vergessen einblenden
};


// --- Standort & PLZ ---
async function getPostalCodeFromLocation() {
    if (!navigator.geolocation) return;
    // loadingIndicator.textContent = "Ermittle Standort..."; // Weniger aufdringlich
    // loadingIndicator.style.display = 'block';
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            loadingIndicator.textContent = "Ermittle PLZ...";
            loadingIndicator.style.display = 'block';
            clearError();
            try {
                const postalCode = await reverseGeocode(latitude, longitude);
                if (postalCode) {
                    plzInput.value = postalCode;
                    // Automatisches Drücken des Suchbuttons
                    searchStreets(); // Sofortige Suche auslösen
                }
            } catch (error) {
                console.warn("Fehler beim Reverse Geocoding:", error);
            } finally {
                loadingIndicator.style.display = 'none';
                loadingIndicator.textContent = "Lade Straßen..."; // Zurücksetzen
            }
        },
        (error) => {
            console.warn("Standortabfrage fehlgeschlagen:", error.message);
            loadingIndicator.style.display = 'none'; // Sicherstellen, dass aus
            loadingIndicator.textContent = "Lade Straßen...";
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
}

async function reverseGeocode(lat, lon) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=de`;
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Nominatim Fehler: ${response.status}`);
        const data = await response.json();
        if (data.address && data.address.postcode) {
            const plz = Array.isArray(data.address.postcode) ? data.address.postcode[0] : data.address.postcode;
            return /^\d{5}$/.test(plz) ? plz : null;
        }
        return null;
    } catch (error) {
        console.error("Reverse Geocoding Fetch Fehler:", error);
        return null; // Leise fehlschlagen
    }
}

// --- Straßensuche & Auswahl ---
async function searchStreets() {
    const plz = plzInput.value.trim();
    if (!/^\d{5}$/.test(plz)) {
        showError("Bitte eine gültige 5-stellige PLZ eingeben.");
        return;
    }

    clearError();
    // === PLATZHALTER AUSBLENDEN, LISTE LEEREN & AUSBLENDEN ===
    if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
    streetListContainer.innerHTML = ''; // Leert die Liste UND entfernt den Platzhalter (temporär)
    streetListContainer.style.display = 'none'; // Container ausblenden bis Ergebnisse da sind
    // === ENDE ÄNDERUNG ===
    streetDetailContainer.style.display = 'none';
    loadingIndicator.textContent = "Lade Straßen...";
    loadingIndicator.style.display = 'block';
    searchStreetButton.disabled = true;

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
        [out:json][timeout:25];
        area["postal_code"="${plz}"]->.searchArea;
        ( way(area.searchArea)["highway"]["name"]; );
        out tags;
    `;
     // Alternative Abfrage, falls die erste fehlschlägt (manchmal sind PLZ areas anders getaggt)
     const queryAlternative = `
        [out:json][timeout:25];
        ( relation["boundary"="postal_code"]["postal_code"="${plz}"]; );
        map_to_area;
        way(area)["highway"]["name"];
        out tags;
     `;


    try {
        let streets = await fetchStreetsWithOverpass(overpassUrl, query);
         // Wenn erste Abfrage keine Ergebnisse liefert, probiere Alternative
         if (streets.length === 0) {
             console.log("Erste Overpass-Abfrage erfolglos, versuche Alternative...");
             streets = await fetchStreetsWithOverpass(overpassUrl, queryAlternative);
         }

        // displayStreets macht die Liste (ohne Platzhalter) wieder sichtbar
        displayStreets(streets, plz);

    } catch (error) {
        console.error('Fehler beim Abrufen der Straßen:', error);
        showError(`Fehler beim Abrufen der Straßen: ${error.message}.`);
        if (error.message.includes("timeout") || error.message.includes("load") || error.message.includes("überlastet")) {
            showError(errorDisplay.textContent + " API überlastet? Später erneut versuchen.");
        }
        // === PLATZHALTER BLEIBT AUSGEBLENDET, DA FEHLER ANGEZEIGT WIRD ===
        streetListContainer.style.display = 'none'; // Liste bleibt bei Fehler aus
    } finally {
        loadingIndicator.style.display = 'none';
        searchStreetButton.disabled = false;
    }
}

async function fetchStreetsWithOverpass(url, query) {
     const response = await fetch(url, {
         method: 'POST',
         body: `data=${encodeURIComponent(query)}`
     });

     if (!response.ok) {
         let errorText = `Overpass API Fehler: ${response.status} ${response.statusText}`;
         try {
             const errorBody = await response.text();
             const remarks = errorBody.match(/remark: ([^\<]+)/);
             if (remarks && remarks[1]) errorText += ` - ${remarks[1].trim()}`;
         } catch (e) {}
         // Wenn Status 429 (Too Many Requests) oder 504 (Gateway Timeout), werfe spezifischen Fehler
         if (response.status === 429 || response.status === 504) {
             throw new Error("Overpass API ist überlastet (Fehler " + response.status + "). Bitte warte einen Moment und versuche es erneut.");
         }
         throw new Error(errorText);
     }

     const data = await response.json();
     let streetNames = data.elements
         .filter(el => el.type === 'way' && el.tags && el.tags.name)
         .map(el => el.tags.name.trim()) // Trim whitespace
         // Filtere häufige unerwünschte Einträge (kann erweitert werden)
         .filter(name => !/^(Bundesautobahn|Bundesstraße|Landstraße|Kreisstraße)/i.test(name) && name.length > 2);


     // Eindeutige Straßennamen extrahieren und alphabetisch sortieren
     return [...new Set(streetNames)].sort((a, b) => a.localeCompare(b, 'de'));
}


function displayStreets(streets, postalCode) {
    streetListContainer.innerHTML = ''; // Leert alles

    if (streets.length > 0) {
        // === NEU: Alphabet-Filter rendern und anzeigen ===
        renderAlphabetFilter();
        if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'flex'; // Als Flex anzeigen
        // === ENDE NEU ===

         streets.forEach(streetName => {
            const streetElement = document.createElement('div');
            streetElement.textContent = streetName;
            streetElement.className = 'street-item';
            streetElement.onclick = () => selectStreet(streetName, postalCode);
            streetListContainer.appendChild(streetElement);
         });
    } else {
        // === NEU: Alphabet-Filter ausblenden ===
        if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';
        // === ENDE NEU ===
        streetListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Keine Straßen für diese PLZ gefunden.</p>';
    }

    streetListContainer.style.display = 'flex'; // Container wieder anzeigen
}

// --- Hausnummern-Verwaltung ---

async function selectStreet(streetName, postalCode) {
    console.log(`Ausgewählte Straße: ${streetName}, PLZ: ${postalCode}`);
    clearError();
    loadingIndicator.textContent = `Lade Daten für ${streetName}...`;
    loadingIndicator.style.display = 'block';
    streetListContainer.style.display = 'none'; // Straßenliste ausblenden
    // === NEU: Alphabet-Filter ausblenden, wenn Straße ausgewählt wird ===
    if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';
    // === ENDE NEU ===

    try {
        // 1. Prüfen, ob Straße global existiert (ohne user_id Filter)
        let { data: existingStreet, error: fetchError } = await supabaseClient
            .from('streets')
            .select('id')
            // .eq('user_id', currentUser.id) // ENTFERNT: Straßen sind global
            .eq('name', streetName)
            .eq('postal_code', postalCode)
            .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingStreet) {
            currentSelectedStreetId = existingStreet.id;
        } else {
            // Straße neu global anlegen (ohne user_id)
            const { data: newStreet, error: insertError } = await supabaseClient
                .from('streets')
                .insert({
                    // user_id: currentUser.id, // ENTFERNT: Straßen haben keinen direkten User-Besitzer mehr
                    name: streetName,
                    postal_code: postalCode
                })
                .select('id')
                .single();

            if (insertError) throw insertError;
            currentSelectedStreetId = newStreet.id;
            console.log(`Straße "${streetName}" (${postalCode}) mit ID ${currentSelectedStreetId} global neu angelegt.`);
        }

        // 2. Lade Hausnummern-Einträge für diese globale Straße
        await loadHouseEntries(currentSelectedStreetId);

        // 3. Zeige Detailansicht mit Hausnummern-Interface
        renderStreetDetailView(streetName);

    } catch (error) {
        console.error('Fehler beim Auswählen/Anlegen der Straße oder Laden der Einträge:', error);
        showError(`Ein Fehler ist aufgetreten: ${error.message}`);
        backToStreetList(); // Im Fehlerfall zurück zur Liste
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function loadHouseEntries(streetId) {
    if (!streetId) return;
    try {
            const { data, error } = await supabaseClient
            .from('house_entries')
                .select('*')
            .eq('street_id', streetId)
            .order('house_number', { ascending: true }); // Nach Hausnummer sortieren

        if (error) throw error;
        currentHouseEntries = data || [];
        console.log(`${currentHouseEntries.length} Hausnummern-Einträge geladen für Street ID ${streetId}`);
    } catch (error) {
        console.error('Fehler beim Laden der Hausnummern:', error);
        showError(`Fehler beim Laden der Hausnummern: ${error.message}`);
        currentHouseEntries = []; // Im Fehlerfall leeren
    }
}

// Rendert die komplette Ansicht für Hausnummern (Eingabe + Liste)
function renderStreetDetailView(streetName) {
    streetDetailContainer.innerHTML = ''; // Container leeren
    streetDetailContainer.style.display = 'block';

    // Überschrift und Zurück-Button
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between';
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.innerHTML = `
        <h4 id="selectedStreetName" style="margin: 0;">${streetName}</h4>
        <button onclick="backToStreetList()" class="buttonnumpad" style="padding: 5px 10px; width:auto; height:auto; font-size: 0.9em;">Zurück</button>
    `;
    streetDetailContainer.appendChild(headerDiv);

    // Eingabeformular
    const formDiv = document.createElement('div');
    formDiv.id = 'houseEntryForm';
    formDiv.style.marginBottom = '20px';
    formDiv.style.padding = '15px';
    formDiv.style.backgroundColor = 'var(--background-color)'; // Etwas abheben
    formDiv.style.borderRadius = '10px';

    // Gemeinsame Stile für Eingabefelder für bessere Wartbarkeit
    const inputStyle = `padding: 10px; border: 1px solid var(--border-color, #ccc); border-radius: 5px; background-color: var(--input-bg, white); color: var(--text-color, black); box-sizing: border-box;`;

    formDiv.innerHTML = `
        <h5>Neuer Eintrag / Bearbeiten</h5>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <input type="text" id="houseNumberInput" placeholder="Hausnummer" required inputmode="numeric" style="flex-grow: 1; ${inputStyle}">
            <input type="text" id="nameInput" placeholder="Name" style="flex-grow: 1; ${inputStyle}">
        </div>
        <select id="statusSelect" style="width: 100%; margin-bottom: 12px; ${inputStyle}">
            <option value="">-- Status --</option>
            <option value="Geschrieben">Geschrieben</option>
            <option value="Kein Interesse">Kein Interesse</option>
            <option value="Nicht geöffnet">Nicht geöffnet</option>
            <option value="Andere">Andere</option>
        </select>
        <textarea id="notesInput" placeholder="Notizen..." style="width: 100%; min-height: 80px; margin-bottom: 15px; ${inputStyle}"></textarea>
        <div class="form-button-group">
            <button onclick="saveOrUpdateHouseEntry()">Speichern</button>
            <button onclick="clearHouseEntryForm()">Abbrechen/Neu</button>
        </div>
    `;
    streetDetailContainer.appendChild(formDiv);

    // === NEU: Enter-Listener für Formularfelder hinzufügen ===
    const houseNumberInput = formDiv.querySelector('#houseNumberInput');
    const nameInput = formDiv.querySelector('#nameInput'); // Hinzugefügt für Vollständigkeit, falls Enter dort auch speichern soll
    const notesInput = formDiv.querySelector('#notesInput');
    const statusSelect = formDiv.querySelector('#statusSelect');

    const formEnterHandler = (event) => {
         if (event.key === 'Enter') {
              // Bei Enter in Textarea: Nur speichern, wenn NICHT Shift+Enter
              if (event.target.tagName === 'TEXTAREA' && event.shiftKey) {
                   return; // Erlaube Zeilenumbruch mit Shift+Enter
              }
              event.preventDefault();
              console.log("Enter in House Entry Form");
              saveOrUpdateHouseEntry();
         }
    };

    if(houseNumberInput) houseNumberInput.addEventListener('keydown', formEnterHandler);
    if(nameInput) nameInput.addEventListener('keydown', formEnterHandler);
    if(notesInput) notesInput.addEventListener('keydown', formEnterHandler);
    if(statusSelect) statusSelect.addEventListener('keydown', formEnterHandler);
    // === ENDE NEU ===

    // Fokus auf Hausnummernfeld setzen
    if (houseNumberInput) {
        setTimeout(() => { // setTimeout gibt dem Browser Zeit, das Element sicher zu rendern
            houseNumberInput.focus();
        }, 100);
    }

    // Liste für vorhandene Einträge
    const listDiv = document.createElement('div');
    listDiv.id = 'houseEntriesList';
    listDiv.style.marginTop = '20px';
    streetDetailContainer.appendChild(listDiv);

    // Einträge in die Liste rendern
    displayHouseEntries();
}

// Zeigt die aktuellen Hausnummern-Einträge in der Liste an
function displayHouseEntries() {
    const listContainer = document.getElementById('houseEntriesList');
    if (!listContainer) return; // Sicherstellen, dass der Container da ist

    listContainer.innerHTML = ''; // Liste leeren

    // Grid-Layout für die Liste
    listContainer.style.display = 'grid';
    listContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))'; // Zwei Spalten, responsive
    listContainer.style.gap = '15px'; // Abstand zwischen den Elementen

    if (currentHouseEntries.length === 0) {
        listContainer.style.display = 'block'; // Zurück zum Block-Layout für die Nachricht
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Noch keine Einträge für diese Straße vorhanden.</p>';
        return;
    }

    currentHouseEntries.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'house-entry-item card'; // Klasse für Styling hinzufügen + 'card' für konsistenten Look
        // item.style.padding = '15px'; // Wird durch card-Style ggf. übernommen
        // item.style.border = '1px solid var(--border-color)'; // Konsistenter Rand
        // item.style.borderRadius = '8px'; // Abgerundete Ecken
        // item.style.backgroundColor = 'var(--card-bg)'; // Hintergrund
        // item.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'; // Leichter Schatten

        const visitDate = entry.last_visit_date ? new Date(entry.last_visit_date).toLocaleDateString('de-DE') : 'Unbekannt';
        const notesPreview = entry.notes ? entry.notes.substring(0, 70) + (entry.notes.length > 70 ? '...' : '') : '-';
        
        // Status farblich hervorheben (optional, Beispiel)
        let statusColor = 'var(--text-color-muted)'; // Standardfarbe
        switch(entry.status) {
            case 'Geschrieben': statusColor = 'var(--success-color)'; break;
            case 'Kein Interesse': statusColor = 'var(--danger-color)'; break;
            case 'Nicht geöffnet': statusColor = 'var(--warning-color)'; break;
            // 'Andere' behält Standard oder eine spezifische Farbe
        }


        item.innerHTML = `
            <div class="card-header" style="padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color);">
                <strong style="font-size: 1.1em;">Hausnr: ${entry.house_number || 'N/A'}</strong>
            </div>
            <div class="card-content">
                <p style="margin: 4px 0;"><strong>Name:</strong> ${entry.name || '-'}</p>
                <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${entry.status || 'Kein Status'}</span></p>
                <p style="margin: 4px 0; font-size: 0.9em; color: var(--text-color-muted);" title="${entry.notes || ''}"><strong>Notiz:</strong> ${notesPreview}</p>
                <p style="margin: 8px 0 4px; font-size: 0.8em; color: var(--text-color-light);">Letzter Besuch: ${visitDate}</p>
            </div>
            <div class="card-actions" style="margin-top: 12px; text-align: right; padding-top:10px; border-top: 1px solid var(--border-color-soft)">
                 <button onclick="editHouseEntry('${entry.id}')" class="buttonnumpad icon-button" title="Bearbeiten">✏️</button>
                 <button onclick="deleteHouseEntry('${entry.id}')" class="buttonnumpad icon-button danger" title="Löschen">❌</button>
            </div>
        `;
        // Stil für Buttons (muss ggf. in CSS zentralisiert werden)
        // .icon-button { font-size:0.9em; padding: 5px 8px; width:auto; height:auto; margin-left: 5px; }
        // .icon-button.danger { background-color: var(--danger-color); }


        listContainer.appendChild(item);
    });
}

async function saveOrUpdateHouseEntry() {
    const houseNumber = document.getElementById('houseNumberInput').value.trim();
    const name = document.getElementById('nameInput').value.trim();
    const status = document.getElementById('statusSelect').value;
    const notes = document.getElementById('notesInput').value.trim();

    if (!houseNumber) {
        showError("Bitte eine Hausnummer eingeben.");
        return;
    }
    if (!currentSelectedStreetId) {
        showError("Keine Straße ausgewählt.");
        return;
    }

    clearError();
    
    const saveButton = streetDetailContainer.querySelector('#houseEntryForm button:nth-of-type(1)');
    const originalButtonText = saveButton ? saveButton.textContent : 'Speichern';
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Speichert...';
        saveButton.classList.add('saving'); // Für Styling, falls gewünscht
    } else {
        loadingIndicator.textContent = "Speichere Eintrag...";
        loadingIndicator.style.display = 'block';
    }


    const entryDataForUpdate = { // Daten, die bei jedem Update gesetzt werden
        street_id: currentSelectedStreetId,
        user_id: currentUser.id, // ID des letzten Bearbeiters
        house_number: houseNumber,
        name: name || null,
        status: status || null,
        notes: notes || null,
        last_visit_date: new Date().toISOString()
    };

    try {
        let result;
        if (currentEditingEntryId) {
            // Update: Jeder darf aktualisieren. creator_id wird NICHT geändert.
            console.log(`Aktualisiere Eintrag ${currentEditingEntryId}`);
            const { data, error } = await supabaseClient
                .from('house_entries')
                .update(entryDataForUpdate) // Nur die relevanten Felder für Update
                .eq('id', currentEditingEntryId);
             if (error) throw error;
             result = data;
        } else {
            // Prüfen ob Eintrag für Hausnummer schon existiert (global für die Straße)
            const { data: existing, error: checkError } = await supabaseClient
                .from('house_entries')
                .select('id, creator_id') // Lade ggf. creator_id, falls benötigt für Logik
                .eq('street_id', currentSelectedStreetId)
                .eq('house_number', houseNumber)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                // Eintrag existiert, stattdessen aktualisieren.
                // creator_id wird NICHT geändert.
                console.log(`Eintrag für Hausnummer ${houseNumber} existiert, aktualisiere stattdessen.`);
                const { data, error } = await supabaseClient
                    .from('house_entries')
                    .update(entryDataForUpdate) // Nur die relevanten Felder für Update
                    .eq('id', existing.id);
                if (error) throw error;
                result = data;
            } else {
                // Insert: Neuer Eintrag wird mit user_id und creator_id des aktuellen Users erstellt
                console.log(`Füge neuen Eintrag hinzu für Hausnummer ${houseNumber}`);
                const entryDataForInsert = {
                    ...entryDataForUpdate, // Übernimmt alle Felder von oben
                    creator_id: currentUser.id // Setzt den ursprünglichen Ersteller
                };
                const { data, error } = await supabaseClient
                    .from('house_entries')
                    .insert(entryDataForInsert);
                if (error) throw error;
                result = data;
            }
        }

        console.log("Eintrag erfolgreich gespeichert/aktualisiert.");

        // Kurze Vibration, falls unterstützt
        if (navigator.vibrate) {
            navigator.vibrate(100); // 100ms Vibration
        }

        // Visuelles Feedback am Button
        if (saveButton) {
            saveButton.textContent = 'Gespeichert ✓';
            saveButton.classList.remove('saving');
            saveButton.classList.add('saved'); // Für anderes Styling, falls gewünscht
            setTimeout(() => {
                saveButton.textContent = originalButtonText;
                saveButton.disabled = false;
                saveButton.classList.remove('saved');
            }, 1500); // Zurücksetzen nach 1.5 Sekunden
        }
        
        clearHouseEntryForm();
        await loadHouseEntries(currentSelectedStreetId); 
        displayHouseEntries();

    } catch (error) {
        console.error("Fehler beim Speichern/Aktualisieren:", error);
        showError(`Fehler beim Speichern: ${error.message}`);
        if (saveButton) { // Fehler auch am Button anzeigen oder zurücksetzen
            saveButton.textContent = originalButtonText;
            saveButton.disabled = false;
            saveButton.classList.remove('saving');
        }
    } finally {
        if (!saveButton) { // Nur wenn der globale Ladeindikator verwendet wurde
            loadingIndicator.style.display = 'none';
        }
        // Stelle sicher, dass der Button im Fehlerfall (wenn nicht oben schon passiert)
        // oder wenn er nicht für das Feedback verwendet wurde, wieder aktiviert wird.
        // Dies wird teilweise schon im catch-Block gehandhabt.
    }
}

// Füllt das Formular zum Bearbeiten eines Eintrags
function editHouseEntry(entryId) {
    const entry = currentHouseEntries.find(e => e.id === entryId);
    if (!entry) return;

    document.getElementById('houseNumberInput').value = entry.house_number || '';
    document.getElementById('nameInput').value = entry.name || '';
    document.getElementById('statusSelect').value = entry.status || '';
    document.getElementById('notesInput').value = entry.notes || '';
    currentEditingEntryId = entry.id; // Merken, welcher Eintrag bearbeitet wird

    // Optional: Zum Formular scrollen
    const formElement = document.getElementById('houseEntryForm');
    if (formElement) {
        formElement.scrollIntoView({ behavior: 'smooth' });
        // Fokus auf das erste Feld setzen für bessere UX, z.B. Hausnummer oder Name
        const houseNumberField = document.getElementById('houseNumberInput');
        if (houseNumberField) {
            // Kurze Verzögerung, um sicherzustellen, dass scrollIntoView abgeschlossen ist
            setTimeout(() => houseNumberField.focus(), 100);
        }
    }
}

// Löscht einen Hausnummern-Eintrag
async function deleteHouseEntry(entryId) {
    if (!confirm("Möchten Sie diesen Eintrag wirklich löschen?")) return;

    clearError();
    loadingIndicator.textContent = "Lösche Eintrag...";
    loadingIndicator.style.display = 'block';

    try {
            // WICHTIG: Die user_id Bedingung bleibt hier bestehen,
            // da nur der Ersteller des Eintrags löschen darf.
            // Die Supabase Policy für DELETE muss 'auth.uid() = user_id' (Spalte im Eintrag) sein.
            const { error } = await supabaseClient
            .from('house_entries')
            .delete()
            .eq('id', entryId)
            .eq('user_id', currentUser.id); // Stellt sicher, dass nur der Ersteller löscht

        if (error) throw error;

        console.log(`Eintrag ${entryId} gelöscht.`);
        await loadHouseEntries(currentSelectedStreetId);
        displayHouseEntries();

    } catch (error) {
        console.error("Fehler beim Löschen:", error);
        showError(`Fehler beim Löschen: ${error.message}`);
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Leert das Eingabeformular und den Bearbeitungsstatus
function clearHouseEntryForm() {
    const houseNumberInput = document.getElementById('houseNumberInput');
    const statusSelect = document.getElementById('statusSelect');
    const notesInput = document.getElementById('notesInput');

    if(houseNumberInput) houseNumberInput.value = '';
    if(statusSelect) statusSelect.value = '';
    if(notesInput) notesInput.value = '';

    currentEditingEntryId = null; // Bearbeitungsmodus beenden

    // === ENTFERNT: Setzt den Fokus NICHT mehr automatisch ===
    // if(houseNumberInput) houseNumberInput.focus();
    // === ENDE ENTFERNT ===
}


function backToStreetList() {
    streetDetailContainer.style.display = 'none';
    streetDetailContainer.innerHTML = '';

    // Filter ausblenden und Zustand zurücksetzen (bereits vorhanden)
    // if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none'; // Wird jetzt unten gesteuert
    currentAlphabetFilter = null;

    // Platzhalter oder Liste wieder anzeigen
    const hasStreetItems = streetListContainer.querySelector('.street-item');
    if (!hasStreetItems && streetListPlaceholder) {
        // Platzhalter anzeigen
         streetListContainer.innerHTML = '';
         streetListContainer.appendChild(streetListPlaceholder);
         streetListPlaceholder.style.display = 'flex';
         // Filter bleibt aus
         if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';
    } else if (hasStreetItems) {
        // Liste anzeigen
        streetListContainer.querySelectorAll('.street-item').forEach(item => item.style.display = 'block');
        // === NEU: Alphabet-Filter WIEDER anzeigen, wenn Liste angezeigt wird ===
        if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'flex';
        // === ENDE NEU ===
        // Aktiven Button im Alphabet-Filter zurücksetzen
        document.querySelectorAll('.alphabet-button').forEach(btn => btn.classList.remove('active'));
        const allBtn = alphabetFilterContainer?.querySelector('.alphabet-button');
        if(allBtn) allBtn.classList.add('active');
    }
    // Container anzeigen
    streetListContainer.style.display = 'flex';

    currentSelectedStreetId = null;
    currentHouseEntries = [];
    currentEditingEntryId = null;
    clearError();
    // plzInput.focus(); // ENTFERNE ODER KOMMENTIERE DIESE ZEILE AUS
}

// --- NEU: View Switching Logik ---
window.switchView = function(viewIdToShow, viewTitle) {
    console.log(`[switchView] Start: Wechsle zu ${viewIdToShow} (${viewTitle})`);

    // 1. Alle Views ausblenden (explizit über style.display)
    views.forEach(view => {
        if (view.style.display !== 'none' && view.id !== viewIdToShow) { // Nur loggen, wenn es tatsächlich ausgeblendet wird
             console.log(`[switchView] Blende aus: ${view.id}`);
        }
        view.style.display = 'none'; // Explizit ausblenden
        view.classList.remove('active-view'); // Auch Klasse entfernen
    });

    // 2. Die ausgewählte View anzeigen (explizit über style.display)
    const viewToShow = document.getElementById(viewIdToShow);
    if (viewToShow) {
        console.log(`[switchView] Zeige an: ${viewToShow.id}`);
        // Wähle den korrekten Display-Typ basierend auf der View
        if (viewIdToShow === 'mainView') {
            viewToShow.style.display = 'flex'; // mainView ist ein Flex-Container
        } else {
            viewToShow.style.display = 'block'; // Andere Views sind normale Block-Elemente
        }
        viewToShow.classList.add('active-view'); // Klasse hinzufügen
    } else {
        console.error(`[switchView] FEHLER: View mit ID "${viewIdToShow}" nicht gefunden!`);
        return;
    }

    // 3. Aktiven Zustand der Navigationsleiste aktualisieren (unverändert)
    navItems.forEach(item => {
        const onclickAttr = item.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`switchView('${viewIdToShow}'`)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // 4. Titel in der Kopfzeile aktualisieren (unverändert)
    if (currentViewTitleElement) {
        currentViewTitleElement.textContent = viewTitle || 'Door Tracker';
    }

    // 5. Optional: Daten für die neue Ansicht laden (unverändert)
    switch (viewIdToShow) {
        case 'statsView':
            console.log("[switchView] Lade Daten für Statistik");
            loadStatsData(); // Statistikdaten laden
            break;
        case 'leaderboardView':
             console.log("[switchView] Lade Daten für Leaderboard");
             loadLeaderboardData(); // Leaderboard laden
            break;
        case 'settingsView':
             console.log("[switchView] Lade Daten für Einstellungen");
             loadSettingsData(); // Einstellungen laden
            break;
        case 'mainView':
             console.log("[switchView] Aktiviere Hauptansicht");
             updateGreetingPlaceholder(); // NEU: Platzhalter-Begrüßung aktualisieren
             if (streetDetailContainer.style.display !== 'none') { backToStreetList(); }
            break;
    }

     // Scrollt die neue Ansicht nach oben (unverändert)
     viewContainer.scrollTop = 0;
     console.log(`[switchView] Ende: ${viewIdToShow} ist jetzt aktiv.`);
}

// --- Utility Funktionen ---
function showError(message) {
    errorDisplay.textContent = message;
    errorDisplay.style.display = 'block';
    // Optional: Nach einiger Zeit ausblenden
    // setTimeout(clearError, 7000);
}

function clearError() {
    errorDisplay.textContent = '';
    errorDisplay.style.display = 'none';
}

// --- NEU: Event Listener für Input Fokus ---
function setupInputFocusListeners() {
    console.log("[setupInputFocusListeners] Adding listeners for nav hiding and Enter key.");

    // === WIEDERHERGESTELLT: Listener für Nav-Ausblenden ===
    const inputFieldsForNav = document.querySelectorAll(
        'input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="date"], textarea, input'
    );

    inputFieldsForNav.forEach(input => {
        // Vorherige Listener entfernen (Sicherheit)
        input.removeEventListener('focus', handleInputFocus);
        input.removeEventListener('blur', handleInputBlur);
        // Neue Listener hinzufügen
        input.addEventListener('focus', handleInputFocus);
        input.addEventListener('blur', handleInputBlur);
    });
    // === ENDE WIEDERHERGESTELLT ===

    // Ruft jetzt die Funktion auf, die die Enter-Listener hinzufügt
    setupAppEnterKeyListeners();
}

// === NEU: Handler für Focus/Blur ausgelagert ===
function handleInputFocus() {
    console.log('Input focus, hiding nav');
    document.body.classList.add('nav-hidden');
}

function handleInputBlur() {
    // Kleine Verzögerung, um Klicks auf die Nav zu ermöglichen
    setTimeout(() => {
         console.log('Input blur, showing nav');
         document.body.classList.remove('nav-hidden');
    }, 150); // Leicht erhöhte Verzögerung
}
// === ENDE NEU ===

// Fügt Enter-Key Listener für Elemente *innerhalb* der App hinzu
function setupAppEnterKeyListeners() {
     console.log("[setupAppEnterKeyListeners] Adding Enter key listeners.");
     // -- PLZ Suche --
     if (plzInput && !plzInput.hasEnterListener) {
         console.log(" -> Adding PLZ Enter listener.");
         plzInput.addEventListener('keydown', handlePlzEnter);
         plzInput.hasEnterListener = true;
     }
     // -- Einstellungen (Anzeigename) --
      if (displayNameInput && !displayNameInput.hasEnterListener) {
          console.log(" -> Adding Settings Enter listener.");
         displayNameInput.addEventListener('keydown', handleSettingsEnter);
         displayNameInput.hasEnterListener = true;
      }
}

// Handler-Funktionen für Enter (unverändert)
function handlePlzEnter(event) {
    if (event.key === 'Enter') {
        console.log("Enter detected in PLZ Input"); // DEBUG
        event.preventDefault();
        searchStreets(); // Straßen suchen
    }
}

function handleSettingsEnter(event) {
     if (event.key === 'Enter') {
         console.log("Enter detected in Display Name Input"); // DEBUG
         event.preventDefault();
         saveSettings(); // Einstellungen speichern
     }
}

// === NEUE FUNKTIONEN FÜR ALPHABET FILTER ===

// Rendert die Alphabet-Buttons
function renderAlphabetFilter() {
    if (!alphabetFilterContainer) return;
    alphabetFilterContainer.innerHTML = ''; // Leeren

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    // Button für "Alle" hinzufügen
    const allButton = createAlphabetButton('Alle');
    allButton.classList.add('active'); // Standardmäßig aktiv
    alphabetFilterContainer.appendChild(allButton);

    // Buchstaben A-Z
    alphabet.forEach(letter => {
        alphabetFilterContainer.appendChild(createAlphabetButton(letter));
    });

    // Optional: Button für Zahlen/Sonderzeichen
    // const otherButton = createAlphabetButton('#');
    // alphabetFilterContainer.appendChild(otherButton);
}

// Erstellt einen einzelnen Alphabet-Button
function createAlphabetButton(letter) {
    const button = document.createElement('button');
    button.textContent = letter;
    button.className = 'alphabet-button';
    button.type = 'button'; // Wichtig, um Formularabsendung zu verhindern
    button.onclick = () => {
        filterStreetsByLetter(letter);
        // Aktiven Zustand setzen
        document.querySelectorAll('.alphabet-button').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    };
    return button;
}

// Filtert die Liste nach Anfangsbuchstaben
function filterStreetsByLetter(letter) {
    console.log(`[filterStreetsByLetter] Filtering by: ${letter}`);
    if (!streetListContainer) return;
    currentAlphabetFilter = letter; // Aktuellen Filter speichern

    const streetItems = streetListContainer.querySelectorAll('.street-item');
    streetItems.forEach(item => {
        const streetName = item.textContent.trim();
        let show = false;

        if (letter === 'Alle') {
            show = true;
        } else if (letter === '#') {
            // Zeige Elemente, die nicht mit A-Z beginnen (optional)
            show = !/^[a-z]/i.test(streetName);
        } else {
            // Zeige Elemente, die mit dem Buchstaben beginnen (Groß/Kleinschreibung ignorieren)
            show = streetName.toLowerCase().startsWith(letter.toLowerCase());
        }

        item.style.display = show ? 'block' : 'none';
    });

    // "Kein Treffer"-Nachricht entfernen, da dies keine leere Liste bedeutet
    const noFilterResultsMsg = streetListContainer.querySelector('.no-filter-results');
    if (noFilterResultsMsg) noFilterResultsMsg.remove();
     // Platzhalter auch entfernen, falls er noch da ist
     if (streetListPlaceholder && streetListPlaceholder.parentNode === streetListContainer) {
         streetListPlaceholder.style.display = 'none';
     }
}

// === ENDE NEUE FUNKTIONEN ===

// NEUE FUNKTION: Aktualisiert den Begrüßungstext im Platzhalter
function updateGreetingPlaceholder() {
    const greetingHeader = document.querySelector('#streetListPlaceholder .placeholder-greeting h3');
    if (greetingHeader) {
        if (currentUser && currentUser.user_metadata && currentUser.user_metadata.display_name) {
            greetingHeader.textContent = `Willkommen, ${escapeHtml(currentUser.user_metadata.display_name)}!`;
        } else {
            greetingHeader.textContent = 'Willkommen!';
        }
    }
}

// --- Ladefunktionen für die Views ---

async function loadStatsData() {
    if (!currentUser) return;

    statsContent.style.display = 'none';
    statsErrorDisplay.style.display = 'none';
    statsLoadingIndicator.style.display = 'block';

    try {
        // Hole alle Einträge, die vom aktuellen Benutzer ERSTELLT wurden
        const { data: entries, error } = await supabaseClient
            .from('house_entries')
            .select('status, creator_id') // Stelle sicher, dass creator_id mit abgefragt wird
            .eq('creator_id', currentUser.id); // Filtere nach dem Ersteller

        if (error) throw error;

        // Statistiken berechnen (nur für die Einträge dieses Users)
        const totalEntries = entries.length; // Gesamtanzahl der vom User erstellten Einträge
        const statusCounts = {
            'Geschrieben': 0,
            'Kein Interesse': 0,
            'Nicht geöffnet': 0,
            'Andere': 0,
            'null': 0 // Für Einträge ohne Status
        };

        entries.forEach(entry => {
            const status = entry.status || 'null';
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status]++;
            } else {
                 // Falls ein unerwarteter Status auftaucht, zähle ihn zu 'Andere'
                 // oder logge einen Fehler, je nach gewünschtem Verhalten.
                 // Für jetzt: Zähle zu 'Andere', wenn nicht explizit 'null'
                 if (status !== 'null') {
                    statusCounts['Andere']++;
                 } else {
                    statusCounts['null']++; // Explizit null-Status zählen
                 }
            }
        });

        displayStatsData(totalEntries, statusCounts);
        renderStatusChart(statusCounts);

        statsContent.style.display = 'block';

    } catch (error) {
        console.error("Fehler beim Laden der Statistiken:", error);
        statsErrorDisplay.textContent = `Fehler beim Laden der Statistiken: ${error.message}`;
        statsErrorDisplay.style.display = 'block';
    } finally {
        statsLoadingIndicator.style.display = 'none';
    }
}

async function loadLeaderboardData() {
    if (!currentUser) return;

    leaderboardContent.style.display = 'none';
    leaderboardErrorDisplay.style.display = 'none';
    leaderboardLoadingIndicator.style.display = 'block';

    try {
        // Die RPC-Funktion muss angepasst werden, um creator_id zu verwenden
        console.log("Rufe RPC Funktion 'get_leaderboard_data_v2' auf (oder anpassen)..."); // Neuer Name oder Hinweis zur Anpassung
        const { data: leaderboardEntries, error: rpcError } = await supabaseClient
            .rpc('get_leaderboard_data_v2'); // VORSCHLAG: Neue RPC-Funktion

        if (rpcError) {
            console.error("Fehler beim RPC-Aufruf 'get_leaderboard_data_v2':", rpcError);
            throw new Error(`Fehler beim Abrufen des Leaderboards: ${rpcError.message}`);
        }

        if (!leaderboardEntries || !Array.isArray(leaderboardEntries)) {
             console.error("Ungültige Daten von RPC erhalten:", leaderboardEntries);
            throw new Error("Ungültige Daten vom Leaderboard-Endpunkt erhalten.");
        }

        displayLeaderboardData(leaderboardEntries);
        leaderboardContent.style.display = 'block';

    } catch (error) {
        console.error("Fehler beim Laden des Leaderboards:", error);
        leaderboardErrorDisplay.textContent = `${error.message}`;
        leaderboardErrorDisplay.style.display = 'block';
    } finally {
        leaderboardLoadingIndicator.style.display = 'none';
    }
}

async function loadSettingsData() {
    if (!currentUser) return;

    settingsContent.style.display = 'none';
    settingsErrorDisplay.style.display = 'none';
    settingsLoadingIndicator.style.display = 'block';
    settingsStatus.textContent = ''; // Status zurücksetzen
    settingsStatus.className = '';

    try {
        // Hole aktuelle Benutzerdaten, inklusive Metadaten
        // Wichtig: getSession liefert nicht immer die aktuellsten Metadaten, getUser ist besser
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

         if (userError) throw userError;
         if (!user) throw new Error("Benutzerdaten konnten nicht geladen werden.");


        // Setze den aktuellen Anzeigenamen ins Feld
        const currentDisplayName = user.user_metadata?.display_name || '';
        displayNameInput.value = currentDisplayName;

        settingsContent.style.display = 'block';

    } catch (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
        settingsErrorDisplay.textContent = `Fehler beim Laden der Einstellungen: ${error.message}`;
        settingsErrorDisplay.style.display = 'block';
    } finally {
        settingsLoadingIndicator.style.display = 'none';
    }
}


// --- Anzeige-/Renderfunktionen ---

function displayStatsData(total, counts) {
    if (statTotalEntries) statTotalEntries.textContent = total;

    // Zähler für die aktuellen/neuen Status-Kategorien aktualisieren
    // und sicherstellen, dass ihre Container sichtbar sind.
    if (statGeschriebenEntries) {
        statGeschriebenEntries.textContent = counts['Geschrieben'] || 0;
        if (statGeschriebenEntries.parentElement) statGeschriebenEntries.parentElement.style.display = '';
    }
    if (statNotInterestedEntries) { // ID für "Kein Interesse"
        statNotInterestedEntries.textContent = counts['Kein Interesse'] || 0;
        if (statNotInterestedEntries.parentElement) statNotInterestedEntries.parentElement.style.display = '';
    }
    if (statNichtGeoeffnetEntries) {
        statNichtGeoeffnetEntries.textContent = counts['Nicht geöffnet'] || 0;
        if (statNichtGeoeffnetEntries.parentElement) statNichtGeoeffnetEntries.parentElement.style.display = '';
    }
    
    // Dynamisch nach dem Element für "Andere" suchen, da es neu sein könnte
    const statAndere = document.getElementById('statAndereEntries'); 
    if (statAndere) {
        statAndere.textContent = (counts['Andere'] || 0) + (counts['null'] || 0); // "Andere" und "null" zusammenfassen
        if (statAndere.parentElement) statAndere.parentElement.style.display = '';
    }

    // HTML-Elemente für alte, nicht mehr verwendete Status-Kategorien ausblenden,
    // falls sie noch im DOM existieren und nicht identisch mit einem der neuen Elemente sind.
    if (statCompletedEntries && statCompletedEntries !== statGeschriebenEntries) {
        if (statCompletedEntries.parentElement) statCompletedEntries.parentElement.style.display = 'none';
    }
    // statInterestedEntries ist eine alte Kategorie. statNotInterestedEntries ist die aktuelle für "Kein Interesse".
    if (statInterestedEntries && statInterestedEntries !== statNotInterestedEntries) { 
        if (statInterestedEntries.parentElement) statInterestedEntries.parentElement.style.display = 'none';
    }
    if (statRevisitEntries) { // Diese Kategorie ist komplett entfallen
        if (statRevisitEntries.parentElement) statRevisitEntries.parentElement.style.display = 'none';
    }
    if (statNotMetEntries && statNotMetEntries !== statNichtGeoeffnetEntries) {
        if (statNotMetEntries.parentElement) statNotMetEntries.parentElement.style.display = 'none';
    }
}

function renderStatusChart(statusCounts) {
    if (!statusChartCanvas) return;
    const ctx = statusChartCanvas.getContext('2d');

    if (statsChartInstance) {
        statsChartInstance.destroy();
        statsChartInstance = null;
    }

    const definedCategories = ['Geschrieben', 'Kein Interesse', 'Nicht geöffnet', 'Andere'];
    let chartLabels = [];
    let chartDataValues = [];
    let chartBackgroundColors = [];

    // Funktion, um berechnete Farbwerte zu erhalten
    const getComputedColor = (cssVar, fallbackColor) => {
        try {
            const color = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
            return color || fallbackColor;
        } catch (e) {
            console.warn(`Konnte CSS-Variable ${cssVar} nicht lesen, verwende Fallback ${fallbackColor}`, e);
            return fallbackColor;
        }
    };

    const categoryColors = {
        'Geschrieben': getComputedColor('--success-color', '#16a34a'),
        'Kein Interesse': getComputedColor('--danger-color', '#dc2626'),
        'Nicht geöffnet': getComputedColor('--warning-color', '#f59e0b'),
        'Andere': getComputedColor('--info-color', '#0284c7')
    };

    definedCategories.forEach(category => {
        let count = 0;
        if (category === 'Andere') {
            count = (statusCounts['Andere'] || 0) + (statusCounts['null'] || 0);
        } else {
            count = statusCounts[category] || 0;
        }

        if (count > 0) {
            chartLabels.push(category);
            chartDataValues.push(count);
            chartBackgroundColors.push(categoryColors[category] || '#6b7280');
        }
    });

    if (chartLabels.length === 0) {
        console.warn("Keine Daten für das Status-Chart vorhanden (alle relevanten Kategorien sind 0). Chart wird nicht gerendert.");
        ctx.clearRect(0, 0, statusChartCanvas.width, statusChartCanvas.height);
        let textColor = getComputedColor('--text-color-muted', '#6c757d');
        ctx.font = "16px Segoe UI, Arial, sans-serif";
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.fillText("Keine Daten für Diagramm vorhanden", statusChartCanvas.width / 2, statusChartCanvas.height / 2);
        return;
    }

    const cardBgColor = getComputedColor('--card-bg', '#f8fafc');
    const legendTextColor = getComputedColor('--text-color', '#1e293b');

    statsChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartLabels,
            datasets: [{
                label: 'Status Verteilung',
                data: chartDataValues,
                backgroundColor: chartBackgroundColors,
                borderColor: cardBgColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        color: legendTextColor
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed || 0;
                            label += value;

                            // Prozentsatz berechnen und hinzufügen
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            if (total > 0) {
                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                label += ` (${percentage})`;
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}


function displayLeaderboardData(leaderboard) {
    if (!leaderboardTableBody) return;
    leaderboardTableBody.innerHTML = ''; // Tabelle leeren

    if (leaderboard.length === 0) {
        leaderboardTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Noch keine Daten für das Leaderboard vorhanden.</td></tr>';
        return;
    }

    leaderboard.forEach((userEntry, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');

        // Hebe den aktuellen Benutzer hervor
        if (currentUser && userEntry.id === currentUser.id) {
            row.classList.add('current-user-row');
        }

        row.innerHTML = `
            <td>${rank}</td>
            <td>${escapeHtml(userEntry.display_name || 'Unbekannt')}</td>
            <td>${userEntry.completed_count || 0}</td>
        `;
        leaderboardTableBody.appendChild(row);
    });
}

// Kleine Hilfsfunktion zum Escapen von HTML, um XSS zu verhindern
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// --- Speicherfunktion für Einstellungen ---

window.saveSettings = async function() {
    if (!currentUser) return;

    const newName = displayNameInput.value.trim();
    if (newName.length < 3 || newName.length > 30) {
        showSettingsMessage("Anzeigename muss zwischen 3 und 30 Zeichen lang sein.", true);
        return;
    }

    saveSettingsButton.disabled = true;
    saveSettingsButton.textContent = "Speichert...";
    showSettingsMessage(''); // Alte Meldung löschen

    try {
        const { data, error } = await supabaseClient.auth.updateUser({
            data: { display_name: newName } // Speichert im user_metadata -> data Feld
        });

        if (error) throw error;

        showSettingsMessage("Anzeigename erfolgreich gespeichert!", false);
        console.log("Benutzerdaten aktualisiert:", data);
        // Optional: Leaderboard neu laden, wenn es gerade angezeigt wird?
        // if(document.getElementById('leaderboardView').classList.contains('active-view')) {
        //     loadLeaderboardData();
        // }

    } catch (error) {
        console.error("Fehler beim Speichern der Einstellungen:", error);
        showSettingsMessage(`Fehler: ${error.message}`, true);
    } finally {
        saveSettingsButton.disabled = false;
        saveSettingsButton.textContent = "Namen speichern";
    }
};

function showSettingsMessage(message, isError = false) {
    settingsStatus.textContent = message;
    settingsStatus.className = isError ? 'error' : 'success';
}

// --- Initialisierung ---
document.addEventListener('DOMContentLoaded', () => {
    // === WICHTIG: Login Listener schon hier hinzufügen, da Login-Screen zuerst da ist ===
    setupLoginEnterListeners();
    // === ENDE ÄNDERUNG ===
    checkSession();
});

// === NEU: Separate Funktion für Login Listener ===
function setupLoginEnterListeners() {
    console.log("[setupLoginEnterListeners] Adding Enter key listeners for Login/Register."); // DEBUG
    if (loginPasswordInput) {
        loginPasswordInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const registerBtnVisible = registerButton && !registerButton.classList.contains('hidden');
                if (registerBtnVisible) {
                    console.log("Enter in Password (Register)");
                    register();
                } else {
                    console.log("Enter in Password (Login)");
                    login();
                }
            }
        });
    }
    if (loginEmailInput) {
        loginEmailInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (loginPasswordInput) loginPasswordInput.focus(); // Fokus auf Passwortfeld setzen
            }
        });
    }
}
// === ENDE NEU ===
