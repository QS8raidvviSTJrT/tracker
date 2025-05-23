const supabaseUrl = 'https://pvjjtwuaofclmsvsaneo.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amp0d3Vhb2ZjbG1zdnNhbmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4NzM2OTksImV4cCI6MjA2MjQ0OTY5OX0.yc4F3gKDGKMmws60u3KOYSM8t06rvDiJgOvEAuiYRa8'
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        

        // NEU: LocalStorage Keys
        const LS_STREET_CACHE_KEY = 'doorTrackerStreetCache';
        const LS_ACTIVE_STREET_DETAIL_KEY = 'doorTrackerActiveStreetDetail';
        const LS_LAST_OPENED_STREET_KEY = 'doorTrackerLastOpenedStreet'; // NEU
        const LS_COLOR_SCHEME_KEY = 'doorTrackerColorScheme'; // NEU für Farbschema

        // NEU: Globale Variable für den aktuellen Statistik-Filter
        let currentStatsFilter = 'allTime'; // Mögliche Werte: 'allTime', 'thisYear', 'thisMonth', 'thisWeek', 'today'

        // Cache für Overpass-Daten (Gesamtzahl Hausnummern) - Sicherstellen, dass es global ist
        const totalHouseNumbersCache = new Map();
        const TOTAL_HN_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Stunden in Millisekunden

        // Globale Daten für den Straßenfortschritt
        let streetProgressData = new Map(); // Key: "PLZ-Straßenname", Value: { processedCount: number, percentCompletedFromDB: number | null }

        // NEU: LocalStorage Helper Functions
        function saveToLocalStorage(key, data) {
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                // console.warn("Error saving to localStorage", key, e);
                showErrorNotification("Error saving to localStorage: " + key + " " + (e.message || e.toString()));
                showErrorNotification("Fehler beim Speichern: " + (e.message || e.toString()));
            }
        }

        function getFromLocalStorage(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                // console.warn("Error getting from localStorage", key, e);
                showErrorNotification("Error getting from localStorage: " + key + " " + (e.message || e.toString()));
                showErrorNotification("Fehler beim Laden: " + (e.message || e.toString()));
                return null;
            }
        }

        function removeFromLocalStorage(key) {
            try {
                localStorage.removeItem(key);
            } catch (e) {
                // console.warn("Error removing from localStorage", key, e);
                showErrorNotification("Error removing from localStorage: " + key + " " + (e.message || e.toString()));
                showErrorNotification("Fehler beim Entfernen: " + (e.message || e.toString()));
            }
        }

        // --- NEU: Funktionen für Farbschema (HIERHIN VERSCHOBEN) ---
        let currentColorScheme = 'system'; // Default, wird beim Laden überschrieben
        let systemThemeListener = null; // Für den Media Query Listener

        function applyColorScheme(scheme) {
            if (!['light', 'dark', 'system'].includes(scheme)) {
                // console.warn('Ungültiges Farbschema:', scheme);
                showErrorNotification('Ungültiges Farbschema: ' + scheme);
                scheme = 'system'; // Fallback
            }

            currentColorScheme = scheme; // Benutzerauswahl speichern
            saveToLocalStorage(LS_COLOR_SCHEME_KEY, scheme);

            let themeToSet;
            if (scheme === 'system') {
                themeToSet = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                // Listener für Systemänderungen hinzufügen/aktualisieren
                if (!systemThemeListener) {
                    systemThemeListener = (e) => {
                        if (currentColorScheme === 'system') { // Nur anwenden, wenn System-Modus aktiv ist
                            document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
                        }
                    };
                    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', systemThemeListener);
                }
            } else {
                themeToSet = scheme;
                // Ggf. bestehenden System-Listener entfernen, wenn explizit Light/Dark gewählt wird
                // Obwohl es nicht schadet, ihn aktiv zu lassen, solange currentColorScheme nicht 'system' ist.
            }

            document.documentElement.setAttribute('data-theme', themeToSet);
            //console.log(`Farbschema angewendet: User-Auswahl='${scheme}', Tatsächlich='${themeToSet}'`);

            // Aktualisiere das Select-Element, falls es existiert und sichtbar ist
            // Stelle sicher, dass colorSchemeSelect initialisiert wurde, bevor darauf zugegriffen wird
            if (colorSchemeSelect && colorSchemeSelect.value !== scheme) {
                colorSchemeSelect.value = scheme;
            }
        }

        function loadAndApplyInitialColorScheme() {
            const storedScheme = getFromLocalStorage(LS_COLOR_SCHEME_KEY);
            // Stellt sicher, dass 'system' der Default ist, wenn nichts gespeichert oder ein ungültiger Wert gespeichert wurde.
            applyColorScheme(storedScheme || 'system');
        }
        // --- ENDE VERSCHOBENE FUNKTIONEN ---


        let deferredPrompt;
let currentUser = null;
let currentSelectedStreetId = null; // ID der aktuell ausgewählten Straße
let currentSelectedStreetName = null; // NEU
let currentSelectedPostalCode = null; // NEU
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
let colorSchemeSelect = null; // Wird in loadSettingsData initialisiert

const streetListPlaceholder = document.getElementById('streetListPlaceholder'); // Referenz zum Platzhalter
const alphabetFilterContainer = document.getElementById('alphabetFilterContainer'); // NEU
let lastOpenedStreetElementContainer = null; // NEU: Globale Referenz für "Zuletzt geöffnet"

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
let workTimeExportContainer, workTimeExportMonthSelect, exportSelectedMonthButton; // NEU für PDF-Export

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

// NEU: Referenzen für Admin-View
const adminSettingsButton = document.getElementById('adminSettingsButton');
const adminView = document.getElementById('adminView');
const adminViewSkeleton = document.querySelector('.admin-view-skeleton');
const adminContent = document.getElementById('adminContent');
const adminLoadingIndicator = document.getElementById('adminLoadingIndicator');
const adminErrorDisplay = document.getElementById('adminErrorDisplay');

// NEU: Referenzen für Arbeitszeitauswertung-View
const workTimeEvaluationView = document.getElementById('workTimeEvaluationView');
const workTimeEvalViewSkeleton = document.querySelector('.work-time-eval-view-skeleton');
const userEvalList = document.getElementById('userEvalList');
const userDetailEvalContainer = document.getElementById('userDetailEvalContainer');
const userDetailEvalName = document.getElementById('userDetailEvalName');
const monthlyWorkTimeTableContainer = document.getElementById('monthlyWorkTimeTableContainer');
const monthlyWorkTimeSkeleton = document.getElementById('monthlyWorkTimeSkeleton');
const userListForEvalContainer = document.getElementById('userListForEvalContainer'); // NEU

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
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) {
            console.error('Error checking session:', error);
            if (isInvalidRefreshTokenError(error)) {
                showErrorNotification("Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu, um sich erneut anzumelden.");
                // showLogin() wird ohnehin aufgerufen, das Neuladen ist hier wichtiger.
            }
            showLogin(); // Zeige Login bei Fehler
            return;
        }
        if (session) {
            currentUser = session.user;
            showApp();
        } else {
            showLogin();
        }
    } catch (catchError) { // Fängt Fehler ab, die von getSession selbst geworfen werden könnten
        console.error('Unexpected critical error in checkSession:', catchError);
        if (isInvalidRefreshTokenError(catchError)) {
            showErrorNotification("Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu, um sich erneut anzumelden.");
        }
        showLogin(); // Im Zweifel immer zum Login
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

async function showApp() {
    loginContainer.style.display = 'none';
    appContainer.style.display = 'flex';
    hideInitialLoadingOverlay();

    // WICHTIG: Lade alle Fortschrittsdaten aus der DB und fülle die globale Map
    // Dies geschieht, bevor searchStreets oder displayStreets aufgerufen werden könnten.
    // await fetchAllStreetProgressDataFromDB(); // ENTFERNT

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
            // und displayStreets wird die frisch geladene globale streetProgressData Map verwenden
            searchStreets();
        } else {
            // Wenn keine letzte PLZ im Cache, versuche Standort
            getPostalCodeFromLocation();
            // Wenn keine PLZ ermittelt werden kann, zeige den Platzhalter, aber warte nicht ewig.
            if (!plzInput.value && streetListPlaceholder && streetListContainer) {
                 setTimeout(() => {
                     if (!plzInput.value && streetListContainer.children.length === 0) { // Nur wenn immer noch leer
                         streetListContainer.innerHTML = ''; // Leeren, falls alter Inhalt da ist
                         streetListContainer.appendChild(streetListPlaceholder);
                         streetListPlaceholder.style.display = 'flex';
                         if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none';
                         loadingIndicator.style.display = 'none'; // Ladeindikator ausblenden
                     }
                 }, 5000); // 5 Sekunden Timeout für Standort
            }
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
        // 1. Prüfe den Registrierungscode direkt aus der Tabelle
        //console.log("Versuche Registrierungscode zu prüfen via direkter Tabellenabfrage:", registrationCodeValue);
        const { data: codeData, error: validationError } = await supabaseClient
            .from('registration_codes')
            .select('id, code_value, is_used, used_by')
            .eq('code_value', registrationCodeValue)
            .maybeSingle();

        if (validationError) {
            console.error('Supabase Fehler beim Prüfen des Registrierungscodes (Tabelle):', validationError);
            throw new Error('Fehler bei der Code-Prüfung. Versuche es später erneut.');
        }
        //console.log("Antwort von direkter Tabellenabfrage registration_codes:", codeData);

        if (!codeData) {
            // console.warn("Code nicht in der Datenbank gefunden für:", registrationCodeValue);
            showErrorNotification("Code nicht in der Datenbank gefunden für: " + registrationCodeValue);
            throw new Error('Ungültiger Registrierungscode.');
        }

        if (codeData.is_used || codeData.used_by) {
            // console.warn("Der Code", registrationCodeValue, "wurde bereits verwendet.");
            showErrorNotification("Der Code " + registrationCodeValue + " wurde bereits verwendet.");
            throw new Error('Dieser Registrierungscode wurde bereits verwendet.');
        }

        fetchedCodeId = codeData.id;

        // 2. Registriere den Benutzer
        //console.log("Code ist gültig und unbenutzt. Versuche Benutzer zu registrieren...");
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({ email, password });
        if (signUpError) {
            console.error('Supabase Fehler bei auth.signUp:', signUpError);
            throw signUpError;
        }

        //console.log("Benutzer erfolgreich registriert:", signUpData.user.email, "User ID:", signUpData.user.id);

        // 3. Markiere den Code als benutzt durch direktes Update
        if (!fetchedCodeId) {
            console.error("KRITISCH: fetchedCodeId ist null, kann Code nicht als benutzt markieren.");
            throw new Error("Interner Fehler: Code-ID nicht gefunden nach Validierung.");
        }

        //console.log("Versuche Code als benutzt zu markieren (direktes Update) für Code ID:", fetchedCodeId, "User ID:", signUpData.user.id);
        const { error: claimError } = await supabaseClient
            .from('registration_codes')
            .update({
                is_used: true,
                used_by: signUpData.user.id,
                used_at: new Date().toISOString()
            })
            .eq('id', fetchedCodeId);

        if (claimError) {
            console.error('KRITISCH: User erstellt, aber Code konnte nicht (direktes Update) als "benutzt" markiert werden:', claimError);
        } else {
            //console.log("Code erfolgreich als benutzt markiert (direktes Update).");
        }

        alert('Registrierung erfolgreich! Bitte E-Mail-Adresse bestätigen und erneut einloggen.');
        showLoginInterface();

    } catch (error) {
        //console.error("Fehler im gesamten Registrierungsprozess:", error);
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

// NEUE Funktion für den "Locate Me" Button
window.locateMe = async function() {
    const locateButton = document.getElementById('locateMeButton');


    if (!navigator.geolocation) {
        showError("Standortdienste werden von Ihrem Browser nicht unterstützt oder sind blockiert.");
        if (locateButton) {
            locateButton.disabled = false;
            const icon = locateButton.querySelector('.material-icons');
            if (icon) icon.classList.remove('spin');
        }
        return;
    }

    clearError();



    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, // Fordere höhere Genauigkeit an
                timeout: 10000,         // 10 Sekunden Timeout
                maximumAge: 60000         // Akzeptiere gecachte Position bis zu 1 Minute alt
            });
        });

        const { latitude, longitude } = position.coords;
        // if (loadingIndicator) loadingIndicator.textContent = "Ermittle PLZ...";

        const postalCode = await reverseGeocode(latitude, longitude);
        if (postalCode) {
            plzInput.value = postalCode;
            // searchStreets() wird nun die Straßen laden und den loadingIndicator selbst ausblenden
            await searchStreets(); // Warten bis searchStreets fertig ist, um loadingIndicator korrekt zu behandeln
        } else {
            showError("PLZ konnte für Ihren Standort nicht ermittelt werden.");
        }
    } catch (error) {
        showErrorNotification("Fehler bei der Standortabfrage oder PLZ-Ermittlung: " + (error.message || error.toString()));
        console.warn("Fehler bei der Standortabfrage oder PLZ-Ermittlung:", error);
        let errorMessage = "Standort konnte nicht abgerufen werden.";
        if (error.code) {
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = "Zugriff auf Standort verweigert.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = "Standortinformationen sind nicht verfügbar.";
                    break;
                case error.TIMEOUT:
                    errorMessage = "Timeout bei der Standortabfrage.";
                    break;
            }
        } else if (error.message.includes("Nominatim")) {
            errorMessage = "PLZ konnte nicht ermittelt werden (Nominatim Fehler).";
        }
        showError(errorMessage);
    } finally {
        if (locateButton) {
            locateButton.disabled = false;
            const icon = locateButton.querySelector('.material-icons');
            if (icon) icon.classList.remove('spin');
        }

        // Falls searchStreets() erfolgreich war, wird der Indikator dort schon ausgeblendet.
        // Falls nicht, aber eine PLZ gefunden wurde, könnte er noch an sein.
        // Die Logik in searchStreets() sollte das aber abdecken.
    }
}

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
                // console.warn("Fehler beim Reverse Geocoding:", error);
                showErrorNotification("Fehler beim Reverse Geocoding: " + (error.message || error.toString()));
                // Fehler wird von reverseGeocode schon geloggt, hier evtl. User-Feedback?
                showError("PLZ konnte für Ihren Standort nicht ermittelt werden.");
            } finally {
                // loadingIndicator wird von searchStreets() ausgeblendet oder hier, falls keine PLZ gefunden
                if (loadingIndicator.style.display === 'block' && !plzInput.value) {
                     loadingIndicator.style.display = 'none';
                }
            }
        },
        (error) => {
            console.warn("Standortabfrage fehlgeschlagen:", error.message);
            //showErrorNotification("Standortabfrage fehlgeschlagen: " + error.message);
            let errorMessage = "Standort konnte nicht abgerufen werden.";
             if (error.code) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Zugriff auf Standort verweigert.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Standortinformationen sind nicht verfügbar.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Timeout bei der Standortabfrage.";
                        break;
                }
            }
            showError(errorMessage);
            loadingIndicator.style.display = 'none';
            // loadingIndicator.textContent = "Lade Straßen..."; // ENTFERNT
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 } // enableHighAccuracy auf true
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
    removeFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY);
    if (streetDetailContainer) streetDetailContainer.style.display = 'none';
    if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';
    // if(alphabetFilterContainer) alphabetFilterContainer.style.display = 'none'; // Wird in displayStreets gehandhabt

    // Bestehende UI-Elemente für Straßenliste und Filter zurücksetzen/entfernen
    if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
    streetListContainer.innerHTML = '';
    streetListContainer.style.display = 'none';

    // "Zuletzt geöffnet"-Element entfernen, falls vorhanden
    if (lastOpenedStreetElementContainer && lastOpenedStreetElementContainer.parentNode) {
        lastOpenedStreetElementContainer.parentNode.removeChild(lastOpenedStreetElementContainer);
        lastOpenedStreetElementContainer = null;
    }
    // Alphabet-Filter ausblenden (wird in displayStreets bei Bedarf neu aufgebaut/angezeigt)
    if (alphabetFilterContainer) {
        alphabetFilterContainer.style.display = 'none';
        alphabetFilterContainer.innerHTML = ''; // Leeren für sauberen Neuaufbau
    }

    // Prüfen, ob Straßen für diese PLZ im Cache sind
    const cachedData = getFromLocalStorage(LS_STREET_CACHE_KEY);
    if (cachedData && cachedData.lastPlz === plz && cachedData.streets) {
        console.log("Loading streets from localStorage for PLZ:", plz);
        if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
        streetListContainer.innerHTML = ''; // Leeren für neue Liste
        // ENTFERNT: await fetchAllStreetProgressDataFromDB(); 
        // displayStreets verwendet jetzt die globale streetProgressData Map, die beim App-Start gefüllt wurde.
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
            showError(errorDisplay.textContent + " API überlastet. Später erneut versuchen.");
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
    streetListContainer.innerHTML = '';
    const parent = streetListContainer.parentNode;

    if (alphabetFilterContainer) {
        alphabetFilterContainer.innerHTML = '';
        alphabetFilterContainer.style.display = 'none';
    }

    // "Zuletzt geöffnet" Logik (unverändert, aber nach der Initialisierung von streetProgressData)
    const lastOpenedStreetData = getFromLocalStorage(LS_LAST_OPENED_STREET_KEY);
    if (lastOpenedStreetElementContainer && lastOpenedStreetElementContainer.parentNode === parent) {
        parent.removeChild(lastOpenedStreetElementContainer);
        lastOpenedStreetElementContainer = null;
    }
    if (lastOpenedStreetData && lastOpenedStreetData.postalCode === postalCode) {
        // ... (Code für "Zuletzt geöffnet" Button bleibt hier) ...
        lastOpenedStreetElementContainer = document.createElement('div');
        lastOpenedStreetElementContainer.className = 'last-opened-street-button'; 

        lastOpenedStreetElementContainer.style.background = 'linear-gradient(135deg, var(--primary-color-light, #79bbff) 0%, var(--primary-color, #0d6efd) 100%)';
        lastOpenedStreetElementContainer.style.color = 'white';
        lastOpenedStreetElementContainer.style.display = 'flex';
        lastOpenedStreetElementContainer.style.justifyContent = 'space-between';
        lastOpenedStreetElementContainer.style.alignItems = 'center';
        lastOpenedStreetElementContainer.style.padding = '8px 15px'; 
        lastOpenedStreetElementContainer.style.borderRadius = '8px'; 
        lastOpenedStreetElementContainer.style.cursor = 'pointer';
        lastOpenedStreetElementContainer.style.transition = 'transform 0.2s ease-out'; 

        lastOpenedStreetElementContainer.onmouseover = function() {
            this.style.transform = 'translateY(-2px)';
        };
        lastOpenedStreetElementContainer.onmouseout = function() {
            this.style.transform = 'translateY(0)';
        };
        
        const streetNameDisplay = lastOpenedStreetData.streetName.length > 30 
            ? escapeHtml(lastOpenedStreetData.streetName.substring(0, 27)) + "..." 
            : escapeHtml(lastOpenedStreetData.streetName);
        
        lastOpenedStreetElementContainer.innerHTML = 
            `<div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.75em; opacity: 0.9; line-height: 1.2;">Zuletzt geöffnet:</span>
                <span style="font-weight: 500; font-size: 0.9em; line-height: 1.2;">${streetNameDisplay}</span>
            </div>
            <span class="material-icons" style="font-size: 24px; opacity: 0.9;">chevron_right</span>`; 
        
        lastOpenedStreetElementContainer.title = `Gehe zu: ${escapeHtml(lastOpenedStreetData.streetName)}`;
        
        lastOpenedStreetElementContainer.onclick = () => selectStreet(lastOpenedStreetData.streetName, lastOpenedStreetData.postalCode);

        if (parent) {
            parent.insertBefore(lastOpenedStreetElementContainer, streetListContainer);
        }

    }


    if (streets.length > 0) {
        if (alphabetFilterContainer) { // Alphabet-Filter nur anzeigen, wenn Straßen vorhanden sind
            renderAlphabetFilter();
            alphabetFilterContainer.style.display = 'flex';
        }

         streets.forEach(streetNameInput => { // streetNameInput kann String oder Objekt sein
            const streetName = typeof streetNameInput === 'object' && streetNameInput.name ? streetNameInput.name : streetNameInput;

            const streetElement = document.createElement('div');
            streetElement.className = 'street-item';
            streetElement.onclick = () => selectStreet(streetName, postalCode);

            const streetNameSpan = document.createElement('span');
            streetNameSpan.className = 'street-item-name';
            streetNameSpan.textContent = streetName;
            streetElement.appendChild(streetNameSpan);

            // const progressIndicatorContainer = document.createElement('div'); // ENTFERNT
            // progressIndicatorContainer.className = 'street-item-progress'; // ENTFERNT

            // progressIndicatorContainer.innerHTML = ` // ENTFERNT
            //     <svg class="progress-ring" width="20" height="20" viewBox="0 0 20 20">
            //         <circle class="progress-ring__background" r="8" cx="10" cy="10"/>
            //         <circle class="progress-ring__circle" r="8" cx="10" cy="10"/>
            //     </svg>
            //     <span class="progress-percentage">--%</span>
            // `; // ENTFERNT
            // streetElement.appendChild(progressIndicatorContainer); // ENTFERNT

            // Lese Fortschritt aus der globalen streetProgressData Map // ENTFERNT
            // const streetKey = `${postalCode}-${streetName}`; // ENTFERNT
            // const progressInfo = streetProgressData.get(streetKey); // ENTFERNT

            // if (progressInfo) { // ENTFERNT
            //     // percentCompletedFromDB kann null sein, updateStreetProgressUI behandelt das
            //     updateStreetProgressUI(progressIndicatorContainer, { // ENTFERNT
            //         processedCount: progressInfo.processedCount,  // ENTFERNT
            //         totalCount: null, // Wird nicht benötigt, da wir uns auf directPercentage verlassen // ENTFERNT
            //         directPercentage: progressInfo.percentCompletedFromDB // ENTFERNT
            //     });
            // } else { // ENTFERNT
            //     // Falls keine Daten in der globalen Map für diese Straße
            //     updateStreetProgressUI(progressIndicatorContainer, { // ENTFERNT
            //         processedCount: 0, // ENTFERNT
            //         totalCount: null, // ENTFERNT
            //         directPercentage: null  // ENTFERNT
            //     });
            //      console.warn(`Keine Fortschrittsdaten in globaler Map für ${streetKey} beim Anzeigen der Straßenliste.`); // ENTFERNT
            // }
            streetListContainer.appendChild(streetElement);
         });

         if (currentAlphabetFilter) {
             filterStreetsByLetter(currentAlphabetFilter);
         } else {
             filterStreetsByLetter('Alle');
         }
    } else {
        if (alphabetFilterContainer) alphabetFilterContainer.style.display = 'none'; // Kein Filter wenn keine Straßen
        if (!lastOpenedStreetElementContainer && streetListContainer.children.length === 0) {
            streetListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Keine Straßen für diese PLZ gefunden.</p>';
        }
    }
    streetListContainer.style.display = 'flex';
}

