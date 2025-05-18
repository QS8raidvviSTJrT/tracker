const supabaseUrl = 'https://pvjjtwuaofclmsvsaneo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amp0d3Vhb2ZjbG1zdnNhbmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzM2OTksImV4cCI6MjA2MjQ0OTY5OX0.yc4F3gKDGKMmws60u3KOYSM8t06rvDiJgOvEAuiYRa8'
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        // NEU: LocalStorage Keys
        const LS_STREET_CACHE_KEY = 'doorTrackerStreetCache';
        const LS_ACTIVE_STREET_DETAIL_KEY = 'doorTrackerActiveStreetDetail';

        // NEU: LocalStorage Helper Functions
        function saveToLocalStorage(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                console.warn("Error saving to localStorage", key, e);
            }
        }

        function getFromLocalStorage(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.warn("Error getting from localStorage", key, e);
                return null;
            }
        }

        function removeFromLocalStorage(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                console.warn("Error removing from localStorage", key, e);
            }
        }

        let deferredPrompt;
let currentUser = null;
let currentSelectedStreetId = null; // ID der aktuell ausgewählten Straße
let currentHouseEntries = []; // Einträge für die aktuell ausgewählte Straße
let currentEditingEntryId = null; // ID des Eintrags, der gerade bearbeitet wird
let statsChartInstance = null; // Variable für die Chart-Instanz
let currentAlphabetFilter = null; // Aktuell ausgewählter Buchstabe
let currentSortOrder = 'house_number_asc'; // NEU: Standard-Sortierreihenfolge
let isAlphabetFilterExpanded = false; // NEU: Zustand für den expandierten Filter

// --- DOM Elemente ---
const loginContainer = document.getElementById('loginContainer');
const appContainer = document.getElementById('appContainer');
const initialLoadingOverlay = document.getElementById('initialLoadingOverlay'); // NEU
const plzInput = document.getElementById('plzInput');
const streetListContainer = document.getElementById('streetListContainer');
const streetDetailContainer = document.getElementById('streetDetailContainer');
const searchStreetButton = document.getElementById('searchStreetButton');
const loadingIndicator = document.getElementById('loadingIndicator');
const errorDisplay = document.getElementById('errorDisplay');

// NEU: Referenz für Header-Steuerelemente
const headerControls = document.querySelector('.header-controls');

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

// NEU: Referenzen für Kalender-View-Elemente (Zeiterfassung)
const calendarView = document.getElementById('calendarView'); // Ist schon da
// Die folgenden werden neu deklariert für Klarheit, auch wenn sie schon im HTML sind
const calendarLoadingIndicator = document.getElementById('calendarLoadingIndicator');
const calendarErrorDisplay = document.getElementById('calendarErrorDisplay');
// const calendarContent = document.getElementById('calendarContent'); // Wird nicht direkt verwendet, Inhalt ist in calendarView

// DOM Elemente für Zeiterfassung
let timeTrackingControls, timeTrackingStatusDisplay, currentStatusText, currentWorkDuration, todayTotalWork; // todayTotalBreak entfernt
let startWorkButton, stopWorkButton;
let timeTrackingHistory, historyDateInput, dailySummaryDisplay, summaryDateDisplay, summaryTotalWork; // summaryTotalBreak entfernt
let timeEntriesList, noHistoryEntriesMessage;

// Globale Zustandsvariablen für Zeiterfassung
let activeWorkEntryId = null;
let workTimerInterval = null;
let workStartTime = null;

// NEU: Referenzen für Login-Elemente
const loginEmailInput = document.getElementById('loginEmail'); // E-Mail-Feld
const loginPasswordInput = document.getElementById('loginPassword'); // Passwortfeld
const registrationCodeContainer = document.getElementById('registrationCodeContainer'); // NEU
const registrationCodeInput = document.getElementById('registrationCode'); // NEU
const registerButton = document.getElementById('register'); // NEU: Referenz zum Register-Button

// NEU: Referenzen für Skeleton Loader
const statsViewSkeleton = document.querySelector('.stats-view-skeleton');
const leaderboardViewSkeleton = document.querySelector('.leaderboard-view-skeleton');
const settingsViewSkeleton = document.querySelector('.settings-view-skeleton');
const calendarViewSkeleton = document.querySelector('.calendar-view-skeleton');
const streetDetailSkeleton = document.querySelector('.street-detail-skeleton'); // NEU

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

// --- NEUE Funktion zum Ausblenden des initialen Lade-Overlays ---
function hideInitialLoadingOverlay() {
    if (initialLoadingOverlay) {
        initialLoadingOverlay.classList.add('hidden');
        // Optional: Nach der Transition entfernen, um DOM sauber zu halten
        setTimeout(() => {
            if (initialLoadingOverlay.classList.contains('hidden')) { // Nur entfernen, wenn wirklich ausgeblendet
                initialLoadingOverlay.style.display = 'none';
            }
        }, 300); // Muss mit der CSS-Transition-Dauer übereinstimmen
    }
}

// --- Session & Auth ---
async function checkSession() {
    // Das Overlay ist standardmäßig sichtbar durch HTML/CSS
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
    // Das Ausblenden des Overlays wird jetzt in showLogin() und showApp() gehandhabt
    // direkt nach der Entscheidung, was angezeigt wird.
}