// --- Hausnummern-Verwaltung ---

async function selectStreet(streetName, postalCode) {
    console.log(`Ausgewählte Straße: ${streetName}, PLZ: ${postalCode}`);
    clearError();

    // Bestehende Logik zum Entfernen des "Zuletzt geöffnet"-Buttons, falls dieser geklickt wurde.
    const lastOpenedStreetDataForRemoval = getFromLocalStorage(LS_LAST_OPENED_STREET_KEY);
    if (lastOpenedStreetElementContainer &&
        lastOpenedStreetDataForRemoval &&
        lastOpenedStreetDataForRemoval.streetName === streetName &&
        lastOpenedStreetDataForRemoval.postalCode === postalCode) {
        if (lastOpenedStreetElementContainer.parentNode) {
            lastOpenedStreetElementContainer.parentNode.removeChild(lastOpenedStreetElementContainer);
        }
        lastOpenedStreetElementContainer = null;
    }

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
    }

    if (lastOpenedStreetElementContainer && lastOpenedStreetElementContainer.parentNode) {
        lastOpenedStreetElementContainer.parentNode.removeChild(lastOpenedStreetElementContainer);
        lastOpenedStreetElementContainer = null;
    }

    currentSortOrder = getFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY)?.sortOrder || 'house_number_asc';

    try {
        let { data: existingStreet, error: fetchError } = await supabaseClient
            .from('streets')
            .select('id')
            .eq('name', streetName)
            .eq('postal_code', postalCode)
            .maybeSingle();

        if (fetchError) {
            console.error("Supabase fetchError (streets select):", JSON.stringify(fetchError, null, 2));
            throw fetchError;
        }

        if (existingStreet) {
            currentSelectedStreetId = existingStreet.id;
        } else {
            const { data: newStreet, error: insertError } = await supabaseClient
                .from('streets')
                .insert({ name: streetName, postal_code: postalCode })
                .select('id')
                .single();
            if (insertError) {
                console.error("Supabase insertError (streets insert):", JSON.stringify(insertError, null, 2));
                throw insertError;
            }
            currentSelectedStreetId = newStreet.id;
            console.log(`Straße "${streetName}" (${postalCode}) mit ID ${currentSelectedStreetId} global neu angelegt.`);
        }

        currentSelectedStreetName = streetName; // NEU: Namen speichern
        currentSelectedPostalCode = postalCode; // NEU: PLZ speichern

        await loadHouseEntries(currentSelectedStreetId);
        renderStreetDetailView(streetName); // Rendert den Inhalt in streetDetailContainer

        if (streetDetailContainer) streetDetailContainer.style.display = 'block';
        if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';

        saveToLocalStorage(LS_LAST_OPENED_STREET_KEY, { streetName, postalCode });
        saveToLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY, {
            streetId: currentSelectedStreetId,
            streetName: streetName,
            postalCode: postalCode,
            sortOrder: currentSortOrder
        });

        // NEU: Fortschritt berechnen und speichern, nachdem Einträge geladen wurden // ENTFERNT
        // if (currentSelectedStreetId && currentSelectedStreetName && currentSelectedPostalCode) { // ENTFERNT
        // await calculateAndUpdateStreetProgress(currentSelectedStreetId, currentSelectedStreetName, currentSelectedPostalCode); // ENTFERNT
        // } // ENTFERNT

    } catch (error) {
        console.error('Fehler beim Auswählen/Anlegen der Straße oder Laden der Einträge:', error);
        let userMessage = `Ein Fehler ist aufgetreten: ${error.message}`;
        // Versuche, spezifischere Informationen aus dem Supabase-Fehlerobjekt zu extrahieren
        const supabaseErrorDetails = error.details || (error.error && error.error.message) || '';
        const supabaseErrorCode = error.code || (error.error && error.error.code) || '';

        if (error.status === 400 || (error.message && error.message.includes("400"))) {
            userMessage = `Fehlerhafte Anfrage (400) beim Laden der Straßendetails. Details: ${supabaseErrorDetails || error.message}. Code: ${supabaseErrorCode}. Bitte prüfen Sie die Eingaben oder versuchen Sie es später erneut.`;
            console.error('Detailliertes Fehlerobjekt (400):', JSON.stringify(error, null, 2));
        } else if (error.status === 401 || error.status === 403 || (error.message && (error.message.includes("401") || error.message.includes("403")))) {
            userMessage = `Sitzung möglicherweise abgelaufen oder keine Berechtigung (${error.status || 'N/A'}). Details: ${supabaseErrorDetails || error.message}. Bitte neu laden oder einloggen.`;
            // Erwägen, checkSession() aufzurufen, aber Vorsicht vor Endlosschleifen.
            // checkSession();
        } else {
            // Allgemeiner Fehler
             userMessage = `Ein Fehler ist aufgetreten (${error.status || 'N/A'}): ${supabaseErrorDetails || error.message}. Code: ${supabaseErrorCode}.`;
        }


        showError(userMessage);
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

        if (error) {
            console.error("Supabase error (loadHouseEntries):", JSON.stringify(error, null, 2));
            throw error;
        }
        currentHouseEntries = data || [];
        console.log(`${currentHouseEntries.length} Hausnummern-Einträge geladen für Street ID ${streetId}`);
    } catch (error) {
        console.error('Fehler beim Laden der Hausnummern:', error);
        let userMessage = `Fehler beim Laden der Hausnummern: ${error.message}`;
        if (error.status === 400) {
            userMessage = `Fehlerhafte Anfrage (400) beim Laden der Hausnummern. Details: ${error.details || error.message}.`;
        }
        showError(userMessage);
        currentHouseEntries = []; // Im Fehlerfall leeren
    }
}