supabaseClient.auth.onAuthStateChange((event, session) => {
    // Das Overlay sollte hier bereits beim initialen Laden verarbeitet werden.
    // onAuthStateChange ist eher für spätere Änderungen (Login/Logout).
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
    resetAppState(); // Stellt sicher, dass Caches beim Logout geleert werden
    hideInitialLoadingOverlay(); // NEU: Overlay hier ausblenden
}

function showApp() {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    hideInitialLoadingOverlay();

    const activeDetail = getFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY);

    if (activeDetail && activeDetail.streetId && activeDetail.streetName && activeDetail.postalCode) {
        console.log("Restoring active street detail from localStorage:", activeDetail);
        plzInput.value = activeDetail.postalCode;
        currentSortOrder = activeDetail.sortOrder || 'house_number_asc';

        // mainView direkt vorbereiten, ohne switchView für mainView explizit zu rufen
        views.forEach(view => view.style.display = 'none');
        const mainV = document.getElementById('mainView');
        if (mainV) {
            mainV.style.display = 'flex';
            mainV.classList.add('active-view');
        }
        if (currentViewTitleElement) currentViewTitleElement.textContent = activeDetail.streetName; // Titel für die Straße setzen
        if (headerControls) headerControls.style.display = 'flex'; // Header-Controls in der mainView anzeigen

        if (streetListContainer) streetListContainer.style.display = 'none';
        if (alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';

        // Sicherstellen, dass das Skeleton für die Detailansicht initial ausgeblendet ist,
        // da selectStreet dessen Sichtbarkeit managt.
        if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';


        navItems.forEach(item => item.classList.remove('active'));
        // Der FAB ist standardmäßig für die mainView, braucht keine .active Klasse

        // selectStreet lädt die Daten und rendert die Detailansicht
        selectStreet(activeDetail.streetName, activeDetail.postalCode);

    } else {
        // Keine Detailansicht, Standard MainView-Logik
        const cachedStreetData = getFromLocalStorage(LS_STREET_CACHE_KEY);
        if (cachedStreetData && cachedStreetData.lastPlz) {
            plzInput.value = cachedStreetData.lastPlz;
            // searchStreets() wird nun den Cache für Straßen prüfen oder API callen
            searchStreets();
        } else {
            // Wenn keine letzte PLZ im Cache, versuche Standort
            getPostalCodeFromLocation();
        }
        // Setze die mainView als aktiv und den Standardtitel, falls nicht schon durch Detailansicht geschehen
        // Dies ist wichtig, falls weder Detail noch Straßenliste gecached waren.
        if (!activeDetail) { // Nur wenn keine Detailansicht wiederhergestellt wurde
             switchView('mainView', 'SellX Solutions');
        }
    }

    updateGreetingPlaceholder();
    setupInputFocusListeners();
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

    // NEU: Caches leeren
    removeFromLocalStorage(LS_STREET_CACHE_KEY);
    removeFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY);
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
            const registrationCodeValue = registrationCodeInput.value.trim(); // Name geändert für Klarheit
    clearError();

    // NEU: Angepasste Code-Validierung für 14 alphanumerische Zeichen
    if (!/^[a-zA-Z0-9]{14}$/.test(registrationCodeValue)) {
        showError('Bitte einen gültigen 14-stelligen alphanumerischen Registrierungscode eingeben.');
        if (registrationCodeInput) registrationCodeInput.classList.add('error-input');
        return;
    }
    if (registrationCodeInput) registrationCodeInput.classList.remove('error-input');

    if (registerButton) {
        registerButton.disabled = true;
        registerButton.classList.add('loading');
    }

    let fetchedCodeId = null; // Variable, um die code_id zu speichern

    try {
        // 1. Prüfe den Registrierungscode via RPC
        console.log("Versuche Registrierungscode zu prüfen via RPC:", registrationCodeValue);
        const { data: validationResults, error: validationError } = await supabaseClient.rpc('validate_registration_code', {
            p_code: registrationCodeValue
        });

        if (validationError) {
            console.error('Supabase Fehler beim Aufrufen von validate_registration_code RPC:', validationError);
            throw new Error('Fehler bei der Code-Prüfung. Versuche es später erneut.');
        }

        // Die RPC-Funktion gibt ein Array mit einem Objekt zurück
        const result = validationResults && validationResults.length > 0 ? validationResults[0] : null;
        console.log("Antwort von RPC validate_registration_code:", result);

        if (!result || !result.is_valid) {
            console.warn("Code nicht in der Datenbank gefunden (via RPC) für:", registrationCodeValue);
            throw new Error('Ungültiger Registrierungscode.');
        }

        if (result.is_used) {
            console.warn("Der Code", registrationCodeValue, "wurde bereits verwendet (via RPC).");
            throw new Error('Dieser Registrierungscode wurde bereits verwendet.');
        }

        fetchedCodeId = result.code_id; // Speichere die ID des gültigen, unbenutzten Codes

        // 2. Registriere den Benutzer
        console.log("Code ist gültig und unbenutzt. Versuche Benutzer zu registrieren...");
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
        if (signUpError) {
            console.error('Supabase Fehler bei auth.signUp:', signUpError);
            throw signUpError;
        }

        console.log("Benutzer erfolgreich registriert:", signUpData.user.email, "User ID:", signUpData.user.id);

        // 3. Markiere den Code als benutzt via RPC
        if (!fetchedCodeId) {
            // Sollte nicht passieren, wenn die Logik oben korrekt ist
            console.error("KRITISCH: fetchedCodeId ist null, kann Code nicht als benutzt markieren.");
            throw new Error("Interner Fehler: Code-ID nicht gefunden nach Validierung.");
        }

        console.log("Versuche Code als benutzt zu markieren via RPC für Code ID:", fetchedCodeId, "User ID:", signUpData.user.id);
        const { error: claimError } = await supabaseClient.rpc('claim_registration_code', {
            p_code_id: fetchedCodeId,
            p_user_id: signUpData.user.id
        });

        if (claimError) {
            // Dies ist ein kritischer Punkt. Der User wurde erstellt, aber der Code konnte nicht als benutzt markiert werden.
            // Hier sollte Logging erfolgen und ggf. eine manuelle Korrektur.
            console.error('KRITISCH: User erstellt, aber Code konnte nicht via RPC als "benutzt" markiert werden:', claimError);
        } else {
            console.log("Code erfolgreich als benutzt markiert via RPC.");
        }

        alert('Registrierung erfolgreich! Bitte E-Mail-Adresse bestätigen und erneut einloggen.');
        showLoginInterface();

    } catch (error) {
        console.error("Fehler im gesamten Registrierungsprozess:", error);
        showError('Registrierung fehlgeschlagen: ' + error.message);
         if (error.message.toLowerCase().includes('code') || error.message.toLowerCase().includes('registrierungscode')) {
            if (registrationCodeInput) registrationCodeInput.classList.add('error-input');
        }
    } finally {
        if (registerButton) {
            registerButton.disabled = false;
            registerButton.classList.remove('loading');
        }
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
    document.getElementById('resetText').style.display = 'none'; // Passwort vergessen ausblenden
    if (registrationCodeContainer) registrationCodeContainer.style.display = 'block'; // Code-Feld anzeigen
    if (registrationCodeInput) registrationCodeInput.focus(); // Fokus auf Code-Feld


    // Füge Link hinzu, um zum Login zurückzukehren, falls nicht schon vorhanden
    if (!document.querySelector('#loginContainer > div > a[href="/"]')) {
        const loginLinkDiv = document.createElement('div');
        loginLinkDiv.style.marginTop = '10px'; // Etwas Abstand
        loginLinkDiv.innerHTML = `<a href="#" onclick="showLoginInterface(); return false;" style="text-decoration: none; color: var(--text-color);">Du hast bereits ein Konto? <u>Anmelden</u></a>`;
        document.getElementById('loginContainer').appendChild(loginLinkDiv);
    }
};

// Funktion, um von Registrieren zu Login zurückzuwechseln
window.showLoginInterface = function() {
    document.getElementById('register').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    const registerLink = document.getElementById('registerText');
    if (registerLink) registerLink.style.display = 'block';
    const existingAccountLink = document.querySelector('#loginContainer > div > a[href="#"]'); // Selektor angepasst
    if (existingAccountLink && existingAccountLink.parentElement.innerText.includes("Du hast bereits ein Konto?")) { // Zusätzliche Prüfung
        existingAccountLink.parentElement.remove();
    }
    document.getElementById('resetText').style.display = 'block'; // Passwort vergessen einblenden
    if (registrationCodeContainer) registrationCodeContainer.style.display = 'none'; // Code-Feld ausblenden
    if (registrationCodeInput) {
        registrationCodeInput.value = ''; // Code-Feld leeren
        registrationCodeInput.classList.remove('error-input'); // Fehlerklasse entfernen
    }
};


// --- Standort & PLZ ---
async function getPostalCodeFromLocation() {
    if (!navigator.geolocation) return;
    // loadingIndicator.textContent = "Ermittle Standort..."; // ENTFERNT
    // loadingIndicator.style.display = 'block'; // Wird bei Bedarf später gesetzt
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            // loadingIndicator.textContent = "Ermittle PLZ..."; // ENTFERNT
            loadingIndicator.style.display = 'block'; // Anzeige erst hier, falls wirklich geladen wird
            clearError();
            try {
                const postalCode = await reverseGeocode(latitude, longitude);
                if (postalCode) {
                    plzInput.value = postalCode;
                    searchStreets();
                }
            } catch (error) {
                console.warn("Fehler beim Reverse Geocoding:", error);
            } finally {
                loadingIndicator.style.display = 'none';
                // loadingIndicator.textContent = "Lade Straßen..."; // ENTFERNT
            }
        },
        (error) => {
            console.warn("Standortabfrage fehlgeschlagen:", error.message);
            loadingIndicator.style.display = 'none';
            // loadingIndicator.textContent = "Lade Straßen..."; // ENTFERNT
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
    // Wichtig: Wenn eine neue Suche gestartet wird, ist eine eventuell offene Detailansicht nicht mehr relevant.
    removeFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY);
    if (streetDetailContainer) streetDetailContainer.style.display = 'none';
    if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';
    if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none'; // Alphabet Filter auch ausblenden

    // Prüfen, ob Straßen für diese PLZ im Cache sind
    const cachedData = getFromLocalStorage(LS_STREET_CACHE_KEY);
    if (cachedData && cachedData.lastPlz === plz && cachedData.streets) {
        console.log("Loading streets from localStorage for PLZ:", plz);
        if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
        streetListContainer.innerHTML = ''; // Leeren für neue Liste
        displayStreets(cachedData.streets, plz); // Straßen aus Cache anzeigen
        streetListContainer.style.display = 'flex'; // Sicherstellen, dass Container sichtbar ist
        return; // Frühzeitiger Ausstieg
    }

    // Wenn nicht im Cache, dann API-Call vorbereiten
    if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
    streetListContainer.innerHTML = '';
    streetListContainer.style.display = 'none'; // Vorerst ausblenden, bis Daten da sind
    
    loadingIndicator.style.display = 'block'; // Original Spinner für Straßenliste anzeigen
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
        // NEU: Straßen im localStorage speichern
        saveToLocalStorage(LS_STREET_CACHE_KEY, { lastPlz: plz, streets: streets, timestamp: Date.now() });

    } catch (error) {
        console.error('Fehler beim Abrufen der Straßen:', error);
        showError(`Fehler beim Abrufen der Straßen: ${error.message}.`);
        if (error.message.includes("timeout") || error.message.includes("load") || error.message.includes("überlastet")) {
            showError(errorDisplay.textContent + " API überlastet? Später erneut versuchen.");
        }
        // === PLATZHALTER BLEIBT AUSGEBLENDET, DA FEHLER ANGEZEIGT WIRD ===
        streetListContainer.style.display = 'none'; // Liste bleibt bei Fehler aus
        // Optional: Cache für diese PLZ bei Fehler entfernen oder als fehlerhaft markieren
        // removeFromLocalStorage(LS_STREET_CACHE_KEY);
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

    // Echten Inhaltscontainer ausblenden und leeren
    if (streetDetailContainer) {
        streetDetailContainer.style.display = 'none';
        streetDetailContainer.innerHTML = ''; 
    }
    // Skeleton anzeigen
    if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'block'; 

    // Andere UI-Elemente anpassen
    if (streetListContainer) streetListContainer.style.display = 'none';
    if (alphabetFilterContainer) {
        alphabetFilterContainer.style.display = 'none'; // Alphabet-Filter ausblenden
        // Reset alphabet filter state when going to street detail
        // isAlphabetFilterExpanded = false; // Wird in backToStreetList() korrekt behandelt
        // alphabetFilterContainer.classList.remove('expanded');
    }
    
    currentSortOrder = getFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY)?.sortOrder || 'house_number_asc'; // Sortierung ggf. aus Cache wiederherstellen

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
        renderStreetDetailView(streetName); // Rendert den Inhalt in streetDetailContainer
        
        // 4. Echten Inhalt anzeigen und Skeleton ausblenden
        if (streetDetailContainer) streetDetailContainer.style.display = 'block'; 
        if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none'; 

        // NEU: Aktive Detailansicht im localStorage speichern
        saveToLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY, {
            streetId: currentSelectedStreetId,
            streetName: streetName,
            postalCode: postalCode,
            sortOrder: currentSortOrder // Aktuelle Sortierung mitspeichern
        });

    } catch (error) {
        console.error('Fehler beim Auswählen/Anlegen der Straße oder Laden der Einträge:', error);
        showError(`Ein Fehler ist aufgetreten: ${error.message}`);
        if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none'; // Skeleton bei Fehler ausblenden
        backToStreetList(); // Im Fehlerfall zurück zur Liste
    } finally {
        // loadingIndicator.style.display = 'none'; // Nicht mehr benötigt
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
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '20px';
    headerDiv.innerHTML = `
        <button onclick="backToStreetList()" class="buttonnumpad" style="padding: 5px 10px; width:auto; height:auto; font-size: 0.9em; ">Zurück</button>
    `;
    // <h4 id="selectedStreetName" style="text-align: center; flex-grow: 1;">${streetName}</h4>
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
        <h5>${streetName}</h5>
        <div style="display: flex; gap: 10px; margin-bottom: 12px;">
            <input type="text" id="houseNumberInput" placeholder="Hausnummer" required inputmode="numeric" style="flex-grow: 1; ${inputStyle}">
            <input type="text" id="nameInput" placeholder="Name von der Tür" style="flex-grow: 1; ${inputStyle}">
        </div>
        <select id="statusSelect" style="width: 100%; margin-bottom: 12px; ${inputStyle}">
            <option value="">-- Status --</option>
            <option value="Geschrieben">✅ Geschrieben</option>
            <option value="Kein Interesse">❌ Kein Interesse</option>
            <option value="Nicht geöffnet">🔒 Nicht geöffnet</option>
            <option value="Andere">🔍 Andere</option>
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

    // Sortier-Steuerung hinzufügen
    const sortControlsDiv = document.createElement('div');
    sortControlsDiv.id = 'sortControls';
    sortControlsDiv.style.marginBottom = '15px';
    sortControlsDiv.style.marginTop = '20px'; // Etwas Abstand zum Formular
    sortControlsDiv.style.display = 'flex';
    sortControlsDiv.style.alignItems = 'center';
    sortControlsDiv.style.gap = '10px';
    // inputStyle ist im Scope von renderStreetDetailView definiert
    sortControlsDiv.innerHTML = `
        <label for="sortSelect" style="font-weight: bold; white-space: nowrap;">Sortieren nach:</label>
        <select id="sortSelect" style="flex-grow: 1; padding: 10px; border: 1px solid var(--border-color, #ccc); border-radius: 5px; background-color: var(--input-bg, white); color: var(--text-color, black); box-sizing: border-box;">
            <option value="house_number_asc">Hausnr. (aufsteigend)</option>
            <option value="house_number_desc">Hausnr. (absteigend)</option>
            <option value="created_at_desc">Zuletzt hinzugefügt</option>
        </select>
    `;
    streetDetailContainer.appendChild(sortControlsDiv);

    const sortSelectElement = sortControlsDiv.querySelector('#sortSelect');
    if (sortSelectElement) {
        sortSelectElement.value = currentSortOrder; // Aktuelle Sortierung im Dropdown setzen
        sortSelectElement.addEventListener('change', (event) => {
            currentSortOrder = event.target.value;
            sortAndDisplayHouseEntries(); // Einträge neu sortieren und anzeigen
        });
    }

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

    // Einträge in die Liste rendern (initial sortiert nach currentSortOrder)
    sortAndDisplayHouseEntries();
}

// NEUE FUNKTION: Sortiert die currentHouseEntries und ruft displayHouseEntries auf
function sortAndDisplayHouseEntries() {
    if (!currentHouseEntries) return;

    currentHouseEntries.sort((a, b) => {
        let comparisonResult = 0;
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

        switch (currentSortOrder) {
            case 'house_number_asc':
                comparisonResult = collator.compare(a.house_number || '', b.house_number || '');
                break;
            case 'house_number_desc':
                comparisonResult = collator.compare(b.house_number || '', a.house_number || ''); // Reihenfolge für absteigend getauscht
                break;
            case 'created_at_desc':
                // Annahme: created_at ist ein ISO-String Datum oder Timestamp
                const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
                const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
                comparisonResult = dateB - dateA; // Neueste zuerst
                break;
            default:
                // Fallback zur Standardsortierung (Hausnummer aufsteigend)
                comparisonResult = collator.compare(a.house_number || '', b.house_number || '');
                break;
        }
        return comparisonResult;
    });

    displayHouseEntries(); // Ruft die Funktion auf, die nur noch für die Anzeige zuständig ist
}

// Zeigt die aktuellen Hausnummern-Einträge in der Liste an
// Diese Funktion ist jetzt nur noch für das Rendern der (bereits sortierten) Liste zuständig.
function displayHouseEntries() {
    const listContainer = document.getElementById('houseEntriesList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

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

        const visitDate = entry.last_visit_date ? new Date(entry.last_visit_date).toLocaleDateString('de-DE') : 'Unbekannt';
        const notesPreview = entry.notes ? escapeHtml(entry.notes.substring(0, 70) + (entry.notes.length > 70 ? '...' : '')) : '-';
        
        let statusColor = 'var(--text-color-muted)';
        switch(entry.status) {
            case 'Geschrieben': statusColor = 'var(--success-color)'; break;
            case 'Kein Interesse': statusColor = 'var(--danger-color)'; break;
            case 'Nicht geöffnet': statusColor = 'var(--warning-color)'; break;
        }

        item.innerHTML = `
            <div class="card-header" style="padding-bottom: 8px; margin-bottom: 8px; border-bottom: 1px solid var(--border-color-soft);">
                <span style="background-color: var(--primary-color, #0d6efd); color: white; padding: 0.4em 0.7em; border-radius: 6px; font-weight: bold; font-size: 1.3em; line-height: 1; display: inline-block; min-width: 36px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    ${entry.house_number || '?'}
                </span>
            </div>
            <div class="card-content">
                <p style="margin: 4px 0;"><strong>Name:</strong> ${escapeHtml(entry.name) || '-'}</p>
                <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${escapeHtml(entry.status) || 'Kein Status'}</span></p>
                <p style="margin: 4px 0; font-size: 0.9em; color: var(--text-color-muted);" title="${escapeHtml(entry.notes || '')}"><strong>Notiz:</strong> ${notesPreview}</p>
                <p style="margin: 8px 0 4px; font-size: 0.8em; color: var(--text-color-light);">Letzter Besuch: ${visitDate}</p>
            </div>
            <div class="card-actions" style="margin-top: 12px; text-align: right; padding-top:10px; border-top: 1px solid var(--border-color-soft)">
                 <button onclick="editHouseEntry('${entry.id}')" class="buttonnumpad icon-button" title="Bearbeiten">✏️</button>
                 <button onclick="deleteHouseEntry('${entry.id}')" class="buttonnumpad icon-button danger" title="Löschen">❌</button>
            </div>
        `;
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
        saveButton.classList.add('saving'); 
    } else {
        // loadingIndicator.textContent = "Speichere Eintrag..."; // ENTFERNT
        loadingIndicator.style.display = 'block'; // Falls kein Button da, zeige globalen Spinner
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
            // Update: Bestehender Eintrag wird bearbeitet.
            console.log(`Aktualisiere Eintrag ${currentEditingEntryId}`);
            const { data, error } = await supabaseClient
                .from('house_entries')
                .update(entryDataForUpdate)
                .eq('id', currentEditingEntryId);
             if (error) throw error;
             result = data;
        } else {
            // Insert: Neuer Eintrag wird erstellt.
            // Die Prüfung auf einen existierenden Eintrag für dieselbe Hausnummer wird entfernt,
            // um mehrere Einträge pro Hausnummer zu ermöglichen.
            console.log(`Füge neuen Eintrag hinzu für Hausnummer ${houseNumber}`);
            const entryDataForInsert = {
                ...entryDataForUpdate, // Übernimmt alle Felder von oben
                creator_id: currentUser.id // Setzt den ursprünglichen Ersteller
            };
            const { data, error } = await supabaseClient
                .from('house_entries')
                .insert(entryDataForInsert)
                .select() // .select() hinzugefügt, um das eingefügte Objekt zurückzugeben, falls benötigt
                .single(); // .single() hinzugefügt, da wir ein einzelnes Objekt erwarten
            if (error) throw error;
            result = data;
        }

        console.log("Eintrag erfolgreich gespeichert/aktualisiert.", result);

        // Kurze Vibration, falls unterstützt
        if (navigator.vibrate) {
            navigator.vibrate(100); // 100ms Vibration
        }

        // Visuelles Feedback am Button
        if (saveButton) {
            saveButton.textContent = 'Gespeichert ✓';
            saveButton.classList.remove('saving');
            saveButton.classList.add('saved'); // Diese CSS-Klasse sollte den Button grün färben.
                                             // Füge in deiner styles.css hinzu:
                                             
            setTimeout(() => {
                saveButton.textContent = originalButtonText;
                saveButton.disabled = false;
                saveButton.classList.remove('saved');
            }, 1500); // Zurücksetzen nach 1.5 Sekunden
        }
        
        clearHouseEntryForm();
        await loadHouseEntries(currentSelectedStreetId); 
        sortAndDisplayHouseEntries(); // Statt displayHouseEntries direkt aufzurufen

    } catch (error) {
        console.error("Fehler beim Speichern/Aktualisieren:", error);
        showError(`Fehler beim Speichern: ${error.message}`);
        if (saveButton) { // Fehler auch am Button anzeigen oder zurücksetzen
            saveButton.textContent = originalButtonText;
            saveButton.disabled = false;
            saveButton.classList.remove('saving');
        }
    } finally {
        if (!saveButton) { 
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
    // loadingIndicator.textContent = "Lösche Eintrag..."; // ENTFERNT
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
        sortAndDisplayHouseEntries(); // Statt displayHouseEntries direkt aufzurufen

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
    const nameInput = document.getElementById('nameInput'); // NEU: Referenz zum Namensfeld
    const statusSelect = document.getElementById('statusSelect');
    const notesInput = document.getElementById('notesInput');

    if(houseNumberInput) houseNumberInput.value = '';
    if(nameInput) nameInput.value = ''; // NEU: Namensfeld leeren
    if(statusSelect) statusSelect.value = '';
    if(notesInput) notesInput.value = '';

    currentEditingEntryId = null; // Bearbeitungsmodus beenden

    // === ENTFERNT: Setzt den Fokus NICHT mehr automatisch ===
    // if(houseNumberInput) houseNumberInput.focus();
    // === ENDE ENTFERNT ===
}


function backToStreetList() {
    // Echten Detail-Inhalt und Skeleton ausblenden
    if (streetDetailContainer) {
        streetDetailContainer.style.display = 'none';
        streetDetailContainer.innerHTML = '';
    }
    if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';
    
    removeFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY); 

    // Alphabet-Filter Zustand zurücksetzen und ggf. neu rendern/anzeigen
    isAlphabetFilterExpanded = false; // Standardmäßig einklappen
    if (alphabetFilterContainer) {
        alphabetFilterContainer.classList.remove('expanded');
        // renderAlphabetFilter(); // Stellt sicher, dass es korrekt gezeichnet wird für "Alle"
    }
    currentAlphabetFilter = 'Alle'; 
    // updateAlphabetFilterActiveState(); // Wird von renderAlphabetFilter oder displayStreets (indirekt) gecallt
    // updateToggleArrowIcon(); // Wird von renderAlphabetFilter gecallt

    const cachedStreetData = getFromLocalStorage(LS_STREET_CACHE_KEY);
    const currentPlz = plzInput.value.trim();

    if (cachedStreetData && cachedStreetData.lastPlz === currentPlz && cachedStreetData.streets && cachedStreetData.streets.length > 0) {
        console.log("Restoring street list from cache for PLZ:", currentPlz);
        if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
        if (streetListContainer) streetListContainer.innerHTML = ''; 
        displayStreets(cachedStreetData.streets, currentPlz); 
        if(alphabetFilterContainer && cachedStreetData.streets.length > 0) {
            alphabetFilterContainer.style.display = 'flex'; // Sicherstellen, dass Filter sichtbar ist
        }
    } else {
        if (streetListContainer) streetListContainer.innerHTML = ''; 
        if (streetListPlaceholder) {
            if (streetListContainer) streetListContainer.appendChild(streetListPlaceholder);
            streetListPlaceholder.style.display = 'flex';
        }
        if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none'; 
    }
    
    if (streetListContainer) streetListContainer.style.display = 'flex';
    if (currentViewTitleElement) currentViewTitleElement.textContent = 'SellX Solutions'; // Standardtitel wiederherstellen
    if (headerControls) headerControls.style.display = 'flex'; // Header-Controls für Straßenliste anzeigen

    currentSelectedStreetId = null;
    currentHouseEntries = [];
    currentEditingEntryId = null;
    clearError();
    // plzInput.focus(); // Fokus nicht automatisch setzen
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

    // NEU: Alle Skeletons initial ausblenden, um den Zustand zurückzusetzen
    if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden');
    if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.add('hidden');
    if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden');
    if (calendarViewSkeleton) calendarViewSkeleton.classList.add('hidden');


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

    // NEU: Sichtbarkeit der Header-Controls steuern
    if (headerControls) {
        if (viewIdToShow === 'mainView') {
            headerControls.style.display = 'flex'; // Oder 'block', je nach ursprünglichem Display-Typ
        } else {
            headerControls.style.display = 'none';
        }
    }

    // 5. Optional: Daten für die neue Ansicht laden UND SKELETON ANZEIGEN
    switch (viewIdToShow) {
        case 'statsView':
            console.log("[switchView] Lade Daten für Statistik");
            if (statsViewSkeleton) statsViewSkeleton.classList.remove('hidden');
            if (statsContent) statsContent.style.display = 'none';
            loadStatsData();
            break;
        case 'leaderboardView':
             console.log("[switchView] Lade Daten für Leaderboard");
             if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.remove('hidden');
             if (leaderboardContent) leaderboardContent.style.display = 'none';
             loadLeaderboardData();
            break;
        case 'settingsView':
             console.log("[switchView] Lade Daten für Einstellungen");
             if (settingsViewSkeleton) settingsViewSkeleton.classList.remove('hidden');
             if (settingsContent) settingsContent.style.display = 'none';
             loadSettingsData();
            break;
        case 'calendarView': // NEUER CASE
            console.log("[switchView] Lade Daten für Kalender");
            if (calendarViewSkeleton) calendarViewSkeleton.classList.remove('hidden');
            if (timeTrackingControls) timeTrackingControls.style.display = 'none';
            if (timeTrackingHistory) timeTrackingHistory.style.display = 'none';
            loadCalendarData();
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

// Rendert die Alphabet-Buttons und den Toggle
function renderAlphabetFilter() {
    if (!alphabetFilterContainer) return;
    alphabetFilterContainer.innerHTML = ''; // Leeren

    // Toggle-Button (früher "Alle"-Button)
    const toggleButton = document.createElement('button');
    toggleButton.id = 'alphabetToggleAllButton';
    toggleButton.className = 'alphabet-button'; // Nutzt vorhandene Basis-Stile
    toggleButton.innerHTML = `
        <span id="alphabetToggleLabel">Alle</span>
        <span class="material-icons expand-arrow">expand_more</span>
    `;
    toggleButton.onclick = () => {
        isAlphabetFilterExpanded = !isAlphabetFilterExpanded;
        alphabetFilterContainer.classList.toggle('expanded', isAlphabetFilterExpanded);
        updateToggleArrowIcon();

        // Wenn der Filter geschlossen wird und nicht "Alle" aktiv war,
        // oder wenn er einfach geschlossen wird, soll "Alle" aktiv werden.
        if (!isAlphabetFilterExpanded) {
            filterStreetsByLetter('Alle');
        }
    };
    alphabetFilterContainer.appendChild(toggleButton);

    // Wrapper für die Buchstaben A-Z
    const lettersWrapper = document.createElement('div');
    lettersWrapper.id = 'alphabetLettersWrapper';
    alphabetFilterContainer.appendChild(lettersWrapper);

    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split('');
    alphabet.forEach(letter => {
        const button = createAlphabetButtonForWrapper(letter);
        lettersWrapper.appendChild(button);
    });

    updateAlphabetFilterActiveState(); // Initialen aktiven Zustand setzen
    updateToggleArrowIcon(); // Initiales Pfeil-Icon setzen
    alphabetFilterContainer.classList.toggle('expanded', isAlphabetFilterExpanded); // Initialen expand-Zustand
}

// Erstellt einen einzelnen Alphabet-Button für den Wrapper
function createAlphabetButtonForWrapper(letter) {
    const button = document.createElement('button');
    button.textContent = letter;
    button.className = 'alphabet-button'; // Nutzt vorhandene Basis-Stile
    button.type = 'button';
    button.dataset.letter = letter; // Data-Attribut zum einfachen Finden
    button.onclick = () => {
        filterStreetsByLetter(letter);
        // Der Wrapper soll offen bleiben, wenn ein Buchstabe gewählt wird
        if (!isAlphabetFilterExpanded) {
            isAlphabetFilterExpanded = true;
            alphabetFilterContainer.classList.toggle('expanded', true);
            updateToggleArrowIcon();
        }
    };
    return button;
}

// Filtert die Liste nach Anfangsbuchstaben und aktualisiert den aktiven Zustand
function filterStreetsByLetter(letter) {
    console.log(`[filterStreetsByLetter] Filtering by: ${letter}`);
    currentAlphabetFilter = letter; // Aktuellen Filter speichern

    if (!streetListContainer) return;

    const streetItems = streetListContainer.querySelectorAll('.street-item');
    let hasVisibleItems = false;
    streetItems.forEach(item => {
        const streetName = item.textContent.trim();
        let show = false;

        if (letter === 'Alle') {
            show = true;
        } else {
            show = streetName.toLowerCase().startsWith(letter.toLowerCase());
        }

        item.style.display = show ? 'block' : 'none';
        if (show) hasVisibleItems = true;
    });
    
    // "Kein Treffer"-Nachricht (optional, falls gewünscht für Filter ohne Ergebnis)
    const noFilterResultsMsgId = 'noFilterResultsMessage';
    let noFilterResultsMsg = streetListContainer.querySelector(`#${noFilterResultsMsgId}`);
    if (!hasVisibleItems && letter !== 'Alle') {
        if (!noFilterResultsMsg) {
            noFilterResultsMsg = document.createElement('p');
            noFilterResultsMsg.id = noFilterResultsMsgId;
            noFilterResultsMsg.style.textAlign = 'center';
            noFilterResultsMsg.style.padding = '20px';
            noFilterResultsMsg.textContent = `Keine Straßen beginnend mit "${letter}".`;
            streetListContainer.appendChild(noFilterResultsMsg);
        }
    } else {
        if (noFilterResultsMsg) noFilterResultsMsg.remove();
    }
     if (streetListPlaceholder && streetListPlaceholder.parentNode === streetListContainer) {
         streetListPlaceholder.style.display = hasVisibleItems ? 'none' : 'flex';
     }

    updateAlphabetFilterActiveState();
}

// NEU: Aktualisiert den visuellen Zustand (active class) der Filterbuttons
function updateAlphabetFilterActiveState() {
    const toggleButton = document.getElementById('alphabetToggleAllButton');
    const toggleLabel = document.getElementById('alphabetToggleLabel'); // Label im Toggle-Button
    
    if (toggleButton && toggleLabel) {
        if (currentAlphabetFilter === 'Alle') {
            toggleButton.classList.add('active');
            toggleLabel.textContent = 'Alle';
        } else {
            toggleButton.classList.remove('active');
            // Zeige den aktiven Buchstaben im Toggle-Button-Label, wenn der Filter zugeklappt ist
            if (!isAlphabetFilterExpanded && currentAlphabetFilter) {
                 toggleLabel.textContent = currentAlphabetFilter;
            } else {
                 toggleLabel.textContent = 'Alle'; // Oder 'Filter'
            }
        }
    }

    const lettersWrapper = document.getElementById('alphabetLettersWrapper');
    if (lettersWrapper) {
        const letterButtons = lettersWrapper.querySelectorAll('.alphabet-button');
        letterButtons.forEach(btn => {
            if (btn.dataset.letter === currentAlphabetFilter) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
}

// NEU: Aktualisiert das Pfeil-Icon im Toggle-Button
function updateToggleArrowIcon() {
    const arrowIcon = document.querySelector('#alphabetToggleAllButton .expand-arrow');
    if (arrowIcon) {
        arrowIcon.textContent = isAlphabetFilterExpanded ? 'expand_less' : 'expand_more';
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

    // Skeleton wird von switchView angezeigt. Inhalt wird von switchView ausgeblendet.
    if (statsErrorDisplay) statsErrorDisplay.style.display = 'none';
    // if (statsLoadingIndicator) statsLoadingIndicator.style.display = 'flex'; // ENTFERNT: Spinner nicht mehr anzeigen

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

        if (statsContent) statsContent.style.display = 'block'; // Inhalt anzeigen
        if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden'); // Skeleton ausblenden

    } catch (error) {
        console.error("Fehler beim Laden der Statistiken:", error);
        if (statsErrorDisplay) {
            statsErrorDisplay.textContent = `Fehler beim Laden der Statistiken: ${error.message}`;
            statsErrorDisplay.style.display = 'block';
        }
        if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden'); // Skeleton bei Fehler ausblenden
        if (statsContent) statsContent.style.display = 'none'; // Sicherstellen, dass Inhalt ausgeblendet bleibt
    } finally {
        // if (statsLoadingIndicator) statsLoadingIndicator.style.display = 'none'; // ENTFERNT
    }
}

async function loadLeaderboardData() {
    if (!currentUser) return;

    // Skeleton wird von switchView angezeigt. Inhalt wird von switchView ausgeblendet.
    if (leaderboardErrorDisplay) leaderboardErrorDisplay.style.display = 'none';
    // if (leaderboardLoadingIndicator) leaderboardLoadingIndicator.style.display = 'flex'; // ENTFERNT

    try {
        // Rufe die neue oder angepasste RPC-Funktion auf
        console.log("Rufe RPC Funktion 'get_leaderboard_geschrieben_v1' auf...");
        const { data: leaderboardEntries, error: rpcError } = await supabaseClient
            .rpc('get_leaderboard_geschrieben_v1'); // NEUER RPC-FUNKTIONSNAME

        if (rpcError) {
            console.error("Fehler beim RPC-Aufruf 'get_leaderboard_geschrieben_v1':", rpcError);
            throw new Error(`Fehler beim Abrufen des Leaderboards: ${rpcError.message}`);
        }

        if (!leaderboardEntries || !Array.isArray(leaderboardEntries)) {
             console.error("Ungültige Daten von RPC erhalten:", leaderboardEntries);
            throw new Error("Ungültige Daten vom Leaderboard-Endpunkt erhalten.");
        }

        displayLeaderboardData(leaderboardEntries);
        if (leaderboardContent) leaderboardContent.style.display = 'block'; // Inhalt anzeigen
        if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.add('hidden'); // Skeleton ausblenden

    } catch (error) {
        console.error("Fehler beim Laden des Leaderboards:", error);
        if (leaderboardErrorDisplay) {
            leaderboardErrorDisplay.textContent = `${error.message}`;
            leaderboardErrorDisplay.style.display = 'block';
        }
        if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.add('hidden'); // Skeleton bei Fehler ausblenden
        if (leaderboardContent) leaderboardContent.style.display = 'none'; // Sicherstellen, dass Inhalt ausgeblendet bleibt
    } finally {
        // if (leaderboardLoadingIndicator) leaderboardLoadingIndicator.style.display = 'none'; // ENTFERNT
    }
}

async function loadSettingsData() {
    if (!currentUser) return;

    // Skeleton wird von switchView angezeigt. Inhalt wird von switchView ausgeblendet.
    if (settingsErrorDisplay) settingsErrorDisplay.style.display = 'none';
    // if (settingsLoadingIndicator) settingsLoadingIndicator.style.display = 'flex'; // ENTFERNT
    if (settingsStatus) settingsStatus.textContent = '';
    if (settingsStatus) settingsStatus.className = '';

    try {
        // Hole aktuelle Benutzerdaten, inklusive Metadaten
        // Wichtig: getSession liefert nicht immer die aktuellsten Metadaten, getUser ist besser
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

         if (userError) throw userError;
         if (!user) throw new Error("Benutzerdaten konnten nicht geladen werden.");


        // Setze den aktuellen Anzeigenamen ins Feld
        const currentDisplayName = user.user_metadata?.display_name || '';
        if (displayNameInput) displayNameInput.value = currentDisplayName;

        if (settingsContent) settingsContent.style.display = 'block'; // Inhalt anzeigen
        if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden'); // Skeleton ausblenden

    } catch (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
        if (settingsErrorDisplay) {
            settingsErrorDisplay.textContent = `Fehler beim Laden der Einstellungen: ${error.message}`;
            settingsErrorDisplay.style.display = 'block';
        }
        if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden'); // Skeleton bei Fehler ausblenden
        if (settingsContent) settingsContent.style.display = 'none'; // Sicherstellen, dass Inhalt ausgeblendet bleibt
    } finally {
        // if (settingsLoadingIndicator) settingsLoadingIndicator.style.display = 'none'; // ENTFERNT
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

    let totalCountForPercentage = 0;
    definedCategories.forEach(category => {
        let count = 0;
        if (category === 'Andere') {
            count = (statusCounts['Andere'] || 0) + (statusCounts['null'] || 0);
        } else {
            count = statusCounts[category] || 0;
        }
        totalCountForPercentage += count; // Gesamtzahl für Prozentberechnung
    });


    definedCategories.forEach(category => {
        let count = 0;
        if (category === 'Andere') {
            count = (statusCounts['Andere'] || 0) + (statusCounts['null'] || 0);
        } else {
            count = statusCounts[category] || 0;
        }

        // Nur Kategorien mit Werten > 0 zum Diagramm hinzufügen,
        // es sei denn, es gibt gar keine Daten, dann wird eine Nachricht angezeigt.
        if (count > 0 || totalCountForPercentage === 0) {
            chartLabels.push(category);
            chartDataValues.push(count);
            chartBackgroundColors.push(categoryColors[category] || '#6b7280');
        }
    });


    if (chartLabels.length === 0 || totalCountForPercentage === 0) {
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
    const datalabelsColor = getComputedColor('--chart-datalabel-color', '#ffffff'); // Eigene Variable für Label-Farbe

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
                tooltip: { // Tooltips können optional beibehalten oder deaktiviert werden (enabled: false)
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed || 0;
                            label += value;

                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            if (total > 0) {
                                const percentage = ((value / total) * 100).toFixed(1) + '%';
                                label += ` (${percentage})`;
                            }
                            return label;
                        }
                    }
                },
                datalabels: { // Konfiguration für chartjs-plugin-datalabels
                    display: true,
                    formatter: (value, context) => {
                        const label = context.chart.data.labels[context.dataIndex];
                        const dataset = context.chart.data.datasets[0];
                        const total = dataset.data.reduce((acc, dataVal) => acc + dataVal, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0.0%';
                        
                        // Nur anzeigen, wenn der Prozentsatz z.B. über 5% liegt, um Überlappung zu vermeiden
                        if (parseFloat(percentage) < 5 && total > 0) {
                            return null; // Label für kleine Segmente ausblenden
                        }
                        return `${label}\n${percentage}`; // Kategoriename und darunter der Prozentsatz
                    },
                    color: datalabelsColor, // Farbe der Schrift, z.B. weiß für gute Lesbarkeit auf farbigen Segmenten
                    textAlign: 'center',
                    font: {
                        weight: 'bold',
                        size: 10, // Passe die Schriftgröße nach Bedarf an
                    },
                    anchor: 'center', // Position des Ankerpunkts des Labels
                    align: 'center',  // Ausrichtung des Labels relativ zum Ankerpunkt
                    // Optional: Abstand, wenn die Labels zu nah am Rand sind
                    // offset: 8,
                    // Optional: Drehung für bessere Passform (in Grad)
                    // rotation: 0,
                }
            }
        }
    });
}


function displayLeaderboardData(leaderboard) {
    if (!leaderboardTableBody) return;
    leaderboardTableBody.innerHTML = ''; // Tabelle leeren

    // Spaltenüberschriften im HTML anpassen oder hier dynamisch setzen, falls nötig.
    // Angenommen, dein HTML für den Header sieht so aus:
    // <thead>
    //   <tr>
    //     <th>Rang</th>
    //     <th>Name</th>
    //     <th>Geschrieben ✅</th>
    //   </tr>
    // </thead>
    // Falls nicht, müsstest du die Header-Zelle für "Geschrieben" hier anpassen oder sicherstellen,
    // dass sie im HTML schon korrekt ist.

    if (leaderboard.length === 0) {
        leaderboardTableBody.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 20px;">Noch keine "Geschrieben"-Einträge für das Leaderboard vorhanden.</td></tr>';
        return;
    }

    leaderboard.forEach((userEntry, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');

        // Hebe den aktuellen Benutzer hervor
        if (currentUser && userEntry.user_id === currentUser.id) { // user_id statt id verwenden, basierend auf RPC
            row.classList.add('current-user-row');
        }

        let rankDisplay = rank.toString();
        if (rank === 1) {
            rankDisplay = '🥇 ' + rank;
        } else if (rank === 2) {
            rankDisplay = '🥈 ' + rank;
        } else if (rank === 3) {
            rankDisplay = '🥉 ' + rank;
        }

        row.innerHTML = `
            <td>${rankDisplay}</td>
            <td>${escapeHtml(userEntry.display_name || 'Unbekannt')}</td>
            <td>${userEntry.geschrieben_count || 0}</td>
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
    // Overlay ist initial sichtbar.
    // Die checkSession-Funktion kümmert sich um das Ausblenden.
    setupLoginEnterListeners();

    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        console.log("ChartDataLabels Plugin registriert.");
    } else {
        console.warn('Chart oder ChartDataLabels Plugin nicht gefunden. Stelle sicher, dass es korrekt eingebunden ist.');
    }

    checkSession(); // Startet die Session-Prüfung
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

// NEUE Platzhalter-Funktion für Kalenderdaten
async function loadCalendarData() {
    if (!currentUser || !calendarView ) return;
    console.log("[loadCalendarData] Initializing Calendar View for Time Tracking.");

    // DOM Elemente initialisieren (einmalig oder bei Bedarf neu)
    initializeCalendarViewDOMElements();

    // Skeleton wird von switchView angezeigt. Inhalt (timeTrackingControls, timeTrackingHistory) wird von switchView ausgeblendet.
    if (calendarErrorDisplay) calendarErrorDisplay.style.display = 'none';
    // if (calendarLoadingIndicator) calendarLoadingIndicator.style.display = 'flex'; // ENTFERNT
    // currentStatusText wird durch Skeleton-Feedback ersetzt oder später gesetzt
    // if (currentStatusText) currentStatusText.textContent = "Lädt...";


    try {
        // Heutiges Datum für den Kalender-Input setzen
        if (historyDateInput) {
            if (!historyDateInput.value) { // Nur setzen, wenn leer, um manuelle Auswahl nicht zu überschreiben
                historyDateInput.valueAsDate = new Date();
            }
            historyDateInput.removeEventListener('change', handleHistoryDateChange); // Listener entfernen, falls schon vorhanden
            historyDateInput.addEventListener('change', handleHistoryDateChange);
        }
        
        await checkActiveWorkEntry(); // Prüfen, ob ein Eintrag aktiv ist
        await loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date()));

        // Inhalt anzeigen
        if (timeTrackingControls) timeTrackingControls.style.display = 'block'; // Oder 'flex', falls es ein Flex-Container ist
        if (timeTrackingHistory) timeTrackingHistory.style.display = 'block';
        if (calendarViewSkeleton) calendarViewSkeleton.classList.add('hidden'); // Skeleton ausblenden

    } catch (error) {
        console.error("Fehler beim Laden der Kalenderdaten:", error);
        if (calendarErrorDisplay) {
            calendarErrorDisplay.textContent = `Fehler beim Laden der Kalenderdaten: ${error.message}`;
            calendarErrorDisplay.style.display = 'block';
        }
        if (calendarViewSkeleton) calendarViewSkeleton.classList.add('hidden'); // Skeleton bei Fehler ausblenden
        // Sicherstellen, dass Inhalt ausgeblendet bleibt
        if (timeTrackingControls) timeTrackingControls.style.display = 'none';
        if (timeTrackingHistory) timeTrackingHistory.style.display = 'none';
    } finally {
        // if (calendarLoadingIndicator) calendarLoadingIndicator.style.display = 'none'; // ENTFERNT
    }
}

function initializeCalendarViewDOMElements() {
    timeTrackingControls = document.getElementById('timeTrackingControls');
    timeTrackingStatusDisplay = document.getElementById('timeTrackingStatusDisplay');
    currentStatusText = document.getElementById('currentStatusText');
    currentWorkDuration = document.getElementById('currentWorkDuration');
    todayTotalWork = document.getElementById('todayTotalWork');
    // todayTotalBreak = document.getElementById('todayTotalBreak'); // Entfernt
    startWorkButton = document.getElementById('startWorkButton');
    stopWorkButton = document.getElementById('stopWorkButton');

    timeTrackingHistory = document.getElementById('timeTrackingHistory');
    historyDateInput = document.getElementById('historyDateInput');
    dailySummaryDisplay = document.getElementById('dailySummaryDisplay');
    summaryDateDisplay = document.getElementById('summaryDateDisplay');
    summaryTotalWork = document.getElementById('summaryTotalWork');
    // summaryTotalBreak = document.getElementById('summaryTotalBreak'); // Entfernt
    timeEntriesList = document.getElementById('timeEntriesList');
    noHistoryEntriesMessage = document.getElementById('noHistoryEntriesMessage');
}


function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function handleHistoryDateChange() {
    if (historyDateInput) {
        loadDailySummaryAndEntries(historyDateInput.value);
    }
}

async function checkActiveWorkEntry() {
    if (!currentUser) return;
    console.log("Checking for active work entry...");
    try {
        const { data, error } = await supabaseClient
            .from('work_time_entries')
            .select('id, start_time')
            .eq('user_id', currentUser.id)
            .is('end_time', null) // end_time IS NULL
            .order('start_time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            activeWorkEntryId = data.id;
            workStartTime = new Date(data.start_time);
            updateWorkUIActive();
        } else {
            activeWorkEntryId = null;
            workStartTime = null;
            updateWorkUIInactive();
        }
    } catch (error) {
        console.error("Error checking active work entry:", error);
        showCalendarError("Fehler beim Prüfen des aktiven Eintrags.");
        updateWorkUIInactive(); // Fallback
    }
}

window.startWorkTimeTracking = async function() {
    if (!currentUser || activeWorkEntryId) return; // Verhindere Doppelstart

    console.log("Starting work time tracking...");
    if (startWorkButton) startWorkButton.disabled = true;
    if (currentStatusText) currentStatusText.textContent = "Starte...";

    const newStartTime = new Date();
    let notesContent = null; // Initialisiere notesContent

    // Versuche, die Geolokation abzurufen
    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation wird nicht unterstützt."));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, // Fordere höhere Genauigkeit an
                timeout: 10000,         // 10 Sekunden Timeout
                maximumAge: 60000         // Akzeptiere gecachte Position bis zu 1 Minute alt
            });
        });

        const { latitude, longitude } = position.coords;
        notesContent = `https://www.google.com/maps?q=${latitude},${longitude}`;
        console.log("Standort für Notiz erfasst:", notesContent);

    } catch (geoError) {
        console.warn("Fehler beim Abrufen der Geolokation für Notiz:", geoError.message);
        // Fahre fort, auch wenn der Standort nicht ermittelt werden konnte.
        // notesContent bleibt null oder leer.
    }


    try {
        const { data, error } = await supabaseClient
            .from('work_time_entries')
            .insert({
                user_id: currentUser.id,
                start_time: newStartTime.toISOString(),
                notes: notesContent // Füge den Standort-Link (oder null) hier ein
            })
            .select('id, start_time')
            .single();

        if (error) throw error;

        activeWorkEntryId = data.id;
        workStartTime = new Date(data.start_time); // Verwende die vom Server bestätigte Startzeit
        updateWorkUIActive();
        loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date())); // Historie aktualisieren
    } catch (error) {
        console.error("Error starting work:", error);
        showCalendarError("Fehler beim Starten der Arbeitszeit.");
        updateWorkUIInactive(); // Zurücksetzen
        if (startWorkButton) startWorkButton.disabled = false;
    }
};

window.stopWorkTimeTracking = async function() {
    if (!currentUser || !activeWorkEntryId) return;

    console.log("Stopping work time tracking...");
    if (stopWorkButton) stopWorkButton.disabled = true;
    if (currentStatusText) currentStatusText.textContent = "Stoppe...";

    const newEndTime = new Date();
    let durationMinutes = 0;
    if (workStartTime) {
        durationMinutes = Math.round((newEndTime - workStartTime) / (1000 * 60));
    }

    try {
        const { error } = await supabaseClient
            .from('work_time_entries')
            .update({
                end_time: newEndTime.toISOString(),
                duration_minutes: durationMinutes
            })
            .eq('id', activeWorkEntryId);

        if (error) throw error;

        activeWorkEntryId = null;
        workStartTime = null;
        updateWorkUIInactive();
        if (currentWorkDuration) currentWorkDuration.textContent = "00:00:00"; // Timer zurücksetzen
        loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date())); // Historie aktualisieren
    } catch (error) {
        console.error("Error stopping work:", error);
        showCalendarError("Fehler beim Stoppen der Arbeitszeit.");
        updateWorkUIActive(); // Bleibe im aktiven Zustand, wenn Fehler
        if (stopWorkButton) stopWorkButton.disabled = false;
    }
};