// Rendert die komplette Ansicht für Hausnummern (Eingabe + Liste)
function renderStreetDetailView(streetName) {
    streetDetailContainer.innerHTML = ''; // Container leeren
    streetDetailContainer.style.display = 'block';

    // Header-Div für Zurück-Button und Auswertungs-Button
    const headerDiv = document.createElement('div');
    headerDiv.style.display = 'flex';
    headerDiv.style.justifyContent = 'space-between'; // Buttons an den Enden platzieren
    headerDiv.style.alignItems = 'center';
    headerDiv.style.marginBottom = '20px';

    const backButton = document.createElement('button');
    backButton.onclick = backToStreetList;
    backButton.className = 'buttonnumpad'; // Wiederverwendung von Stilen
    backButton.style.padding = '5px 10px';
    backButton.style.width = 'auto';
    backButton.style.height = 'auto';
    backButton.style.fontSize = '0.9em';
    backButton.textContent = 'Zurück';
    headerDiv.appendChild(backButton);

    const statsButton = document.createElement('button');
    statsButton.onclick = showStreetStatsModal;
    statsButton.className = 'buttonnumpad'; // Wiederverwendung von Stilen
    statsButton.style.padding = '5px 10px';
    statsButton.style.width = 'auto';
    statsButton.style.height = 'auto';
    statsButton.style.fontSize = '0.9em';
    statsButton.innerHTML = '<span class="material-icons" style="font-size: 1.2em; vertical-align: middle;">query_stats</span> Auswertung';
    headerDiv.appendChild(statsButton);

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
            <button onclick="clearHouseEntryForm()" class="button-secondary">Abbrechen/Neu</button>
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

    // NEU: Modal-Grundgerüst für Straßenstatistiken hinzufügen (initial versteckt)
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'streetStatsModalOverlay';
    modalOverlay.className = 'modal-overlay';
    modalOverlay.onclick = (event) => { // Schließen bei Klick auf Overlay
        if (event.target === modalOverlay) {
            hideStreetStatsModal();
        }
    };

    const modalContent = document.createElement('div');
    modalContent.id = 'streetStatsModalContent';
    modalContent.className = 'modal-content';
    modalContent.innerHTML = `
        <button id="streetStatsModalCloseButton" class="modal-close-button">&times;</button>
        <h4 id="streetStatsModalTitle" style="margin-top:0; margin-bottom: 20px; text-align:center;">Straßenauswertung</h4>
        <div id="streetStatsModalBody">
            <p>Lade Daten...</p>
        </div>
    `;
    modalOverlay.appendChild(modalContent);
    streetDetailContainer.appendChild(modalOverlay);

    const modalCloseButton = modalContent.querySelector('#streetStatsModalCloseButton');
    if (modalCloseButton) {
        modalCloseButton.onclick = hideStreetStatsModal;
    }
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

        // NEU: Fortschritt der Straße neu berechnen und speichern // ENTFERNT
        // if (currentSelectedStreetId && currentSelectedStreetName && currentSelectedPostalCode) { // ENTFERNT
        //     await calculateAndUpdateStreetProgress(currentSelectedStreetId, currentSelectedStreetName, currentSelectedPostalCode); // ENTFERNT
        // } // ENTFERNT

    } catch (error) {
        console.error("Fehler beim Speichern/Aktualisieren:", error);
        if (isInvalidRefreshTokenError(error)) {
            showErrorNotification("Ihre Sitzung ist abgelaufen. Bitte laden Sie die Seite neu, um fortzufahren.");
            // Optional: Weitere Aktionen, z.B. showLogin(), aber das Neuladen ist oft ausreichend.
        } else {
            showError(`Fehler beim Speichern: ${error.message}`);
        }
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
        // 1. Eintrag abrufen, um den Ersteller zu überprüfen
        const { data: entry, error: fetchError } = await supabaseClient
            .from('house_entries')
            .select('creator_id') // Stellt sicher, dass die Spalte für den Ersteller 'creator_id' heißt
            .eq('id', entryId)
            .single();

        if (fetchError) {
            console.error("Fehler beim Abrufen des Eintrags vor dem Löschen:", fetchError);
            throw fetchError; // Wird vom catch-Block behandelt
        }

        if (!entry) {
            // console.warn(`Eintrag mit ID ${entryId} zum Löschen nicht gefunden.`);
            showErrorNotification(`Eintrag mit ID ${entryId} zum Löschen nicht gefunden.`);
            throw new Error("Eintrag nicht gefunden oder bereits gelöscht."); // Wird vom catch-Block behandelt
        }

        // Überprüfe, ob der aktuelle Benutzer der Ersteller ist
        // Die Spalte `creator_id` muss beim Erstellen des Eintrags korrekt gesetzt werden.
        if (entry.creator_id !== currentUser.id) {
            showErrorNotification("Löschen fehlgeschlagen: Sie können nur Ihre eigenen Einträge löschen.");
            loadingIndicator.style.display = 'none'; // Ladeanzeige ausblenden
            return; // Frühzeitiger Ausstieg, da keine Berechtigung
        }

        // 2. Wenn der User der Ersteller ist, dann löschen
        const { error: deleteError } = await supabaseClient
            .from('house_entries')
            .delete()
            .eq('id', entryId);
            // Die Klausel .eq('creator_id', currentUser.id) ist hier nicht mehr zwingend,
            // da wir dies bereits clientseitig geprüft haben und die RLS-Policy serverseitig greifen sollte.

        if (deleteError) {
            console.error("Supabase Fehler beim Löschen:", deleteError);
            throw deleteError; // Wird vom catch-Block behandelt
        }

        console.log(`Eintrag ${entryId} gelöscht.`);
        await loadHouseEntries(currentSelectedStreetId);
        sortAndDisplayHouseEntries(); // Statt displayHouseEntries direkt aufzurufen

        // NEU: Fortschritt der Straße neu berechnen und speichern // ENTFERNT
        // if (currentSelectedStreetId && currentSelectedStreetName && currentSelectedPostalCode) { // ENTFERNT
        //     await calculateAndUpdateStreetProgress(currentSelectedStreetId, currentSelectedStreetName, currentSelectedPostalCode); // ENTFERNT
        // } // ENTFERNT

    } catch (error) {
        console.error("Fehler im Löschprozess für Eintrag:", entryId, error);
        // Der spezielle Fall "nicht der Ersteller" wird oben direkt mit return und eigener Meldung behandelt.
        // Alle anderen Fehler (fetch, !entry, deleteError, calculateAndUpdateStreetProgress) landen hier.
        showErrorNotification(`Fehler beim Löschen: ${error.message}`);
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


async function backToStreetList() {
    // Echten Detail-Inhalt und Skeleton ausblenden
    if (streetDetailContainer) {
        streetDetailContainer.style.display = 'none';
        streetDetailContainer.innerHTML = '';
    }
    if (streetDetailSkeleton) streetDetailSkeleton.style.display = 'none';
    
    removeFromLocalStorage(LS_ACTIVE_STREET_DETAIL_KEY); 

    if (lastOpenedStreetElementContainer && lastOpenedStreetElementContainer.parentNode) {
        lastOpenedStreetElementContainer.parentNode.removeChild(lastOpenedStreetElementContainer);
        lastOpenedStreetElementContainer = null;
    }

    isAlphabetFilterExpanded = false; 
    if (alphabetFilterContainer) {
        alphabetFilterContainer.classList.remove('expanded');
        alphabetFilterContainer.style.display = 'none'; 
        alphabetFilterContainer.innerHTML = '';
    }
    currentAlphabetFilter = null;

    const cachedStreetData = getFromLocalStorage(LS_STREET_CACHE_KEY);
    const currentPlz = plzInput.value.trim();

    if (cachedStreetData && cachedStreetData.lastPlz === currentPlz && cachedStreetData.streets && cachedStreetData.streets.length > 0) {
        console.log("Restoring street list from cache for PLZ:", currentPlz);
        if (streetListPlaceholder) streetListPlaceholder.style.display = 'none';
        if (streetListContainer) streetListContainer.innerHTML = ''; 
        // ENTFERNT: await fetchAllStreetProgressDataFromDB(); 
        // displayStreets verwendet jetzt die globale streetProgressData Map.
        displayStreets(cachedStreetData.streets, currentPlz); 
        if(alphabetFilterContainer && cachedStreetData.streets.length > 0) { 
            alphabetFilterContainer.style.display = 'flex';
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
    if (currentViewTitleElement) currentViewTitleElement.textContent = 'SellX Solutions';
    if (headerControls) headerControls.style.display = 'flex';

    currentSelectedStreetId = null;
    currentSelectedStreetName = null; // NEU
    currentSelectedPostalCode = null; // NEU
    currentHouseEntries = [];
    currentEditingEntryId = null;
    clearError();
}

// --- NEU: View Switching Logik ---
window.switchView = function(viewIdToShow, viewTitle) {
    //console.log(`[switchView] Start: Wechsle zu ${viewIdToShow} (${viewTitle})`);

    // 1. Alle Views ausblenden (explizit über style.display)
    views.forEach(view => {
        if (view.style.display !== 'none' && view.id !== viewIdToShow) { // Nur loggen, wenn es tatsächlich ausgeblendet wird
            //console.log(`[switchView] Blende aus: ${view.id}`);
        }
        view.style.display = 'none'; // Explizit ausblenden
        view.classList.remove('active-view'); // Auch Klasse entfernen
    });

    // NEU: Alle Skeletons initial ausblenden, um den Zustand zurückzusetzen
    if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden');
    if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.add('hidden');
    if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden');
    if (calendarViewSkeleton) calendarViewSkeleton.classList.add('hidden');
    if (adminViewSkeleton) adminViewSkeleton.classList.add('hidden'); // NEU
    if (workTimeEvalViewSkeleton) workTimeEvalViewSkeleton.classList.add('hidden'); // NEU


    // 2. Die ausgewählte View anzeigen (explizit über style.display)
    const viewToShow = document.getElementById(viewIdToShow);
    if (viewToShow) {
        //console.log(`[switchView] Zeige an: ${viewToShow.id}`);
        // Wähle den korrekten Display-Typ basierend auf der View
        if (viewIdToShow === 'mainView') {
            viewToShow.style.display = 'flex'; // mainView ist ein Flex-Container
        } else {
            viewToShow.style.display = 'block'; // Andere Views sind normale Block-Elemente
        }
        viewToShow.classList.add('active-view'); // Klasse hinzufügen
    } else {
        //console.error(`[switchView] FEHLER: View mit ID "${viewIdToShow}" nicht gefunden!`);
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
            //console.log("[switchView] Lade Daten für Statistik");
            if (statsViewSkeleton) statsViewSkeleton.classList.remove('hidden');
            if (statsContent) statsContent.style.display = 'none';
            loadStatsData();
            break;
        case 'leaderboardView':
             //console.log("[switchView] Lade Daten für Leaderboard");
             if (leaderboardViewSkeleton) leaderboardViewSkeleton.classList.remove('hidden');
             if (leaderboardContent) leaderboardContent.style.display = 'none';
             loadLeaderboardData();
            break;
        case 'settingsView':
             //console.log("[switchView] Lade Daten für Einstellungen");
             if (settingsViewSkeleton) settingsViewSkeleton.classList.remove('hidden');
             if (settingsContent) settingsContent.style.display = 'none';
             loadSettingsData();
            break;
        case 'calendarView': // NEUER CASE
            //console.log("[switchView] Lade Daten für Kalender");
            if (calendarViewSkeleton) calendarViewSkeleton.classList.remove('hidden');
            
            // Elemente direkt referenzieren und ausblenden, BEVOR loadCalendarData aufgerufen wird
            const ttControls = document.getElementById('timeTrackingControls');
            const ttHistory = document.getElementById('timeTrackingHistory');
            if (ttControls) ttControls.style.display = 'none';
            if (ttHistory) ttHistory.style.display = 'none';
            
            loadCalendarData();
            break;
        case 'adminView': // NEUER CASE
            console.log("[switchView] Lade Daten für Admin-Bereich");
            if (adminViewSkeleton) adminViewSkeleton.classList.remove('hidden');
            if (adminContent) adminContent.style.display = 'none';
            loadAdminData();
            break;
        case 'workTimeEvaluationView': // NEUER CASE
            console.log("[switchView] Lade Daten für Arbeitszeitauswertung");
            if (workTimeEvalViewSkeleton) workTimeEvalViewSkeleton.classList.remove('hidden');
            if (userEvalList) userEvalList.innerHTML = '<div class="skeleton-list-item" style="margin-bottom: 8px;"></div><div class="skeleton-list-item" style="margin-bottom: 8px;"></div><div class="skeleton-list-item" style="margin-bottom: 8px;"></div>'; // Skeleton anzeigen
            if (userDetailEvalContainer) userDetailEvalContainer.style.display = 'none'; // Detailansicht initial ausblenden
            if (userListForEvalContainer) userListForEvalContainer.style.display = 'block'; // Sicherstellen, dass Mitarbeiterliste angezeigt wird
            loadWorkTimeEvaluationData();
            break;
        case 'mainView':
             //console.log("[switchView] Aktiviere Hauptansicht");
             updateGreetingPlaceholder(); // NEU: Platzhalter-Begrüßung aktualisieren
             if (streetDetailContainer.style.display !== 'none') { backToStreetList(); }
            break;
        case 'mapView':
            console.log("[switchView] Initialisiere Kartenansicht");
            if (mapViewLoadingIndicator) mapViewLoadingIndicator.style.display = 'flex'; // Ladeindikator anzeigen

            // Sicherstellen, dass der Container sichtbar ist und Dimensionen hat, bevor initMap aufgerufen wird.
            // Dies geschieht durch das Aktivieren der View. Manchmal braucht Leaflet eine kleine Verzögerung.
            setTimeout(() => {
                if (typeof initMap === 'function') {
                    initMap(); // Diese Funktion kommt aus map.js
                } else {
                    console.error("initMap Funktion nicht gefunden. map.js geladen und korrekt initialisiert?");
                    if (typeof showErrorNotification === 'function') showErrorNotification("Kartenfunktion konnte nicht initialisiert werden.");
                    if (mapViewLoadingIndicator) mapViewLoadingIndicator.style.display = 'none';
                }
            }, 50); // Kleine Verzögerung, um sicherzustellen, dass das DOM bereit ist
            break;
    }

     // Scrollt die neue Ansicht nach oben (unverändert)
     viewContainer.scrollTop = 0;
     //console.log(`[switchView] Ende: ${viewIdToShow} ist jetzt aktiv.`);
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
    //console.log("[setupInputFocusListeners] Adding listeners for nav hiding and Enter key.");

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
    //console.log('Input focus, hiding nav');
    document.body.classList.add('nav-hidden');
}

function handleInputBlur() {
    // Kleine Verzögerung, um Klicks auf die Nav zu ermöglichen
    setTimeout(() => {
         //console.log('Input blur, showing nav');
         document.body.classList.remove('nav-hidden');
    }, 150); // Leicht erhöhte Verzögerung
}
// === ENDE NEU ===

// Fügt Enter-Key Listener für Elemente *innerhalb* der App hinzu
function setupAppEnterKeyListeners() {
     //console.log("[setupAppEnterKeyListeners] Adding Enter key listeners.");
     // -- PLZ Suche --
     if (plzInput && !plzInput.hasEnterListener) {
          //console.log(" -> Adding PLZ Enter listener.");
         plzInput.addEventListener('keydown', handlePlzEnter);
         plzInput.hasEnterListener = true;
     }
     // -- Einstellungen (Anzeigename) --
      if (displayNameInput && !displayNameInput.hasEnterListener) {
          //console.log(" -> Adding Settings Enter listener.");
         displayNameInput.addEventListener('keydown', handleSettingsEnter);
         displayNameInput.hasEnterListener = true;
      }
}

// Handler-Funktionen für Enter (unverändert)
function handlePlzEnter(event) {
    if (event.key === 'Enter') {
        //console.log("Enter detected in PLZ Input"); // DEBUG
        event.preventDefault();
        searchStreets(); // Straßen suchen
    }
}

function handleSettingsEnter(event) {
     if (event.key === 'Enter') {
         //console.log("Enter detected in Display Name Input"); // DEBUG
         event.preventDefault();
         saveSettings(); // Einstellungen speichern
     }
}

// === NEUE FUNKTIONEN FÜR ALPHABET FILTER ===

// Rendert die Alphabet-Buttons und den Toggle
function renderAlphabetFilter() {
    if (!alphabetFilterContainer) {
        showErrorNotification("alphabetFilterContainer ist nicht initialisiert!");
        return;
    }
    alphabetFilterContainer.innerHTML = ''; // Immer leeren vor Neubau

    // Styling für den Container
    alphabetFilterContainer.style.backgroundColor = 'var(--card-bg, #f8f9fa)'; // Hintergrundfarbe wie Listenelemente
    alphabetFilterContainer.style.borderRadius = '8px'; // Abgerundete Ecken
    alphabetFilterContainer.style.marginBottom = '10px'; // Abstand nach unten

    // Toggle-Button (Haupt-Umschalter)
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
        updateAlphabetFilterActiveState(); // Stellt sicher, dass Label und aktive Klassen korrekt sind
    };
    alphabetFilterContainer.appendChild(toggleButton);

    // Wrapper für die Buchstaben A-Z und den neuen "Alle"-Button
    const lettersWrapper = document.createElement('div');
    lettersWrapper.id = 'alphabetLettersWrapper';
    alphabetFilterContainer.appendChild(lettersWrapper);

    // NEU: "Alle"-Button im Wrapper erstellen und hinzufügen
    const allButtonInWrapper = document.createElement('button');
    allButtonInWrapper.textContent = 'Alle';
    allButtonInWrapper.className = 'alphabet-button'; // Gleiches Styling wie Buchstaben
    allButtonInWrapper.dataset.letter = 'Alle'; // Wichtig für updateAlphabetFilterActiveState
    allButtonInWrapper.type = 'button';
    allButtonInWrapper.onclick = () => {
        filterStreetsByLetter('Alle');
        isAlphabetFilterExpanded = false; // Filter zuklappen nach Auswahl
        alphabetFilterContainer.classList.remove('expanded');
        updateToggleArrowIcon();
        // updateAlphabetFilterActiveState() wird bereits von filterStreetsByLetter aufgerufen
    };
    lettersWrapper.appendChild(allButtonInWrapper); // "Alle" zuerst einfügen

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

        item.style.display = show ? 'flex' : 'none'; // KORREKTUR: 'flex' statt 'block'
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
        // Setzt das Label des Haupt-Toggle-Buttons
        if (currentAlphabetFilter && currentAlphabetFilter !== 'Alle') {
            toggleLabel.textContent = currentAlphabetFilter;
            toggleButton.classList.remove('active'); // Haupt-Toggle ist nicht "Alle"
        } else {
            toggleLabel.textContent = 'Alle';
            toggleButton.classList.add('active'); // Haupt-Toggle ist "Alle"
        }
    }

    const lettersWrapper = document.getElementById('alphabetLettersWrapper');
    if (lettersWrapper) {
        const letterButtons = lettersWrapper.querySelectorAll('.alphabet-button'); // Inklusive des neuen "Alle"-Buttons
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
    const adminButtonContainer = document.getElementById('adminButtonContainerStats');
    if (adminButtonContainer) {
        adminButtonContainer.style.display = 'none'; // Initial ausblenden
    }

    // UI für Filter-Buttons aktualisieren (falls sie schon im DOM sind)
    const filterButtons = document.querySelectorAll('#statsFilterControls .filter-button');
    filterButtons.forEach(button => {
        if (button.dataset.filter === currentStatsFilter) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });


    try {
        let query = supabaseClient
            .from('house_entries')
            .select('status, creator_id, last_visit_date') // last_visit_date für Filterung verwenden
            .eq('creator_id', currentUser.id);

        const now = new Date();
        let startDate, endDate;

        // Setze Start- und Enddatum basierend auf dem Filter
        // Wichtig: .toISOString() konvertiert in UTC, was Supabase erwartet.
        switch (currentStatsFilter) {
            case 'thisYear':
                startDate = new Date(now.getFullYear(), 0, 1); // 1. Januar dieses Jahres, 00:00:00 lokale Zeit
                endDate = new Date(now.getFullYear() + 1, 0, 1); // 1. Januar nächstes Jahres, 00:00:00 lokale Zeit
                query = query.gte('last_visit_date', startDate.toISOString()).lt('last_visit_date', endDate.toISOString());
                break;
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Erster Tag dieses Monats, 00:00:00
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Erster Tag nächsten Monats, 00:00:00
                query = query.gte('last_visit_date', startDate.toISOString()).lt('last_visit_date', endDate.toISOString());
                break;
            case 'thisWeek':
                const currentDay = now.getDay(); // Sonntag = 0, Montag = 1, ..., Samstag = 6
                const diffToMonday = (currentDay === 0) ? -6 : (1 - currentDay); // Tage bis zum letzten Montag
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
                startDate.setHours(0, 0, 0, 0); // Montag dieser Woche, 00:00:00

                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 7); // Montag nächster Woche, 00:00:00
                query = query.gte('last_visit_date', startDate.toISOString()).lt('last_visit_date', endDate.toISOString());
                break;
            case 'today':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                startDate.setHours(0,0,0,0); // Heute, 00:00:00 lokale Zeit

                endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 1); // Morgen, 00:00:00 lokale Zeit
                query = query.gte('last_visit_date', startDate.toISOString()).lt('last_visit_date', endDate.toISOString());
                break;
            case 'allTime':
            default:
                // Keine zusätzlichen Zeitfilter für 'allTime'
                break;
        }

        const { data: entries, error } = await query;

        if (error) throw error;

        // Statistiken berechnen (nur für die Einträge dieses Users im gefilterten Zeitraum)
        const totalEntries = entries.length;
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
                 if (status !== 'null') {
                    statusCounts['Andere']++;
                 } else {
                    statusCounts['null']++;
                 }
            }
        });

        displayStatsData(totalEntries, statusCounts);
        renderStatusChart(statusCounts);

        if (statsContent) statsContent.style.display = 'block';
        if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden');
        if (adminButtonContainer && ADMIN_USER_IDS.includes(currentUser.id)) {
            adminButtonContainer.style.display = 'block';
            console.log("Admin-Benutzer in StatsView erkannt, Admin-Button wird angezeigt.");
        } else if (adminButtonContainer) {
            adminButtonContainer.style.display = 'none';
             console.log("Kein Admin-Benutzer in StatsView, Admin-Button bleibt verborgen.");
        }

    } catch (error) {
        console.error("Fehler beim Laden der Statistiken:", error);
        if (statsErrorDisplay) {
            statsErrorDisplay.textContent = `Fehler beim Laden der Statistiken: ${error.message}`;
            statsErrorDisplay.style.display = 'block';
        }
        if (statsViewSkeleton) statsViewSkeleton.classList.add('hidden');
        if (statsContent) statsContent.style.display = 'none';
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
    if (settingsStatus) settingsStatus.textContent = '';
    if (settingsStatus) settingsStatus.className = '';
    // {{ Entferne diese Zeile, falls noch vorhanden (sollte schon weg sein durch vorherigen Schritt): }}
    // if (adminSettingsButton) adminSettingsButton.style.display = 'none'; 

    try {
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Benutzerdaten konnten nicht geladen werden.");

        const currentDisplayName = user.user_metadata?.display_name || '';
        if (displayNameInput) displayNameInput.value = currentDisplayName;

        // --- E-Mail-Adresse anzeigen ---
        // Das userEmailDisplay Element ist jetzt das innere <span> für die E-Mail
        const userEmailDisplayElement = document.getElementById('userEmailDisplay');
        if (userEmailDisplayElement && user && user.email) {
            userEmailDisplayElement.textContent = user.email;
        }
        // --- ENDE E-Mail-Adresse anzeigen ---


        // --- Farbschema-Auswahl initialisieren ---
        // Das HTML-Element wird jetzt direkt aus index.html erwartet
        colorSchemeSelect = document.getElementById('colorSchemeSelect'); // colorSchemeSelect wird hier initialisiert
        const initialColorSchemeForSelect = getFromLocalStorage(LS_COLOR_SCHEME_KEY) || 'system';

        if (colorSchemeSelect) {
            colorSchemeSelect.value = initialColorSchemeForSelect;
            // Event-Listener nur einmalig hinzufügen, falls er noch nicht existiert
            if (!colorSchemeSelect.hasAttribute('data-listener-added')) {
                colorSchemeSelect.addEventListener('change', (event) => {
                    applyColorScheme(event.target.value); // applyColorScheme ist jetzt definiert
                });
                colorSchemeSelect.setAttribute('data-listener-added', 'true');
            }
        } else {
            // console.warn("Farbschema Select-Element (colorSchemeSelect) nicht im DOM gefunden.");
            showErrorNotification("Farbschema Select-Element (colorSchemeSelect) nicht im DOM gefunden.");
        }
        // --- ENDE Farbschema-Auswahl ---


            if (settingsContent) settingsContent.style.display = 'block';
            if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden');

    } catch (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
        if (settingsErrorDisplay) {
            settingsErrorDisplay.textContent = `Fehler beim Laden der Einstellungen: ${error.message}`;
            settingsErrorDisplay.style.display = 'block';
        }
        if (settingsViewSkeleton) settingsViewSkeleton.classList.add('hidden');
        if (settingsContent) settingsContent.style.display = 'none';
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
            // console.warn(`Konnte CSS-Variable ${cssVar} nicht lesen, verwende Fallback ${fallbackColor}`, e);
            showErrorNotification(`Konnte CSS-Variable ${cssVar} nicht lesen, verwende Fallback ${fallbackColor}: ` + (e.message || e.toString()));
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
                    display: false, // LEGENDE AUSBLENDEN
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
    loadAndApplyInitialColorScheme(); // loadAndApplyInitialColorScheme ist jetzt definiert

    // Overlay ist initial sichtbar.
    // Die checkSession-Funktion kümmert sich um das Ausblenden.
    setupLoginEnterListeners();

    if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
        //console.log("ChartDataLabels Plugin registriert.");
    } else {
        // console.warn('Chart oder ChartDataLabels Plugin nicht gefunden. Stelle sicher, dass es korrekt eingebunden ist.');
        showErrorNotification('Chart oder ChartDataLabels Plugin nicht gefunden. Stelle sicher, dass es korrekt eingebunden ist.');
    }

    checkSession(); // Startet die Session-Prüfung

    // NEU: Sicherstellen, dass der Filter-Button-Status beim ersten Laden korrekt ist
    // Dies ist relevant, falls die App direkt in der Stats-Ansicht startet (weniger wahrscheinlich)
    // oder falls die Filter-Controls erst später hinzugefügt werden.
    // Der Aufruf in loadStatsData() sollte aber ausreichen.
    const initialFilterButtons = document.querySelectorAll('#statsFilterControls .filter-button');
    if (initialFilterButtons.length > 0) { // Nur ausführen, wenn die Buttons schon da sind
        initialFilterButtons.forEach(button => {
            if (button.dataset.filter === currentStatsFilter) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
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

// NEU: Funktion zum Setzen des Statistik-Filters und Neuladen der Daten
window.setStatsFilter = function(filterValue) {
    if (!['allTime', 'thisYear', 'thisMonth', 'thisWeek', 'today'].includes(filterValue)) {
        console.warn("Ungültiger Filterwert:", filterValue);
        return;
    }
    currentStatsFilter = filterValue;

    // Aktiven Button hervorheben
    const filterButtons = document.querySelectorAll('#statsFilterControls .filter-button');
    filterButtons.forEach(button => {
        if (button.dataset.filter === filterValue) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    // Daten neu laden mit dem ausgewählten Filter
    // Stelle sicher, dass Skeleton angezeigt und alter Inhalt versteckt wird, falls nötig
    if (document.getElementById('statsView').classList.contains('active-view')) {
        if (statsViewSkeleton) statsViewSkeleton.classList.remove('hidden');
        if (statsContent) statsContent.style.display = 'none';
        if (statsErrorDisplay) statsErrorDisplay.style.display = 'none'; // Alte Fehler ausblenden
        if (statsChartInstance) { // Altes Chart zerstören, um Neuzeichnen zu erzwingen
            statsChartInstance.destroy();
            statsChartInstance = null;
        }
        loadStatsData();
    }
}

// NEUE Platzhalter-Funktion für Kalenderdaten
async function loadCalendarData() {
    if (!currentUser || !calendarView ) return;
    console.log("[loadCalendarData] Initializing Calendar View for Time Tracking.");

    // DOM Elemente initialisieren (einmalig oder bei Bedarf neu)
    initializeCalendarViewDOMElements(); // Globale Variablen timeTrackingControls etc. werden hier gesetzt

    // Skeleton wird von switchView angezeigt. 
    // Inhalt (timeTrackingControls, timeTrackingHistory) wird von switchView initial ausgeblendet.
    if (calendarErrorDisplay) calendarErrorDisplay.style.display = 'none';


    try {
        // Heutiges Datum für den Kalender-Input setzen
        if (historyDateInput) {
            if (!historyDateInput.value) { // Nur setzen, wenn leer, um manuelle Auswahl nicht zu überschreiben
                historyDateInput.valueAsDate = new Date();
            }
            historyDateInput.removeEventListener('change', handleHistoryDateChange); // Listener entfernen, falls schon vorhanden
            historyDateInput.addEventListener('change', handleHistoryDateChange);
        }
        
        await checkActiveWorkEntry(); // Prüfen, ob ein Eintrag aktiv ist und UI/Timer aktualisiert
        await loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date())); // Historie für ausgewähltes Datum laden
        await updateTodaySummary(); // NEU: Sicherstellen, dass die "Heute"-Zusammenfassung aktuell ist

        // --- NEU: Export-Funktionalität initialisieren ---
        setupWorkTimeExportUI();
        // --- ENDE NEU ---

        // Inhalt anzeigen, NACHDEM Daten geladen wurden
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
        // Sicherstellen, dass Inhalt ausgeblendet bleibt (wurde schon von switchView gemacht)
        if (timeTrackingControls) timeTrackingControls.style.display = 'none';
        if (timeTrackingHistory) timeTrackingHistory.style.display = 'none';
    } finally {
        // Nichts mehr hier bzgl. globalem Ladeindikator
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

    // NEU: DOM-Elemente für den Arbeitszeit-Export
    workTimeExportContainer = document.getElementById('workTimeExportContainer');
    workTimeExportMonthSelect = document.getElementById('workTimeExportMonthSelect');
    exportSelectedMonthButton = document.getElementById('exportSelectedMonthButton');
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
    } finally {
        await updateTodaySummary(); // NEU: "Heute"-Zusammenfassung immer aktualisieren
    }
}

window.startWorkTimeTracking = async function() {
    if (!currentUser || activeWorkEntryId) return; // Verhindere Doppelstart

    console.log("Starting work time tracking...");
    if (startWorkButton) startWorkButton.disabled = true;
    if (currentStatusText) currentStatusText.textContent = "Starte...";

    const newStartTime = new Date();
    let startLocationContent = null; // NEU: Variable für Start-Standort

    // Versuche, die Geolokation abzurufen
    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation wird nicht unterstützt."));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, 
                timeout: 10000,         
                maximumAge: 60000         
            });
        });

        const { latitude, longitude } = position.coords;
        startLocationContent = `https://www.google.com/maps?q=${latitude},${longitude}`; // NEU
        console.log("Start-Standort erfasst:", startLocationContent);

    } catch (geoError) {
        // console.warn("Fehler beim Abrufen des Start-Standorts:", geoError.message);
        showErrorNotification("Fehler beim Abrufen des Start-Standorts: " + geoError.message);
        // Fahre fort, auch wenn der Standort nicht ermittelt werden konnte.
        // startLocationContent bleibt null.
    }


    try {
        const { data, error } = await supabaseClient
            .from('work_time_entries')
            .insert({
                user_id: currentUser.id,
                start_time: newStartTime.toISOString(),
                start_location: startLocationContent // NEU: start_location statt notes
            })
            .select('id, start_time')
            .single();

        if (error) throw error;

        activeWorkEntryId = data.id;
        workStartTime = new Date(data.start_time); 
        updateWorkUIActive();
        await loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date())); 
        await updateTodaySummary(); 
    } catch (error) {
        console.error("Error starting work:", error);
        showCalendarError("Fehler beim Starten der Arbeitszeit.");
        updateWorkUIInactive(); 
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

    let endLocationContent = null; // NEU: Variable für End-Standort

    // Versuche, die Geolokation für den End-Standort abzurufen
    try {
        const position = await new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation wird nicht unterstützt."));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            });
        });
        const { latitude, longitude } = position.coords;
        endLocationContent = `https://www.google.com/maps?q=${latitude},${longitude}`; // NEU
        console.log("End-Standort erfasst:", endLocationContent);
    } catch (geoError) {
        // console.warn("Fehler beim Abrufen des End-Standorts:", geoError.message);
        showErrorNotification("Fehler beim Abrufen des End-Standorts: " + geoError.message);
        // Fahre fort, auch wenn der Standort nicht ermittelt werden konnte.
        // endLocationContent bleibt null.
    }

    try {
        const { error } = await supabaseClient
            .from('work_time_entries')
            .update({
                end_time: newEndTime.toISOString(),
                duration_minutes: durationMinutes,
                end_location: endLocationContent // NEU: end_location hinzufügen
            })
            .eq('id', activeWorkEntryId);

        if (error) throw error;

        activeWorkEntryId = null;
        workStartTime = null;
        updateWorkUIInactive();
        if (currentWorkDuration) currentWorkDuration.textContent = "00:00:00"; 
        await loadDailySummaryAndEntries(historyDateInput ? historyDateInput.value : getLocalDateString(new Date())); 
        await updateTodaySummary(); 
    } catch (error) {
        console.error("Error stopping work:", error);
        showCalendarError("Fehler beim Stoppen der Arbeitszeit.");
        updateWorkUIActive(); 
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
        // console.warn("loadDailySummaryAndEntries: Required DOM elements or user not found.");
        showErrorNotification("loadDailySummaryAndEntries: Required DOM elements or user not found.");
        return;
    }
    
    console.log(`Loading entries for date: ${dateString}`);
    if (calendarLoadingIndicator) calendarLoadingIndicator.style.display = 'flex';
    timeEntriesList.innerHTML = '';
    noHistoryEntriesMessage.style.display = 'none';
    if (summaryDateDisplay) summaryDateDisplay.textContent = formatDateForDisplay(dateString);
    if (summaryTotalWork) summaryTotalWork.textContent = '--:--';
    
    const todayDateStringForComparison = getLocalDateString(new Date());
    if (dateString === todayDateStringForComparison) {
        if (todayTotalWork) todayTotalWork.textContent = '00:00'; 
    }


    try {
        const startDate = new Date(dateString + "T00:00:00");
        const endDate = new Date(dateString + "T23:59:59.999");

        const { data: entries, error } = await supabaseClient
            .from('work_time_entries')
            .select('id, start_time, end_time, duration_minutes, start_location, end_location') // NEU: start_location, end_location statt notes
            .eq('user_id', currentUser.id)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString()) 
            .order('start_time', { ascending: true });

        if (error) throw error;

        if (entries.length === 0) {
            noHistoryEntriesMessage.style.display = 'block';
        } else {
            let totalWorkMinutesForDay = 0;

            entries.forEach((entry, index) => {
                const li = document.createElement('li');
                li.className = 'time-entry-li';
                
                const startTimeFormatted = formatTime(new Date(entry.start_time));
                const endTimeFormatted = entry.end_time ? formatTime(new Date(entry.end_time)) : 'Laufend';
                const durationFormatted = entry.duration_minutes ? formatMinutesToHM(entry.duration_minutes) : '-';

                let startLocationDisplay = '';
                if (entry.start_location) {
                    const escapedLoc = escapeHtml(entry.start_location);
                    if (escapedLoc.startsWith('http')) {
                        startLocationDisplay = `<div class="time-entry-location">Start-Ort: <a href="${escapedLoc}" target="_blank" rel="noopener noreferrer" class="location-link">Karte anzeigen</a></div>`;
                    } else {
                        startLocationDisplay = `<div class="time-entry-location">Start-Ort: ${escapedLoc}</div>`;
                    }
                }

                let endLocationDisplay = '';
                if (entry.end_location) {
                    const escapedLoc = escapeHtml(entry.end_location);
                    if (escapedLoc.startsWith('http')) {
                        endLocationDisplay = `<div class="time-entry-location">End-Ort: <a href="${escapedLoc}" target="_blank" rel="noopener noreferrer" class="location-link">Karte anzeigen</a></div>`;
                    } else {
                        endLocationDisplay = `<div class="time-entry-location">End-Ort: ${escapedLoc}</div>`;
                    }
                }


                li.innerHTML = `
                    <div class="time-entry-main">
                        <div class="time-entry-details">
                            <strong>${startTimeFormatted} - ${endTimeFormatted}</strong>
                        </div>
                        <div class="time-entry-duration">Dauer: ${durationFormatted}</div>
                    </div>
                    ${startLocationDisplay}
                    ${endLocationDisplay}
                `;
                timeEntriesList.appendChild(li);

                if (entry.duration_minutes) {
                    totalWorkMinutesForDay += entry.duration_minutes;
                }
            });

            if (summaryTotalWork) summaryTotalWork.textContent = formatMinutesToHM(totalWorkMinutesForDay);
            
            const todayDateString = getLocalDateString(new Date());
            if (dateString === todayDateString) {
                if (todayTotalWork) todayTotalWork.textContent = formatMinutesToHM(totalWorkMinutesForDay);
            }
        }

    } catch (err) {
        console.error("Error loading daily entries:", err);
        showCalendarError("Fehler beim Laden der Tageshistorie.");
        noHistoryEntriesMessage.style.display = 'block'; 
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


document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        console.log("Seite ist jetzt im Hintergrund / nicht sichtbar.");
    } else if (document.visibilityState === 'visible') {
        console.log("Seite ist wieder sichtbar.");
        // Beim Sichtbarwerden den Status neu prüfen, falls die Kalender-View aktiv ist
        if (calendarView && calendarView.classList.contains('active-view')) {
            checkActiveWorkEntry().then(async () => { // Stellt sicher, dass checkActiveWorkEntry fertig ist
                 // Historie für das aktuell im Datepicker ausgewählte Datum neu laden.
                if (historyDateInput && historyDateInput.value) {
                    await loadDailySummaryAndEntries(historyDateInput.value);
                }
                // Und die "Heute"-Ansicht explizit aktualisieren
                await updateTodaySummary();
            });
        }
    }
});