function updateWorkUIActive() {
    if (currentStatusText) {
        currentStatusText.textContent = workStartTime ? `Eingestempelt (${formatTime(workStartTime)})` : "Eingestempelt";
        currentStatusText.className = 'status-value active';
    }
    if (startWorkButton) startWorkButton.style.display = 'none';
    if (stopWorkButton) {
        stopWorkButton.style.display = 'inline-flex';
        stopWorkButton.disabled = false;
    }
    startDurationTimer();
}

function updateWorkUIInactive() {
    if (currentStatusText) {
        currentStatusText.textContent = "Ausgestempelt";
        currentStatusText.className = 'status-value inactive';
    }
    if (startWorkButton) {
        startWorkButton.style.display = 'inline-flex';
        startWorkButton.disabled = false;
    }
    if (stopWorkButton) stopWorkButton.style.display = 'none';
    stopDurationTimer();
    if (currentWorkDuration) currentWorkDuration.textContent = "00:00:00";
}

function startDurationTimer() {
    stopDurationTimer(); // Sicherstellen, dass kein alter Timer läuft
    if (!workStartTime) return;

    workTimerInterval = setInterval(() => {
        const now = new Date();
        const diffMs = now - workStartTime;
        if (currentWorkDuration) {
            currentWorkDuration.textContent = formatMillisecondsToHMS(diffMs);
        }
    }, 1000);
}