// --- NEU: Globale Funktion für Fehler-Popups ---
function showErrorNotification(message) {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        // Fallback, falls der Container (noch) nicht da ist
        console.error("Fehler-Popup: " + message); // Logge es trotzdem
        return;
    }

    const toastId = 'toast-' + Date.now() + Math.random().toString(36).substr(2, 9); // Eindeutige ID
    const toast = document.createElement('div');
    toast.className = 'notification-toast';
    toast.id = toastId;

    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'error_outline'; // Passendes Fehlericon
    toast.appendChild(icon);

    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Füge neue Benachrichtigungen oben im Container ein
    if (container.firstChild) {
        container.insertBefore(toast, container.firstChild);
    } else {
        container.appendChild(toast);
    }

    // Nach der CSS-Animation (5s) das DOM-Element entfernen
    setTimeout(() => {
        const currentToast = document.getElementById(toastId);
        if (currentToast && currentToast.parentNode === container) {
            container.removeChild(currentToast);
        }
    }, 5000); // Muss mit der Dauer der CSS-Animation übereinstimmen
}
// --- ENDE: Globale Funktion für Fehler-Popups ---

// --- NEUE FUNKTIONEN für Straßenfortschritt ---
async function fetchAllStreetProgressDataFromDB() {
    streetProgressData.clear(); // Bestehende In-Memory-Daten löschen
    console.log("Lade Straßenfortschrittsdaten aus der DB (fetchAllStreetProgressDataFromDB)...");

    const { data: streetsFromDB, error: streetsError } = await supabaseClient
        .from('streets')
        .select('name, postal_code, percent_completed, id'); // ID wird für den Key und Join benötigt

    if (streetsError) {
        console.error("Error fetching streets table for progress:", streetsError);
        showErrorNotification("Fehler beim Laden der Straßenfortschrittsdaten: " + (streetsError.message || streetsError.toString()));
        return;
    }

    const { data: entries, error: entriesErrorData } = await supabaseClient
        .from('house_entries')
        .select('house_number, street_id'); // street_id für den Join

    if (entriesErrorData) {
        console.error("Error fetching house_entries for progress count:", entriesErrorData);
        showErrorNotification("Fehler beim Zählen der Einträge für Fortschritt: " + (entriesErrorData.message || entriesErrorData.toString()));
        return;
    }

    // Zuerst die `processedCount` pro `street_id` berechnen
    const processedCountsByStreetId = new Map();
    if (entries) {
        entries.forEach(entry => {
            if (entry.street_id && entry.house_number) {
                if (!processedCountsByStreetId.has(entry.street_id)) {
                    processedCountsByStreetId.set(entry.street_id, new Set());
                }
                // Hausnummer normalisieren für korrekte Zählung eindeutiger Nummern
                processedCountsByStreetId.get(entry.street_id).add(String(entry.house_number).trim().toLowerCase());
            }
        });
    }

    // Dann `streetProgressData` (die globale Map) füllen
    if (streetsFromDB) {
        streetsFromDB.forEach(street => {
            if (street.name && street.postal_code) {
                const streetKey = `${street.postal_code}-${street.name}`;
                const uniqueHouseNumbersForStreet = processedCountsByStreetId.get(street.id);
                const currentProcessedCount = uniqueHouseNumbersForStreet ? uniqueHouseNumbersForStreet.size : 0;

                streetProgressData.set(streetKey, {
                    processedCount: currentProcessedCount,
                    percentCompletedFromDB: street.percent_completed // Dieser Wert kann null sein
                });
            }
        });
    }
    console.log("Globale streetProgressData Map initialisiert mit DB-Daten:", streetProgressData);
    // Optional: Die gesamte streetProgressData Map jetzt in localStorage speichern für den nächsten Kaltstart.
    // saveToLocalStorage('globalStreetProgressCache', Array.from(streetProgressData.entries()));
}

async function fetchTotalHouseNumbersFromOverpass(streetName, postalCode) {
    const cacheKey = `${postalCode}-${streetName}`;
    const cached = totalHouseNumbersCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp < TOTAL_HN_CACHE_DURATION)) {
        console.log(`[Cache HIT] Gesamtzahl HN für ${streetName} (${postalCode}): ${cached.count}`);
        return cached.count;
    }
    console.log(`[Cache MISS] Lade Gesamtzahl HN für ${streetName} (${postalCode}) von Overpass...`);

    const overpassUrl = 'https://overpass-api.de/api/interpreter';
    const query = `
        [out:json][timeout:20];
        area["postal_code"="${postalCode}"]->.searchArea;
        (
          node(area.searchArea)["addr:street"~"^${streetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$",i]["addr:housenumber"];
          way(area.searchArea)["addr:street"~"^${streetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$",i]["addr:housenumber"];
          relation(area.searchArea)["addr:street"~"^${streetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$",i]["addr:housenumber"];
        );
        out count;
    `;

    try {
        const response = await fetch(overpassUrl, {
            method: 'POST',
            body: `data=${encodeURIComponent(query)}`
        });
        if (!response.ok) {
             let errorText = `Overpass API Fehler: ${response.status} ${response.statusText}`;
             if (response.status === 429 || response.status === 504) {
                 errorText = "Overpass API ist überlastet. Versuche es später erneut.";
             }
             throw new Error(errorText);
        }
        const data = await response.json();
        let totalCount = 0;
        if (data.elements && data.elements.length > 0) {
            const counts = data.elements[0].tags;
            totalCount = (parseInt(counts.nodes) || 0) +
                         (parseInt(counts.ways) || 0) +
                         (parseInt(counts.relations) || 0);
        }

        console.log(`Overpass Ergebnis für ${streetName} (${postalCode}): ${totalCount} Hausnummern.`);
        totalHouseNumbersCache.set(cacheKey, { count: totalCount, timestamp: Date.now() });
        return totalCount;
    } catch (error) {
        console.error(`Fehler beim Abrufen der Gesamtzahl der Hausnummern für ${streetName} (${postalCode}):`, error);
        return null; 
    }
}

function updateStreetProgressUI(indicatorElement, { processedCount, totalCount, directPercentage }) {
    if (!indicatorElement) return;

    const isSvgCircle = indicatorElement.querySelector('.progress-ring__circle');
    const isHorizontalBar = indicatorElement.classList.contains('horizontal-progress-container');

    let percentage = 0;
    // let displayProcessedCountOnly = false; // ENTFERNT

    // Logik zur Bestimmung des Prozentwerts
    if (directPercentage !== null && typeof directPercentage === 'number') {
        percentage = Math.min(Math.max(directPercentage, 0), 100);
    } else if (totalCount !== null && totalCount > 0 && typeof processedCount === 'number' && processedCount >= 0) {
        // Dieser Fall wird seltener relevant sein, da wir uns primär auf directPercentage verlassen,
        // aber er bleibt als Fallback, falls directPercentage null ist, aber Overpass-Daten vorliegen.
        percentage = Math.min((processedCount / totalCount) * 100, 100);
    } else { // directPercentage ist null (und kein Fallback auf totalCount möglich) oder andere Daten fehlen
        percentage = 0; // Wird als 0% oder --% angezeigt
    }


    if (isSvgCircle) {
        const circle = indicatorElement.querySelector('.progress-ring__circle');
        const percentageSpan = indicatorElement.querySelector('.progress-percentage');
        const backgroundCircle = indicatorElement.querySelector('.progress-ring__background');

        if (!circle || !percentageSpan || !backgroundCircle) return;

        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        backgroundCircle.style.strokeDasharray = `${circumference} ${circumference}`; // Hintergrund immer voll
        backgroundCircle.style.strokeDashoffset = 0;

        if (directPercentage === null) { // Wenn DB-Wert null ist, immer --% anzeigen (oder 0% falls percentage = 0)
            percentageSpan.textContent = (processedCount > 0 && percentage === 0) ? '0%' : (percentage === 0 ? '--%' : `${Math.round(percentage)}%`);
            if (percentage === 0 && processedCount === 0) percentageSpan.textContent = '--%'; // Explizit --% wenn keine Daten

            circle.style.strokeDashoffset = circumference; // Leerer Kreis für --%
            circle.style.stroke = 'var(--text-color-muted)';
            percentageSpan.style.color = 'var(--text-color-muted)';
            // Wenn es trotz null directPercentage einen berechneten Prozentwert > 0 gibt (durch Fallback auf totalCount)
            // dann den Kreis entsprechend füllen.
            if (percentage > 0) {
                 const offset = circumference - (percentage / 100) * circumference;
                 circle.style.strokeDashoffset = offset;
                 // Farbverlauf für > 0 %
                const greenComponent = Math.round(50 + (percentage * 1.5));
                const redComponent = Math.round(150 - (percentage * 1.0));
                const r = Math.max(0, Math.min(255, redComponent));
                const g = Math.max(0, Math.min(255, greenComponent));
                const b = 50;
                circle.style.stroke = `rgb(${r}, ${g}, ${b})`;
                percentageSpan.style.color = `rgb(${r}, ${g}, ${b})`;
            }

        } else { // directPercentage ist eine Zahl
            percentageSpan.textContent = `${Math.round(percentage)}%`;
            const offset = circumference - (percentage / 100) * circumference;
            circle.style.strokeDashoffset = offset;

            if (percentage >= 100) {
                circle.style.stroke = 'var(--success-color)';
                percentageSpan.style.color = 'var(--success-color)';
            } else if (percentage > 0) {
                const greenComponent = Math.round(50 + (percentage * 1.5));
                const redComponent = Math.round(150 - (percentage * 1.0));
                const r = Math.max(0, Math.min(255, redComponent));
                const g = Math.max(0, Math.min(255, greenComponent));
                const b = 50;
                circle.style.stroke = `rgb(${r}, ${g}, ${b})`;
                percentageSpan.style.color = `rgb(${r}, ${g}, ${b})`;
            } else { // percentage === 0
                circle.style.stroke = 'var(--text-color-muted)';
                percentageSpan.style.color = 'var(--text-color-muted)';
            }
        }
    } else if (isHorizontalBar) {
        const progressBarFill = indicatorElement.querySelector('.horizontal-progress-bar-fill');
        const percentageSpan = indicatorElement.querySelector('.horizontal-progress-percentage');

        if (!progressBarFill || !percentageSpan) return;

        if (directPercentage === null) { // Wenn DB-Wert null ist
            percentageSpan.textContent = (processedCount > 0 && percentage === 0) ? '0%' : (percentage === 0 ? '--%' : `${Math.round(percentage)}%`);
            if (percentage === 0 && processedCount === 0) percentageSpan.textContent = '--%';

            progressBarFill.style.width = `${percentage}%`; // Kann 0% sein oder ein berechneter Wert
            progressBarFill.style.backgroundColor = 'var(--text-color-muted)';
            percentageSpan.style.color = 'var(--text-color-muted)';

            if (percentage > 0) {
                // Farbverlauf für > 0 %
                const greenComponent = Math.round(50 + (percentage * 1.5));
                const redComponent = Math.round(150 - (percentage * 1.0));
                const r = Math.max(0, Math.min(255, redComponent));
                const g = Math.max(0, Math.min(255, greenComponent));
                const b = 50;
                progressBarFill.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                percentageSpan.style.color = `rgb(${r}, ${g}, ${b})`;
            }

        } else { // directPercentage ist eine Zahl
            percentageSpan.textContent = `${Math.round(percentage)}%`;
            progressBarFill.style.width = `${percentage}%`;

            if (percentage >= 100) {
                progressBarFill.style.backgroundColor = 'var(--success-color)';
                percentageSpan.style.color = 'var(--success-color)';
            } else if (percentage > 0) {
                const greenComponent = Math.round(50 + (percentage * 1.5));
                const redComponent = Math.round(150 - (percentage * 1.0));
                const r = Math.max(0, Math.min(255, redComponent));
                const g = Math.max(0, Math.min(255, greenComponent));
                const b = 50;
                progressBarFill.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
                percentageSpan.style.color = `rgb(${r}, ${g}, ${b})`;
            } else { // percentage === 0
                progressBarFill.style.backgroundColor = 'var(--text-color-muted)';
                percentageSpan.style.color = 'var(--text-color-muted)';
            }
        }
    }
}

async function fetchAndApplyTotalHouseNumbers(indicatorElement, streetName, postalCode, processedCount) {
    const totalCount = await fetchTotalHouseNumbersFromOverpass(streetName, postalCode);
    if (document.body.contains(indicatorElement)) {
        updateStreetProgressUI(indicatorElement, { processedCount: processedCount, totalCount: totalCount });
    }
}

// --- NEUE FUNKTION zum Berechnen und Speichern des Fortschritts ---
async function calculateAndUpdateStreetProgress(streetId, streetName, postalCode) {
    if (!streetId || !streetName || !postalCode) {
        // console.warn("calculateAndUpdateStreetProgress: Fehlende Argumente.");
        showErrorNotification("calculateAndUpdateStreetProgress: Fehlende Argumente.");
        return;
    }

    // Kurze Verzögerung, um sicherzustellen, dass alle DB-Operationen (save/delete entry) abgeschlossen sind,
    // bevor wir die Einträge neu zählen.
    await new Promise(resolve => setTimeout(resolve, 100));


    console.log(`Berechne und speichere Fortschritt für Straße ID ${streetId}: ${streetName}. Overpass API wird ggf. aufgerufen.`);

    try {
        const { data: entries, error: entriesError } = await supabaseClient
            .from('house_entries')
            .select('house_number', { count: 'exact' }) // {count: 'exact'} um unnötige Datenübertragung zu vermeiden
            .eq('street_id', streetId);

        if (entriesError) throw entriesError;

        const uniqueHouseNumbers = new Set();
        (entries || []).forEach(entry => {
            if (entry.house_number) {
                uniqueHouseNumbers.add(String(entry.house_number).trim().toLowerCase());
            }
        });
        const uniqueProcessedAddresses = uniqueHouseNumbers.size;

        const totalCountOverpass = await fetchTotalHouseNumbersFromOverpass(streetName, postalCode);

        let percentToStore = null; 

        if (totalCountOverpass !== null && totalCountOverpass > 0) {
            percentToStore = Math.round((uniqueProcessedAddresses / totalCountOverpass) * 100);
            percentToStore = Math.min(Math.max(percentToStore, 0), 100); 
        } else if (totalCountOverpass === 0 && uniqueProcessedAddresses > 0) {
            percentToStore = 100;
        }
        

        const { error: updateError } = await supabaseClient
            .from('streets')
            .update({ percent_completed: percentToStore })
            .eq('id', streetId);

        if (updateError) {
            console.error(`Fehler beim DB-Update von percent_completed für Street ID ${streetId}:`, updateError);
            showErrorNotification("Fehler beim Speichern des Straßenfortschritts.");
        } else {
            console.log(`percent_completed für Street ID ${streetId} (${streetName}) auf ${percentToStore} aktualisiert.`);
            const streetKey = `${postalCode}-${streetName}`;
            
            if (streetProgressData.has(streetKey)) {
                const currentData = streetProgressData.get(streetKey);
                currentData.percentCompletedFromDB = percentToStore;
                currentData.processedCount = uniqueProcessedAddresses; // Wichtig: auch processedCount aktualisieren
            } else {
                streetProgressData.set(streetKey, {
                    processedCount: uniqueProcessedAddresses,
                    percentCompletedFromDB: percentToStore
                });
            }
            
            if (document.getElementById('mainView').classList.contains('active-view') &&
                streetListContainer && streetListContainer.style.display !== 'none') {
                const items = streetListContainer.querySelectorAll('.street-item');
                items.forEach(item => {
                    const nameSpan = item.querySelector('.street-item-name');
                    if (nameSpan && nameSpan.textContent === streetName) {
                        const progressIndicator = item.querySelector('.street-item-progress');
                        if (progressIndicator) {
                            updateStreetProgressUI(progressIndicator, {
                                processedCount: uniqueProcessedAddresses,
                                totalCount: totalCountOverpass, 
                                directPercentage: percentToStore
                            });
                        }
                    }
                });
            }
        }
    } catch (error) {
        console.error(`Fehler in calculateAndUpdateStreetProgress für ${streetName} (ID: ${streetId}):`, error);
        showErrorNotification(`Fehler beim Aktualisieren des Fortschritts für ${streetName}.`);
    }
}


// In selectStreet, saveOrUpdateHouseEntry, deleteHouseEntry müssen wir nun
// calculateAndUpdateStreetProgress aufrufen.