function stopDurationTimer() {
    if (workTimerInterval) {
        clearInterval(workTimerInterval);
        workTimerInterval = null;
    }
}

async function loadDailySummaryAndEntries(dateString) {
    if (!currentUser || !timeEntriesList || !noHistoryEntriesMessage) {
        console.warn("loadDailySummaryAndEntries: Required DOM elements or user not found.");
        return;
    }
    
    console.log(`Loading entries for date: ${dateString}`);
    if (calendarLoadingIndicator) calendarLoadingIndicator.style.display = 'flex';
    timeEntriesList.innerHTML = '';
    noHistoryEntriesMessage.style.display = 'none';
    if (summaryDateDisplay) summaryDateDisplay.textContent = formatDateForDisplay(dateString);
    if (summaryTotalWork) summaryTotalWork.textContent = '--:--';
    // if (summaryTotalBreak) summaryTotalBreak.textContent = '--:--'; // Entfernt
    if (todayTotalWork) todayTotalWork.textContent = '00:00'; // Reset daily totals for today as well
    // if (todayTotalBreak) todayTotalBreak.textContent = '00:00'; // Entfernt


    try {
        const startDate = new Date(dateString + "T00:00:00");
        const endDate = new Date(dateString + "T23:59:59.999");

        const { data: entries, error } = await supabaseClient
            .from('work_time_entries')
            .select('id, start_time, end_time, duration_minutes, notes')
            .eq('user_id', currentUser.id)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString()) // Einträge, die an diesem Tag gestartet wurden
            .order('start_time', { ascending: true });

        if (error) throw error;

        if (entries.length === 0) {
            noHistoryEntriesMessage.style.display = 'block';
        } else {
            let totalWorkMinutesForDay = 0;
            // let totalBreakMinutesForDay = 0; // Entfernt

            entries.forEach((entry, index) => {
                const li = document.createElement('li');
                li.className = 'time-entry-li';
                
                const startTimeFormatted = formatTime(new Date(entry.start_time));
                const endTimeFormatted = entry.end_time ? formatTime(new Date(entry.end_time)) : 'Laufend';
                const durationFormatted = entry.duration_minutes ? formatMinutesToHM(entry.duration_minutes) : '-';

                let notesDisplay = escapeHtml(entry.notes || '');
                if (entry.notes && (entry.notes.startsWith('http://') || entry.notes.startsWith('https://'))) {
                    notesDisplay = `<a href="${escapeHtml(entry.notes)}" target="_blank" rel="noopener noreferrer">${escapeHtml(entry.notes)}</a>`;
                }

                li.innerHTML = `
                    <div class="time-entry-details">
                        <strong>${startTimeFormatted} - ${endTimeFormatted}</strong>
                    </div>
                    <div class="time-entry-duration">Dauer: ${durationFormatted}</div>
                `;
                timeEntriesList.appendChild(li);

                if (entry.duration_minutes) {
                    totalWorkMinutesForDay += entry.duration_minutes;
                }

                // Pausenberechnung zum nächsten Eintrag // KOMPLETTER BLOCK ENTFERNT
                // if (entry.end_time && index < entries.length - 1) {
                //     const nextEntry = entries[index + 1];
                //     const breakStart = new Date(entry.end_time);
                //     const breakEnd = new Date(nextEntry.start_time);
                //     if (breakEnd > breakStart) {
                //         const breakDurationMs = breakEnd - breakStart;
                //         totalBreakMinutesForDay += Math.round(breakDurationMs / (1000 * 60));
                //     }
                // }
            });

            if (summaryTotalWork) summaryTotalWork.textContent = formatMinutesToHM(totalWorkMinutesForDay);
            // if (summaryTotalBreak) summaryTotalBreak.textContent = formatMinutesToHM(totalBreakMinutesForDay); // Entfernt

            // Wenn das angezeigte Datum heute ist, aktualisiere auch die "Heute" Anzeige
            const todayDateString = getLocalDateString(new Date());
            if (dateString === todayDateString) {
                if (todayTotalWork) todayTotalWork.textContent = formatMinutesToHM(totalWorkMinutesForDay);
                // if (todayTotalBreak) todayTotalBreak.textContent = formatMinutesToHM(totalBreakMinutesForDay); // Entfernt
            }
        }

    } catch (err) {
        console.error("Error loading daily entries:", err);
        showCalendarError("Fehler beim Laden der Tageshistorie.");
        noHistoryEntriesMessage.style.display = 'block'; // Zeige "keine Einträge" auch bei Fehler
    } finally {
        if (calendarLoadingIndicator) calendarLoadingIndicator.style.display = 'none';
    }
}

// --- Hilfsfunktionen für Zeiterfassung ---
function formatTime(date) {
    if (!date) return '--:--';
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function formatMinutesToHM(minutes) {
    if (minutes === null || isNaN(minutes)) return '--:--';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function formatMillisecondsToHMS(ms) {
    if (ms === null || isNaN(ms) || ms < 0) return '00:00:00';
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateForDisplay(dateString) {
    const date = new Date(dateString + "T00:00:00"); // Sicherstellen, dass es als lokales Datum interpretiert wird
    return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
}

function showCalendarError(message) {
    if (calendarErrorDisplay) {
        calendarErrorDisplay.textContent = message;
        calendarErrorDisplay.style.display = 'block';
        setTimeout(() => {
            calendarErrorDisplay.style.display = 'none';
            calendarErrorDisplay.textContent = '';
        }, 5000);
    }
}


// --- Aufräumen beim Verlassen der View ---
// Dies ist ein Beispiel, wie man den Timer stoppen könnte.
// switchView müsste angepasst werden, um eine "onLeave" Callback für Views zu unterstützen.
// Für den Moment wird der Timer global gestoppt/gestartet, wenn die Buttons geklickt werden
// oder die View geladen wird.

// ... bestehender Code ...
// Am Ende der Datei oder wo passend:
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        // Optional: Hier könnte man den Timer anhalten oder eine Notiz speichern,
        // falls die App im Hintergrund ist. Fürs Erste belassen wir es bei der
        // kontinuierlichen Zeitmessung, solange die Seite offen ist.
        console.log("Seite ist jetzt im Hintergrund / nicht sichtbar.");
    } else if (document.visibilityState === 'visible') {
        console.log("Seite ist wieder sichtbar.");
        // Beim Sichtbarwerden den Status neu prüfen, falls die Kalender-View aktiv ist
        if (calendarView && calendarView.classList.contains('active-view')) {
            checkActiveWorkEntry(); // UI und Timer ggf. neu starten
            // Historie für das aktuell im Datepicker ausgewählte Datum neu laden.
            if (historyDateInput && historyDateInput.value) {
                 loadDailySummaryAndEntries(historyDateInput.value);
            }
        }
    }
});