async function showStreetStatsModal() {
    const modalOverlay = document.getElementById('streetStatsModalOverlay');
    const modalBody = document.getElementById('streetStatsModalBody');
    const modalTitle = document.getElementById('streetStatsModalTitle');

    if (!modalOverlay || !modalBody || !modalTitle) {
        console.error("Modal-Elemente nicht gefunden.");
        return;
    }

    if (!currentSelectedStreetName || !currentSelectedPostalCode) {
        showErrorNotification("Keine Straße ausgewählt, um Statistiken anzuzeigen.");
        return;
    }

    modalTitle.textContent = `Auswertung für: ${escapeHtml(currentSelectedStreetName)}`;
    modalBody.innerHTML = '<div class="loading-spinner-view" style="margin: 20px auto;"></div><p style="text-align:center;">Lade Daten...</p>';
    modalOverlay.style.display = 'flex';

    try {
        const processedEntriesCount = currentHouseEntries.length; 
        
        const uniqueHouseNumbersInCurrentStreet = new Set();
        currentHouseEntries.forEach(entry => {
            if (entry.house_number) {
                uniqueHouseNumbersInCurrentStreet.add(entry.house_number.trim().toLowerCase());
            }
        });
        const uniqueProcessedAddresses = uniqueHouseNumbersInCurrentStreet.size;
        
        const totalCountOverpass = await fetchTotalHouseNumbersFromOverpass(currentSelectedStreetName, currentSelectedPostalCode);
        
        let minHouseNumberString = null;
        let maxHouseNumberString = null;

        if (currentHouseEntries.length > 0) {
            const houseNumberStrings = currentHouseEntries.map(entry => entry.house_number.trim());
            if (houseNumberStrings.length > 0) {
                const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
                houseNumberStrings.sort(collator.compare);
                minHouseNumberString = houseNumberStrings[0];
                maxHouseNumberString = houseNumberStrings[houseNumberStrings.length - 1];
            }
        }

        let modalHtml = `
            <div class="modal-stats-item">
                <strong>Anzahl Einträge gesamt:</strong>
                <span>${processedEntriesCount}</span>
            </div>
            <div class="modal-stats-item">
                <strong>Eindeutig erfasste Adressen:</strong>
                <span>${uniqueProcessedAddresses}</span>
            </div>
            <div class="modal-stats-item">
                <strong>Hausnummern in Straße (ca. lt. OSM):</strong> 
                <span>${totalCountOverpass !== null ? totalCountOverpass : 'N/A'}</span>
            </div>
            <div class="modal-stats-item">
                <strong>Kleinste erfasste Hausnr.:</strong>
                <span>${minHouseNumberString !== null ? escapeHtml(minHouseNumberString) : '-'}</span>
            </div>
            <div class="modal-stats-item">
                <strong>Größte erfasste Hausnr.:</strong>
                <span>${maxHouseNumberString !== null ? escapeHtml(maxHouseNumberString) : '-'}</span>
            </div>
        `;

        let percentageForModalBar = null;
        if (totalCountOverpass !== null && totalCountOverpass > 0) {
            percentageForModalBar = Math.min((uniqueProcessedAddresses / totalCountOverpass) * 100, 100);
            modalHtml += `
                <div class="modal-stats-item" style="flex-direction: column; align-items: stretch; margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 15px;">
                    <strong style="margin-bottom: 10px; text-align: left;">Fortschritt (eindeutige Adressen):</strong>
                    <div class="horizontal-progress-container" id="modalHorizontalProgressContainer">
                        <div class="horizontal-progress-bar-background">
                            <div class="horizontal-progress-bar-fill"></div>
                        </div>
                        <span class="horizontal-progress-percentage">--%</span>
                    </div>
                </div>
            `;
        } else if (totalCountOverpass === 0 && uniqueProcessedAddresses > 0) {
            modalHtml += `
                <div class="modal-stats-item" style="flex-direction: column; align-items: stretch; margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 15px;">
                     <strong style="margin-bottom: 10px; text-align: left;">Bearbeitung:</strong>
                     <span>${uniqueProcessedAddresses} Adr. erfasst (OSM: 0)</span>
                </div>
            `;
        } else if (totalCountOverpass === null && uniqueProcessedAddresses > 0) { // Geändert: Zeige auch wenn OSM null ist, aber Adressen erfasst wurden
             modalHtml += `
                <div class="modal-stats-item" style="flex-direction: column; align-items: stretch; margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 15px;">
                     <strong style="margin-bottom: 10px; text-align: left;">Fortschritt:</strong>
                     <span>Gesamtzahl für Straße nicht verfügbar. ${uniqueProcessedAddresses} Adr. erfasst.</span>
                </div>
            `;
        } else if (totalCountOverpass === null && uniqueProcessedAddresses === 0) { // Fall: Keine OSM Daten, keine Einträge
             modalHtml += `
                <div class="modal-stats-item" style="flex-direction: column; align-items: stretch; margin-top: 15px; border-top: 1px solid var(--card-border); padding-top: 15px;">
                     <strong style="margin-bottom: 10px; text-align: left;">Fortschritt:</strong>
                     <span>Keine Daten verfügbar.</span>
                </div>
            `;
        }


        modalBody.innerHTML = modalHtml;

        if (percentageForModalBar !== null) {
            const modalProgressContainer = document.getElementById('modalHorizontalProgressContainer');
            if (modalProgressContainer) {
                updateStreetProgressUI(modalProgressContainer, { directPercentage: percentageForModalBar });
            }
        }

    } catch (error) {
        console.error("Fehler beim Laden der Modal-Statistiken:", error);
        modalBody.innerHTML = `<p style="color: var(--danger-color); text-align:center;">Fehler beim Laden der Daten: ${error.message}</p>`;
    }
}

function hideStreetStatsModal() {
    const modalOverlay = document.getElementById('streetStatsModalOverlay');
    if (modalOverlay) {
        modalOverlay.style.display = 'none';
    }
}
// --- ENDE Straßen-Statistik-Modal ---

// NEU: Admin User IDs
const ADMIN_USER_IDS = [
    'bf667651-4160-4316-96ed-17e1eec28af4',
    // Weitere Admin-User-IDs hier hinzufügen
    // Beispiel: '12345678-1234-1234-1234-123456789012',
    // Beispiel: 'abcdef12-3456-7890-abcd-ef1234567890'
]; // Array mit allen Admin-User-IDs

// --- NEU: Admin View Funktionen ---
async function loadAdminData() {
    if (!currentUser) return;

    // Prüfen, ob der User wirklich Admin ist (doppelte Sicherheit)
    if (!ADMIN_USER_IDS.includes(currentUser.id)) {
        showErrorNotification("Zugriff verweigert. Diese Ansicht ist nur für Admins.");
        switchView('mainView', 'SellX Solutions'); // Zurück zur Hauptansicht
        if (adminViewSkeleton) adminViewSkeleton.classList.add('hidden');
        if (adminContent) adminContent.style.display = 'none';
        return;
    }

    console.log("Lade Admin-Daten und -Optionen...");
    if (adminErrorDisplay) adminErrorDisplay.style.display = 'none';
    // adminLoadingIndicator nicht unbedingt nötig, da wir noch keine Daten laden

    try {
        // Hier könnten später spezifische Admin-Daten geladen werden.
        // Für den Moment zeigen wir nur den Inhalt an.

        // NEU: Setze den Titel für die Admin-Ansicht korrekt
        // Der Titel wird jetzt über switchView gesetzt, diese Zeile ist nicht mehr nötig bzw. sollte
        // im HTML der AdminView direkt den korrekten Titel haben oder über switchView gesetzt werden.
        // const adminViewTitleElement = document.querySelector('#adminView .view-header h3');
        // if (adminViewTitleElement) {
        //     adminViewTitleElement.textContent = 'Admin Bereich';
        // }


        if (adminContent) adminContent.style.display = 'block';
        if (adminViewSkeleton) adminViewSkeleton.classList.add('hidden');

    } catch (error) {
        console.error("Fehler beim Laden der Admin-Ansicht:", error);
        if (adminErrorDisplay) {
            adminErrorDisplay.textContent = `Fehler: ${error.message}`;
            adminErrorDisplay.style.display = 'block';
        }
        if (adminViewSkeleton) adminViewSkeleton.classList.add('hidden');
        if (adminContent) adminContent.style.display = 'none';
    }
}

window.exportDataAsPdf = async function(dataType) {
    if (!ADMIN_USER_IDS.includes(currentUser?.id)) {
        showErrorNotification("Nur Admins können Daten exportieren.");
        return;
    }

    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        showErrorNotification("jsPDF Bibliothek nicht gefunden. Bitte binden Sie sie in die HTML-Datei ein.");
        console.error("jsPDF is not loaded. Please include it in your HTML file.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const tempDoc = new jsPDF();

    if (typeof tempDoc.autoTable !== 'function') {
        showErrorNotification("jsPDF-AutoTable Plugin nicht gefunden oder nicht korrekt initialisiert.");
        console.error("jsPDF-AutoTable plugin is not loaded or initialized correctly.");
        return;
    }

    const doc = new jsPDF({ orientation: "landscape" });
    let data, error, columns, body, title, filename;
    const timestamp = new Date().toLocaleString('de-DE').replace(/[/:]/g, '-');

    showErrorNotification(`Export für "${dataType}" wird vorbereitet...`);

    try {
        switch (dataType) {
            case 'users':
                title = `Benutzerliste - Exportiert am ${timestamp}`;
                filename = `Benutzerliste_${timestamp}.pdf`;
                
                const { data: allAuthUsersForPdf, error: authUsersPdfError } = await supabaseClient
                    .from('users', { schema: 'auth' }) // Explizit das 'auth'-Schema verwenden
                    .select('id, email, raw_user_meta_data, created_at');

                if (authUsersPdfError || !allAuthUsersForPdf || allAuthUsersForPdf.length === 0) {
                    showErrorNotification("Direkte Abfrage an 'users' (auth.users) für PDF-Export fehlgeschlagen oder keine Daten: " + (authUsersPdfError ? authUsersPdfError.message : 'Keine Daten'));
                    return;
                }
                data = allAuthUsersForPdf;

                columns = [
                    { header: 'User ID', dataKey: 'user_id' },
                    { header: 'Anzeigename', dataKey: 'display_name' },
                    { header: 'E-Mail', dataKey: 'email' },
                    { header: 'Erstellt am', dataKey: 'created_at_auth' } 
                ];
                body = data.map(user => ({
                    user_id: user.id || 'N/A', 
                    display_name: user.raw_user_meta_data?.display_name || 'N/A', 
                    email: user.email || 'N/A', 
                    created_at_auth: user.created_at ? new Date(user.created_at).toLocaleString('de-DE') : 'N/A'
                }));
                break;

            case 'streets':
                title = `Straßenverzeichnis - Exportiert am ${timestamp}`;
                filename = `Strassenverzeichnis_${timestamp}.pdf`;
                ({ data, error } = await supabaseClient
                    .from('streets')
                    .select('id, name, postal_code, created_at, percent_completed')
                    .order('postal_code')
                    .order('name')
                );
                if (error) throw error;
                 if (!data || data.length === 0) {
                    showErrorNotification("Keine Straßendaten zum Exportieren gefunden."); return;
                }
                columns = [
                    { header: 'ID', dataKey: 'id' },
                    { header: 'Name', dataKey: 'name' },
                    { header: 'PLZ', dataKey: 'postal_code' },
                    { header: 'Fortschritt (%)', dataKey: 'percent_completed'},
                    { header: 'Erstellt am', dataKey: 'created_at' }
                ];
                body = data.map(street => ({
                    id: street.id,
                    name: street.name || 'N/A',
                    postal_code: street.postal_code || 'N/A',
                    percent_completed: street.percent_completed !== null ? street.percent_completed : 'N/A',
                    created_at: street.created_at ? new Date(street.created_at).toLocaleString('de-DE') : 'N/A'
                }));
                break;

            case 'house_entries':
                title = `Hausnummern-Einträge - Exportiert am ${timestamp}`;
                filename = `Hausnummern_Eintraege_${timestamp}.pdf`;
                const { data: entriesData, error: entriesError } = await supabaseClient
                    .from('house_entries')
                    .select('*, streets(name, postal_code)') 
                    .order('created_at', { ascending: false });

                if (entriesError) throw entriesError;
                if (!entriesData || entriesData.length === 0) {
                    showErrorNotification("Keine Hausnummern-Einträge zum Exportieren gefunden."); return;
                }

                const creatorIds = [...new Set(entriesData.map(e => e.creator_id).filter(id => id))];
                const creatorNamesMap = new Map();

                if (creatorIds.length > 0) {
                    const { data: namesData, error: namesError } = await supabaseClient
                        .from('users', { schema: 'auth' }) // Explizit das 'auth'-Schema verwenden
                        .select('id, email, raw_user_meta_data')
                        .in('id', creatorIds);
                    
                    if (namesError) {
                        showErrorNotification("Fehler beim Abrufen von User-Namen für PDF (house_entries): " + namesError.message);
                    }
                    else if (namesData) {
                        namesData.forEach(u => creatorNamesMap.set(u.id, u.raw_user_meta_data?.display_name || u.email));
                    }
                }
                
                columns = [
                    { header: 'ID', dataKey: 'id' },
                    { header: 'Straße', dataKey: 'street_name' },
                    { header: 'PLZ', dataKey: 'postal_code' },
                    { header: 'Hausnr.', dataKey: 'house_number' },
                    { header: 'Name (Tür)', dataKey: 'name' },
                    { header: 'Status', dataKey: 'status' },
                    { header: 'Notizen', dataKey: 'notes' },
                    { header: 'Erstellt von', dataKey: 'creator_info'}, // Geändert
                    { header: 'Erstellt am', dataKey: 'created_at' },
                    { header: 'Letzter Besuch', dataKey: 'last_visit_date' }
                ];
                body = entriesData.map(entry => ({
                    id: entry.id,
                    street_name: entry.streets?.name || 'N/A',
                    postal_code: entry.streets?.postal_code || 'N/A',
                    house_number: entry.house_number || 'N/A',
                    name: entry.name || 'N/A',
                    status: entry.status || 'N/A',
                    notes: entry.notes || 'N/A',
                    creator_info: creatorNamesMap.get(entry.creator_id) || entry.creator_id.substring(0,8) + '...' || 'N/A',
                    created_at: entry.created_at ? new Date(entry.created_at).toLocaleString('de-DE') : 'N/A',
                    last_visit_date: entry.last_visit_date ? new Date(entry.last_visit_date).toLocaleDateString('de-DE') : 'N/A'
                }));
                break;

            case 'work_time_entries':
                title = `Zeiterfassungseinträge - Exportiert am ${timestamp}`;
                filename = `Zeiterfassung_${timestamp}.pdf`;
                const { data: workTimeData, error: workTimeError } = await supabaseClient
                    .from('work_time_entries')
                    .select('*') 
                    .order('start_time', { ascending: false });

                if (workTimeError) throw workTimeError;
                if (!workTimeData || workTimeData.length === 0) {
                    showErrorNotification("Keine Zeiterfassungseinträge zum Exportieren gefunden."); return;
                }

                const workTimeUserIds = [...new Set(workTimeData.map(e => e.user_id).filter(id => id))];
                const workTimeUserNamesMap = new Map();
                 if (workTimeUserIds.length > 0) {
                     const { data: namesData, error: namesError } = await supabaseClient
                        .from('users', { schema: 'auth' }) // Explizit das 'auth'-Schema verwenden
                        .select('id, email, raw_user_meta_data')
                        .in('id', workTimeUserIds);

                    if (namesError) {
                        showErrorNotification("Fehler beim Abrufen von User-Namen für PDF (work_time_entries): " + namesError.message);
                    }
                    else if (namesData) {
                        namesData.forEach(u => workTimeUserNamesMap.set(u.id, u.raw_user_meta_data?.display_name || u.email));
                    }
                }

                columns = [
                    { header: 'ID', dataKey: 'id' },
                    { header: 'Benutzer', dataKey: 'user_info' }, // Geändert
                    { header: 'Startzeit', dataKey: 'start_time' },
                    { header: 'Endzeit', dataKey: 'end_time' },
                    { header: 'Dauer (Min)', dataKey: 'duration_minutes' },
                    { header: 'Start-Ort', dataKey: 'start_location' },
                    { header: 'End-Ort', dataKey: 'end_location' }
                ];
                body = workTimeData.map(entry => ({
                    id: entry.id,
                    user_info: workTimeUserNamesMap.get(entry.user_id) || entry.user_id.substring(0,8) + '...' || 'N/A',
                    start_time: entry.start_time ? new Date(entry.start_time).toLocaleString('de-DE') : 'N/A',
                    end_time: entry.end_time ? new Date(entry.end_time).toLocaleString('de-DE') : 'N/A',
                    duration_minutes: entry.duration_minutes !== null ? entry.duration_minutes : 'N/A',
                    start_location: entry.start_location || 'N/A',
                    end_location: entry.end_location || 'N/A'
                }));
                break;

            case 'registration_codes':
                title = `Registrierungscodes - Exportiert am ${timestamp}`;
                filename = `Registrierungscodes_${timestamp}.pdf`;
                 const { data: regCodesData, error: regCodesError } = await supabaseClient
                    .from('registration_codes')
                    .select('*') 
                    .order('created_at', { ascending: false });

                if (regCodesError) throw regCodesError;
                if (!regCodesData || regCodesData.length === 0) {
                    showErrorNotification("Keine Registrierungscodes zum Exportieren gefunden."); return;
                }

                const regCodeUserIds = [...new Set(regCodesData.map(c => c.used_by).filter(id => id))];
                const regCodeUserNamesMap = new Map();
                 if (regCodeUserIds.length > 0) {
                     const { data: namesData, error: namesError } = await supabaseClient
                        .from('users', { schema: 'auth' }) // Explizit das 'auth'-Schema verwenden
                        .select('id, email, raw_user_meta_data')
                        .in('id', regCodeUserIds);
                    
                    if (namesError) {
                        showErrorNotification("Fehler beim Abrufen von User-Namen für PDF (registration_codes): " + namesError.message);
                    }
                    else if (namesData) {
                        namesData.forEach(u => regCodeUserNamesMap.set(u.id, u.raw_user_meta_data?.display_name || u.email));
                    }
                }

                columns = [
                    { header: 'ID', dataKey: 'id' },
                    { header: 'Code', dataKey: 'code_value' },
                    { header: 'Benutzt', dataKey: 'is_used' },
                    { header: 'Benutzt von', dataKey: 'used_by_info' }, // Geändert
                    { header: 'Benutzt am', dataKey: 'used_at' },
                    { header: 'Erstellt am', dataKey: 'created_at' }
                ];
                body = regCodesData.map(code => ({
                    id: code.id,
                    code_value: code.code_value,
                    is_used: code.is_used ? 'Ja' : 'Nein',
                    used_by_info: code.used_by ? (regCodeUserNamesMap.get(code.used_by) || code.used_by.substring(0,8) + '...' || 'N/A') : 'N/A',
                    used_at: code.used_at ? new Date(code.used_at).toLocaleString('de-DE') : 'N/A',
                    created_at: code.created_at ? new Date(code.created_at).toLocaleString('de-DE') : 'N/A'
                }));
                break;

            default:
                showErrorNotification(`Unbekannter Datentyp für Export: "${dataType}"`);
                return;
        }

        // PDF generieren
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(10);
        doc.text(`Gesamtzahl Einträge: ${body.length}`, 14, 30);


        doc.autoTable({
            columns: columns,
            body: body,
            startY: 35,
            theme: 'striped', 
            headStyles: { fillColor: [22, 160, 133] }, 
            alternateRowStyles: { fillColor: [240, 240, 240] },
            styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' }, 
            columnStyles: {
                // Allgemeine ID-Spalte etwas schmaler
                id: { cellWidth: 15, halign: 'center' },
                // Spezifische Anpassungen pro Exporttyp sind ggf. nötig
                // Beispiel für 'users' Export:
                user_id: { cellWidth: 45 },
                display_name: { cellWidth: 40 },
                email: { cellWidth: 50 },
                created_at_auth: { cellWidth: 30 },
                // Beispiel für 'streets' Export:
                name: { cellWidth: 50 },
                postal_code: { cellWidth: 20, halign: 'center' },
                percent_completed: {cellWidth: 25, halign: 'right'},
                // Beispiel für 'house_entries' Export:
                street_name: {cellWidth: 40},
                house_number: {cellWidth: 15, halign: 'center'},
                status: {cellWidth: 20},
                creator_info: {cellWidth: 30},
                // Beispiel für 'work_time_entries' Export:
                user_info: {cellWidth: 35},
                start_time: {cellWidth: 30},
                end_time: {cellWidth: 30},
                duration_minutes: {cellWidth: 20, halign: 'right'},
                // Notizen und Orte können variieren
                notes: { cellWidth: 'auto' },
                start_location: { cellWidth: 'auto' },
                end_location: { cellWidth: 'auto' }
            },
            didDrawPage: function (data) {
                let str = "Seite " + doc.internal.getNumberOfPages();
                if (typeof doc.putTotalPages === 'function') {
                    str = str + " von " + "{totalPages}";
                }
                doc.setFontSize(10);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
                 doc.text(`Exportiert von: ${currentUser.user_metadata?.display_name || currentUser.email}`, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right'});
            }
        });
         if (typeof doc.putTotalPages === 'function') {
            doc.putTotalPages("{totalPages}");
        }

        doc.save(filename);
        showErrorNotification(`Export für "${dataType}" erfolgreich als ${filename} heruntergeladen.`);

    } catch (err) {
        console.error(`Fehler beim PDF-Export für "${dataType}":`, err);
        showErrorNotification(`Fehler beim Export für "${dataType}": ${err.message}`);
    }
};

// NEU: Hilfsfunktion zur Erkennung von "Invalid Refresh Token"-Fehlern
function isInvalidRefreshTokenError(error) {
    return error &&
           error.name === 'AuthApiError' && // Supabase-spezifischer Fehlertyp
           error.status === 400 &&
           error.message &&
           error.message.toLowerCase().includes('invalid refresh token');
}

// --- NEUE FUNKTION für die "Heute"-Zusammenfassung ---
async function updateTodaySummary() {
    if (!currentUser || !todayTotalWork) {
        // // console.warn("updateTodaySummary: User oder todayTotalWork Element nicht gefunden.");
        // showErrorNotification("updateTodaySummary: User oder todayTotalWork Element nicht gefunden.");
        return;
    }

    const todayDateString = getLocalDateString(new Date());
    const startDate = new Date(todayDateString + "T00:00:00Z"); // Verwende Z für UTC
    const endDate = new Date(todayDateString + "T23:59:59.999Z"); // Verwende Z für UTC

    try {
        const { data: entries, error } = await supabaseClient
            .from('work_time_entries')
            .select('duration_minutes')
            .eq('user_id', currentUser.id)
            .gte('start_time', startDate.toISOString())
            .lte('start_time', endDate.toISOString()) // Einträge, die heute gestartet wurden (UTC-basiert)
            .not('duration_minutes', 'is', null); // Nur abgeschlossene Einträge

        if (error) throw error;

        let totalWorkMinutesToday = 0;
        if (entries) {
            entries.forEach(entry => {
                if (entry.duration_minutes) { // Zusätzliche Prüfung
                    totalWorkMinutesToday += entry.duration_minutes;
                }
            });
        }
        todayTotalWork.textContent = formatMinutesToHM(totalWorkMinutesToday);

    } catch (err) {
        console.error("Error updating today's work summary:", err);
        if (todayTotalWork) todayTotalWork.textContent = 'Fehler';
    }
}
// --- ENDE NEUE FUNKTION ---

// NEU: Funktion für den Navigationsbutton zur Arbeitszeitauswertung
window.navigateToWorkTimeEvaluation = function() {
    if (!ADMIN_USER_IDS.includes(currentUser?.id)) {
        showErrorNotification("Nur Admins können diese Auswertung einsehen.");
        return;
    }
    switchView('workTimeEvaluationView', 'Arbeitszeitauswertung');
}

// --- NEUE FUNKTIONEN für Arbeitszeitauswertung ---

async function loadWorkTimeEvaluationData() {
    if (!ADMIN_USER_IDS.includes(currentUser?.id)) {
        showErrorNotification("Zugriff verweigert.");
        switchView('adminView', 'Admin Bereich'); 
        return;
    }

    if (workTimeEvalViewSkeleton) workTimeEvalViewSkeleton.classList.add('hidden');
    if (userEvalList) userEvalList.innerHTML = '<div class="skeleton-list-item" style="margin-bottom: 8px;"></div><div class="skeleton-list-item" style="margin-bottom: 8px;"></div><div class="skeleton-list-item" style="margin-bottom: 8px;"></div>';

    try {
        let usersToDisplay = [];
        if (ADMIN_USER_IDS.includes(currentUser?.id)) {
            // Versuche zuerst, die User-Daten über die Leaderboard-Funktion zu bekommen
            console.log("Versuche User-Daten für Arbeitszeitauswertung über 'get_leaderboard_geschrieben_v1' zu laden...");
            const { data: leaderboardUsers, error: rpcError } = await supabaseClient
                .rpc('get_leaderboard_geschrieben_v1');

            if (rpcError) {
                console.warn("RPC 'get_leaderboard_geschrieben_v1' für User-Liste fehlgeschlagen:", rpcError.message, ". Nutze Fallback (auth.users).");
                // Fallback: auth.users abfragen
                const { data: allAuthUsers, error: authUsersError } = await supabaseClient
                    .from('users', { schema: 'auth' })
                    .select('id, email, raw_user_meta_data, created_at');

                if (authUsersError) {
                    console.error("Fehler beim Abrufen aller Benutzer für Arbeitszeitauswertung (auth.users):", authUsersError);
                    showErrorNotification("Konnte Benutzerdetails nicht laden (auth.users): " + authUsersError.message + ". Versuche zweiten Fallback (User-IDs).");
                    // Zweiter Fallback: Nur User-IDs aus work_time_entries
                    const { data: workEntries, error: entriesError } = await supabaseClient
                        .from('work_time_entries')
                        .select('user_id');
                    if (entriesError) throw entriesError;

                    if (workEntries && workEntries.length > 0) {
                        const uniqueUserIds = [...new Set(workEntries.map(entry => entry.user_id).filter(id => id))];
                        usersToDisplay = uniqueUserIds.map(userId => ({
                            user_id: userId,
                            display_name: `User ID: ${userId.substring(0, 8)}...`,
                            email: null
                        }));
                        console.log("Zweiter Fallback für Arbeitszeitauswertung: Zeige User-IDs an.");
                    }
                } else if (allAuthUsers) {
                    usersToDisplay = allAuthUsers.map(u => ({
                        user_id: u.id,
                        display_name: u.raw_user_meta_data?.display_name || u.email,
                        email: u.email
                    }));
                }
            } else if (leaderboardUsers && leaderboardUsers.length > 0) {
                console.log("User-Daten erfolgreich über 'get_leaderboard_geschrieben_v1' geladen.");
                usersToDisplay = leaderboardUsers.map(user => ({
                    user_id: user.user_id, // Annahme: RPC gibt user_id zurück
                    display_name: user.display_name, // Annahme: RPC gibt display_name zurück
                    email: null // E-Mail ist in Leaderboard-Daten typischerweise nicht enthalten
                }));
                // Entferne Duplikate, falls mehrere Einträge pro User im Leaderboard wären (sollte nicht der Fall sein)
                const uniqueUserMap = new Map();
                usersToDisplay.forEach(user => {
                    if (!uniqueUserMap.has(user.user_id)) {
                        uniqueUserMap.set(user.user_id, user);
                    }
                });
                usersToDisplay = Array.from(uniqueUserMap.values());

            } else {
                 console.warn("RPC 'get_leaderboard_geschrieben_v1' gab keine User-Daten zurück. Nutze Fallback (auth.users).");
                 // Fallback, falls RPC leer ist, aber keinen Fehler wirft
                 const { data: allAuthUsers, error: authUsersError } = await supabaseClient
                    .from('users', { schema: 'auth' })
                    .select('id, email, raw_user_meta_data, created_at');
                if (authUsersError) throw authUsersError; // Fehler hier weiterwerfen, wenn Fallback auch fehlschlägt
                if (allAuthUsers) {
                    usersToDisplay = allAuthUsers.map(u => ({
                        user_id: u.id,
                        display_name: u.raw_user_meta_data?.display_name || u.email,
                        email: u.email
                    }));
                }
            }
        } else {
            showErrorNotification("Zugriff verweigert. Diese Aktion ist nur für Admins.");
            return;
        }
        
        usersToDisplay.sort((a, b) => {
            const nameA = a.display_name || a.email || a.user_id;
            const nameB = b.display_name || b.email || b.user_id;
            return nameA.localeCompare(nameB);
        });

        displayUserListForEval(usersToDisplay);
        if (userListForEvalContainer) userListForEvalContainer.style.display = 'block';
        if (userDetailEvalContainer) userDetailEvalContainer.style.display = 'none';

    } catch (error) {
        console.error("Fehler beim Laden der Mitarbeiter für Arbeitszeitauswertung:", error);
        if (userEvalList) userEvalList.innerHTML = `<p class="error-message">Fehler beim Laden der Mitarbeiter: ${error.message}</p>`;
        showErrorNotification("Fehler beim Laden der Mitarbeiterliste.");
    }
}

function displayUserListForEval(users) {
    if (!userEvalList) return;
    userEvalList.innerHTML = ''; 

    if (!users || users.length === 0) {
        userEvalList.innerHTML = '<p>Keine Mitarbeiter gefunden.</p>'; // Angepasste Nachricht
        return;
    }

    const ul = document.createElement('ul');
    ul.className = 'evaluation-user-list'; 

    users.forEach(user => {
        const li = document.createElement('li');
        li.className = 'evaluation-user-item';
        
        const displayName = user.display_name || user.email || user.user_id; // Priorität: Name, dann E-Mail, dann ID
        li.textContent = displayName;
        li.dataset.userId = user.user_id;
        li.dataset.userName = displayName; 
        li.onclick = () => selectUserForWorkTimeEvaluation(user.user_id, displayName);
        ul.appendChild(li);
    });
    userEvalList.appendChild(ul);
}

async function selectUserForWorkTimeEvaluation(userId, userName) {
    console.log(`Lade Arbeitszeiten für ${userName} (ID: ${userId})`);
    selectedUserIdForEval = userId;
    selectedUserNameForEval = userName; 

    if (userDetailEvalName) userDetailEvalName.textContent = `Arbeitszeiten für: ${escapeHtml(userName)}`;
    if (monthlyWorkTimeTableContainer) monthlyWorkTimeTableContainer.innerHTML = ''; 
    if (monthlyWorkTimeSkeleton) monthlyWorkTimeSkeleton.style.display = 'block';
    if (userDetailEvalContainer) userDetailEvalContainer.style.display = 'block';
    if (userListForEvalContainer) userListForEvalContainer.style.display = 'none'; 

    try {
        const { data: entries, error } = await supabaseClient
            .from('work_time_entries')
            .select('start_time, end_time, duration_minutes, start_location, end_location') // Standorte mitladen
            .eq('user_id', userId)
            .not('duration_minutes', 'is', null) 
            .order('start_time', { ascending: true }); // Älteste zuerst für einfachere Tagesgruppierung

        if (error) throw error;

        processAndDisplayMonthlyWorkTime(entries);

    } catch (error) {
        console.error(`Fehler beim Laden der Arbeitszeiten für ${userName}:`, error);
        if (monthlyWorkTimeTableContainer) monthlyWorkTimeTableContainer.innerHTML = `<p class="error-message">Fehler beim Laden der Arbeitszeiten: ${error.message}</p>`;
        showErrorNotification(`Fehler beim Laden der Arbeitszeiten für ${userName}.`);
    } finally {
        if (monthlyWorkTimeSkeleton) monthlyWorkTimeSkeleton.style.display = 'none';
    }
}

function processAndDisplayMonthlyWorkTime(allEntries) {
    if (!monthlyWorkTimeTableContainer) return;
    monthlyWorkTimeTableContainer.innerHTML = '';

    if (!allEntries || allEntries.length === 0) {
        monthlyWorkTimeTableContainer.innerHTML = '<p>Keine abgeschlossenen Arbeitszeiteinträge für diesen Mitarbeiter gefunden.</p>';
        return;
    }

    // Einträge nach Monat gruppieren und Gesamtzeiten berechnen
    const monthlyAggregatedData = allEntries.reduce((acc, entry) => {
        if (entry.start_time && typeof entry.duration_minutes === 'number') {
            const startDate = new Date(entry.start_time);
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;

            if (!acc[key]) {
                acc[key] = { year, month, totalMinutes: 0, entryCount: 0, entries: [] };
            }
            acc[key].totalMinutes += entry.duration_minutes;
            acc[key].entryCount++;
            acc[key].entries.push(entry); // Die einzelnen Einträge für diesen Monat speichern
        }
        return acc;
    }, {});

    const sortedMonthKeys = Object.keys(monthlyAggregatedData).sort().reverse(); 

    if (sortedMonthKeys.length === 0) {
         monthlyWorkTimeTableContainer.innerHTML = '<p>Keine auswertbaren Monatsdaten gefunden.</p>';
         return;
    }

    const table = document.createElement('table');
    table.className = 'styled-table monthly-work-table';

    const thead = table.createTHead();
    const headerRow = thead.insertRow();
    const headers = ['Monat/Jahr', 'Gesamtstunden', 'Einträge', 'Details'];
    headers.forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        if (text === 'Details') th.style.textAlign = 'center';
        headerRow.appendChild(th);
    });

    const tbody = table.createTBody();
    sortedMonthKeys.forEach(monthKey => {
        const monthData = monthlyAggregatedData[monthKey];
        const monthRow = tbody.insertRow();
        monthRow.className = 'month-summary-row';

        const monthName = new Date(monthData.year, monthData.month).toLocaleString('de-DE', { month: 'long' });

        monthRow.insertCell().textContent = `${monthName} ${monthData.year}`;
        monthRow.insertCell().textContent = formatMinutesToHM(monthData.totalMinutes);
        monthRow.insertCell().textContent = monthData.entryCount;
        
        const detailCell = monthRow.insertCell();
        detailCell.style.textAlign = 'center';
        const toggleButton = document.createElement('button');
        toggleButton.className = 'toggle-details-button buttonnumpad icon-button';
        toggleButton.innerHTML = '<span class="material-icons">expand_more</span>';
        toggleButton.title = "Tagesdetails anzeigen/verbergen";
        detailCell.appendChild(toggleButton);

        // Versteckte Zeile für Tagesdetails
        const dailyDetailRow = tbody.insertRow();
        dailyDetailRow.className = 'daily-detail-row hidden-row';
        const dailyDetailCell = dailyDetailRow.insertCell();
        dailyDetailCell.colSpan = headers.length; // Nimmt die gesamte Breite ein
        const dailyDetailContainer = document.createElement('div');
        dailyDetailContainer.className = 'daily-detail-container';
        dailyDetailCell.appendChild(dailyDetailContainer);
        
        toggleButton.onclick = () => {
            dailyDetailRow.classList.toggle('hidden-row');
            toggleButton.innerHTML = dailyDetailRow.classList.contains('hidden-row') 
                ? '<span class="material-icons">expand_more</span>' 
                : '<span class="material-icons">expand_less</span>';
            if (!dailyDetailRow.classList.contains('hidden-row') && dailyDetailContainer.innerHTML === '') {
                // Lade und zeige Tagesdetails nur beim ersten Ausklappen
                renderDailyEntriesForMonth(monthData.entries, dailyDetailContainer);
            }
        };
    });

    monthlyWorkTimeTableContainer.appendChild(table);
}

function renderDailyEntriesForMonth(monthEntries, container) {
    container.innerHTML = ''; // Vorherigen Inhalt leeren

    if (!monthEntries || monthEntries.length === 0) {
        container.innerHTML = '<p class="no-daily-entries">Keine Einträge für diesen Monat.</p>';
        return;
    }

    // Einträge nach Tag gruppieren
    const dailyGroupedEntries = monthEntries.reduce((acc, entry) => {
        const dayKey = getLocalDateString(new Date(entry.start_time));
        if (!acc[dayKey]) {
            acc[dayKey] = { entries: [], totalMinutes: 0 };
        }
        acc[dayKey].entries.push(entry);
        if (typeof entry.duration_minutes === 'number') {
            acc[dayKey].totalMinutes += entry.duration_minutes;
        }
        return acc;
    }, {});

    const sortedDayKeys = Object.keys(dailyGroupedEntries).sort(); // Tage chronologisch sortieren

    sortedDayKeys.forEach(dayKey => {
        const dayData = dailyGroupedEntries[dayKey];
        const dayEntries = dayData.entries;
        const totalMinutesForDay = dayData.totalMinutes;

        const dayContainer = document.createElement('div');
        dayContainer.className = 'day-entry-group';

        const dayHeader = document.createElement('h5');
        dayHeader.className = 'day-entry-header';
        // NEU: Summe der Stunden zum Tages-Header hinzufügen
        dayHeader.textContent = `Tag: ${formatDateForDisplay(dayKey)} (Gesamt: ${formatMinutesToHM(totalMinutesForDay)})`;
        dayContainer.appendChild(dayHeader);

        const ul = document.createElement('ul');
        ul.className = 'daily-entries-list';

        dayEntries.forEach(entry => {
            const li = document.createElement('li');
            li.className = 'time-entry-li-detailed'; // Eigene Klasse für detaillierte Liste

            const startTimeFormatted = formatTime(new Date(entry.start_time));
            const endTimeFormatted = entry.end_time ? formatTime(new Date(entry.end_time)) : 'Laufend';
            const durationFormatted = entry.duration_minutes ? formatMinutesToHM(entry.duration_minutes) : '-';

            let entryHtml = `
                <div class="time-entry-main">
                    <span class="time-entry-times"><strong>${startTimeFormatted} - ${endTimeFormatted}</strong></span>
                    <span class="time-entry-duration-detailed">Dauer: ${durationFormatted}</span>
                </div>
                <div class="time-entry-locations">
            `;

            if (entry.start_location && isValidHttpUrl(entry.start_location)) {
                entryHtml += `<button class="location-button buttonnumpad" onclick="window.open('${escapeHtml(entry.start_location)}', '_blank')">
                                <span class="material-icons">pin_drop</span> Start-Ort
                              </button>`;
            } else if (entry.start_location) {
                 entryHtml += `<span class="location-text">Start: ${escapeHtml(entry.start_location)}</span>`;
            }

            if (entry.end_location && isValidHttpUrl(entry.end_location)) {
                entryHtml += `<button class="location-button buttonnumpad" onclick="window.open('${escapeHtml(entry.end_location)}', '_blank')">
                                <span class="material-icons">pin_drop</span> End-Ort
                              </button>`;
            } else if (entry.end_location) {
                 entryHtml += `<span class="location-text">Ende: ${escapeHtml(entry.end_location)}</span>`;
            }
            
            entryHtml += `</div>`; // Ende .time-entry-locations
            li.innerHTML = entryHtml;
            ul.appendChild(li);
        });
        dayContainer.appendChild(ul);
        container.appendChild(dayContainer);
    });
}

// Hilfsfunktion um zu prüfen, ob ein String eine gültige HTTP/HTTPS URL ist
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;  
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

// --- NEU: Funktionen für den Export der eigenen Arbeitszeiten ---
async function setupWorkTimeExportUI() {
    if (!calendarView || !currentUser) return;

    // Entferne alten Container, falls vorhanden (um Duplikate bei erneutem Laden der View zu vermeiden)
    const existingExportContainer = document.getElementById('workTimeExportContainer');
    if (existingExportContainer) {
        existingExportContainer.remove();
    }

    // Erstelle den Container für die Export-Optionen
    workTimeExportContainer = document.createElement('div');
    workTimeExportContainer.id = 'workTimeExportContainer';
    workTimeExportContainer.style.marginTop = '20px';
    workTimeExportContainer.style.paddingTop = '15px';
    workTimeExportContainer.style.borderTop = '1px solid var(--border-color-soft)';

    const heading = document.createElement('h4');
    heading.textContent = 'Meine Arbeitszeiten exportieren';
    workTimeExportContainer.appendChild(heading);

    workTimeExportMonthSelect = document.createElement('select');
    workTimeExportMonthSelect.id = 'workTimeExportMonthSelect';
    workTimeExportMonthSelect.style.marginBottom = '10px';
    workTimeExportMonthSelect.style.width = '100%';
    workTimeExportMonthSelect.style.padding = '10px';
    workTimeExportMonthSelect.style.border = '1px solid var(--border-color, #ccc)';
    workTimeExportMonthSelect.style.borderRadius = '5px';


    const defaultOption = document.createElement('option');
    defaultOption.value = "";
    defaultOption.textContent = "-- Monat auswählen --";
    workTimeExportMonthSelect.appendChild(defaultOption);
    workTimeExportContainer.appendChild(workTimeExportMonthSelect);

    exportSelectedMonthButton = document.createElement('button');
    exportSelectedMonthButton.id = 'exportSelectedMonthButton';
    exportSelectedMonthButton.className = 'buttonnumpad'; // Oder eine andere passende Klasse
    exportSelectedMonthButton.textContent = 'Ausgewählten Monat als PDF exportieren';
    exportSelectedMonthButton.style.marginTop = '10px';
    exportSelectedMonthButton.disabled = true; // Initial deaktiviert
    workTimeExportContainer.appendChild(exportSelectedMonthButton);

    // Füge den Container unterhalb der Historie ein (timeTrackingHistory)
    if (timeTrackingHistory && timeTrackingHistory.parentNode) {
        timeTrackingHistory.parentNode.insertBefore(workTimeExportContainer, timeTrackingHistory.nextSibling);
    } else {
        // Fallback, falls timeTrackingHistory nicht da ist (sollte nicht passieren)
        calendarView.appendChild(workTimeExportContainer);
    }

    // Event-Listener für das Select-Element, um den Button zu aktivieren/deaktivieren
    workTimeExportMonthSelect.addEventListener('change', () => {
        exportSelectedMonthButton.disabled = !workTimeExportMonthSelect.value;
    });

    // Event-Listener für den Export-Button
    exportSelectedMonthButton.addEventListener('click', async () => {
        const selectedValue = workTimeExportMonthSelect.value;
        if (selectedValue) {
            const [year, month] = selectedValue.split('-');
            await exportMyWorkTimeAsPdf(parseInt(year), parseInt(month));
        }
    });

    // Fülle das Dropdown mit den verfügbaren Monaten
    await populateWorkTimeExportDropdown();
}

async function populateWorkTimeExportDropdown() {
    if (!workTimeExportMonthSelect || !currentUser) return;

    // Optionen leeren (außer der Default-Option)
    while (workTimeExportMonthSelect.options.length > 1) {
        workTimeExportMonthSelect.remove(1);
    }

    try {
        const { data: entries, error } = await supabaseClient
            .from('work_time_entries')
            .select('start_time')
            .eq('user_id', currentUser.id)
            .not('start_time', 'is', null) // Nur Einträge mit Startzeit berücksichtigen
            .order('start_time', { ascending: false });

        if (error) throw error;

        if (!entries || entries.length === 0) {
            workTimeExportMonthSelect.disabled = true;
            exportSelectedMonthButton.disabled = true;
            // Optional: Nachricht anzeigen, dass keine Daten vorhanden sind
            const noDataOption = document.createElement('option');
            noDataOption.value = "";
            noDataOption.textContent = "Keine Einträge für Export vorhanden";
            noDataOption.disabled = true;
            workTimeExportMonthSelect.appendChild(noDataOption);
            return;
        }

        const availableMonths = new Set();
        entries.forEach(entry => {
            const startDate = new Date(entry.start_time);
            const year = startDate.getFullYear();
            const month = startDate.getMonth() + 1; // Monate sind 0-basiert
            availableMonths.add(`${year}-${String(month).padStart(2, '0')}`);
        });

        // Sortierte Monate zum Dropdown hinzufügen (neueste zuerst)
        Array.from(availableMonths).sort().reverse().forEach(monthYear => {
            const [year, month] = monthYear.split('-');
            const option = document.createElement('option');
            option.value = monthYear;
            const monthDate = new Date(parseInt(year), parseInt(month) - 1);
            option.textContent = monthDate.toLocaleString('de-DE', { month: 'long', year: 'numeric' });
            workTimeExportMonthSelect.appendChild(option);
        });

        workTimeExportMonthSelect.disabled = false;
        // Der Export-Button bleibt deaktiviert, bis ein Monat ausgewählt wird (siehe EventListener in setupWorkTimeExportUI)

    } catch (error) {
        console.error("Fehler beim Füllen des Monats-Dropdowns für Export:", error);
        showErrorNotification("Fehler beim Laden der Export-Monate: " + error.message);
        workTimeExportMonthSelect.disabled = true;
        exportSelectedMonthButton.disabled = true;
    }
}

async function exportMyWorkTimeAsPdf(year, month) {
    if (!currentUser) {
        showErrorNotification("Kein Benutzer angemeldet.");
        return;
    }

    // Sicherstellen, dass jsPDF geladen ist
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        showErrorNotification("jsPDF Bibliothek nicht gefunden. Bitte binden Sie sie in die HTML-Datei ein.");
        console.error("jsPDF nicht geladen.");
        return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF(); // jsPDF-Instanz erstellen

    // Sicherstellen, dass das autoTable Plugin auf der Instanz verfügbar ist
    if (typeof doc.autoTable !== 'function') {
        showErrorNotification("jsPDF-AutoTable Plugin nicht auf jsPDF Instanz gefunden. Stellen Sie sicher, dass 'jspdf.plugin.autotable.min.js' korrekt geladen wurde.");
        console.error("doc.autoTable ist keine Funktion. Überprüfen Sie die Einbindung von jspdf-autotable.");
        return;
    }

    const monthName = new Date(year, month - 1).toLocaleString('de-DE', { month: 'long' });
    const title = `Meine Arbeitszeitauswertung für ${monthName} ${year}`;
    const filename = `Arbeitszeiten_${currentUser.user_metadata?.display_name || 'User'}_${year}_${String(month).padStart(2, '0')}.pdf`;

    showErrorNotification(`Export für ${monthName} ${year} wird vorbereitet...`);

    try {
        // 1. Lade die work_time_entries für den aktuellen Benutzer und den ausgewählten Monat/Jahr.
        const firstDayOfMonth = new Date(year, month - 1, 1);
        const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59, 999); // Letzter Tag des Monats, Ende des Tages

        const { data: entries, error: fetchError } = await supabaseClient
            .from('work_time_entries')
            .select('start_time, end_time, duration_minutes')
            .eq('user_id', currentUser.id)
            .gte('start_time', firstDayOfMonth.toISOString())
            .lte('start_time', lastDayOfMonth.toISOString())
            .not('duration_minutes', 'is', null) // Nur abgeschlossene Einträge
            .order('start_time', { ascending: true });

        if (fetchError) {
            throw new Error(`Fehler beim Laden der Arbeitszeitdaten: ${fetchError.message}`);
        }

        if (!entries || entries.length === 0) {
            showErrorNotification(`Keine Arbeitszeiteinträge für ${monthName} ${year} gefunden.`);
            doc.setFontSize(18);
            doc.text(title, 14, 22);
            doc.setFontSize(12);
            doc.text(`Benutzer: ${currentUser.user_metadata?.display_name || currentUser.email || 'Unbekannt'}`, 14, 30);
            doc.text(`Exportiert am: ${new Date().toLocaleString('de-DE')}`, 14, 38);
            doc.text(`Keine Einträge für ${monthName} ${year} vorhanden.`, 14, 50);
            doc.save(filename);
            return;
        }

        // 2. Berechne die Gesamt-Arbeitszeit für den Monat.
        let totalMinutesMonth = 0;
        entries.forEach(entry => {
            if (typeof entry.duration_minutes === 'number') {
                totalMinutesMonth += entry.duration_minutes;
            }
        });
        const totalHoursMonthFormatted = formatMinutesToHM(totalMinutesMonth);

        // PDF-Kopfzeile
        doc.setFontSize(18);
        doc.text(title, 14, 22);
        doc.setFontSize(12);
        doc.text(`Benutzer: ${currentUser.user_metadata?.display_name || currentUser.email || 'Unbekannt'}`, 14, 30);
        doc.text(`Gesamtarbeitszeit ${monthName} ${year}: ${totalHoursMonthFormatted}`, 14, 38);
        doc.text(`Exportiert am: ${new Date().toLocaleString('de-DE')}`, 14, 46);


        // 3. Formatiere die Daten für die Tabelle.
        const tableColumns = [
            { header: 'Datum', dataKey: 'date' },
            { header: 'Startzeit', dataKey: 'startTime' },
            { header: 'Endzeit', dataKey: 'endTime' },
            { header: 'Dauer (Min.)', dataKey: 'duration' }
        ];

        const tableBody = entries.map(entry => {
            const startDate = new Date(entry.start_time);
            return {
                date: startDate.toLocaleDateString('de-DE'),
                startTime: formatTime(startDate),
                endTime: entry.end_time ? formatTime(new Date(entry.end_time)) : 'Laufend',
                duration: entry.duration_minutes !== null ? entry.duration_minutes : 'N/A'
            };
        });

        // 4. Verwende doc.autoTable, um die Tabelle ins PDF zu zeichnen.
        doc.autoTable({ // doc.autoTable direkt aufrufen
            columns: tableColumns,
            body: tableBody,
            startY: 54, // Start nach der Kopfzeile
            theme: 'striped',
            headStyles: { fillColor: [22, 160, 133] }, // Ein Grünton
            styles: { fontSize: 10, cellPadding: 2 },
            columnStyles: {
                duration: { halign: 'right' }
            },
            didDrawPage: function (data) {
                // Fußzeile mit Seitenzahl
                let str = "Seite " + doc.internal.getNumberOfPages();
                if (typeof doc.putTotalPages === 'function') { // Für jsPDF v3+
                    str = str + " von " + "{totalPages}";
                }
                doc.setFontSize(8);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);
            }
        });

        if (typeof doc.putTotalPages === 'function') { // Für jsPDF v3+
            doc.putTotalPages("{totalPages}");
        }

        doc.save(filename);
        showErrorNotification(`PDF "${filename}" erfolgreich heruntergeladen.`);

    } catch (err) {
        console.error(`Fehler beim Erstellen des PDFs für ${monthName} ${year}:`, err);
        showErrorNotification(`Fehler beim Export für ${monthName} ${year}: ${err.message}`);
    }
}
// --- ENDE NEUE FUNKTIONEN ---
