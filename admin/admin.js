// admin.js - Logik für das Admin Dashboard

// Supabase Client initialisieren (gleiche URL/Key wie in app.js)
const supabaseUrl = 'https://pvjjtwuaofclmsvsaneo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2amp0d3Vhb2ZjbG1zdnNhbmVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU5OTQyOTQsImV4cCI6MjA2MTU3MDI5NH0.zTde0H29V-_uTvrrwv6Zr3lXhw6zfpP0-IfO0SXiDYw';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// DOM Elemente
const adminLoadingIndicator = document.getElementById('adminLoadingIndicator');
const adminErrorDisplay = document.getElementById('adminErrorDisplay');
const adminContent = document.getElementById('adminContent');
const adminStatsGrid = document.getElementById('adminStatsGrid');
const adminStatTotalElement = document.getElementById('adminStatTotal');
const adminStatusChartCanvas = document.getElementById('adminStatusChartCanvas');
const activityDateInput = document.getElementById('activityDate');
const activityLoadingIndicator = document.getElementById('activityLoadingIndicator');
const activityErrorDisplay = document.getElementById('activityErrorDisplay');
const activityTableBody = document.getElementById('activityTableBody');

let adminStatusChartInstance = null;

// --- Initialisierung und Authentifizierung (PLATZHALTER) ---
document.addEventListener('DOMContentLoaded', async () => {
    // !!! WICHTIG: ECHTE ADMIN-AUTHENTIFIZIERUNG HIER EINFÜGEN !!!
    // Prüfen, ob der Benutzer eingeloggt UND ein Admin ist.
    // Beispiel (vereinfacht, benötigt Anpassung an deine Auth-Logik):
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
        // Kein Benutzer eingeloggt -> Weiterleitung zum Login oder Fehlermeldung
        console.error("Admin Dashboard: Kein Benutzer eingeloggt.");
        showAdminError("Zugriff verweigert. Bitte melden Sie sich an.");
        // window.location.href = '/login.html'; // Beispiel Weiterleitung
        return;
    }

    // Hier müsstest du prüfen, ob session.user eine Admin-Rolle hat
    // z.B. anhand von Metadaten oder einer Profil-Tabelle.
    const isAdmin = true; // <- DIES IST NUR EIN PLATZHALTER!

    if (!isAdmin) {
         console.error("Admin Dashboard: Benutzer ist kein Admin.");
         showAdminError("Zugriff verweigert. Sie haben keine Admin-Rechte.");
         // window.location.href = '/'; // Beispiel Weiterleitung zur Haupt-App
         return;
    }

    console.log("Admin Dashboard: Benutzer ist Admin. Lade Daten...");
    adminLoadingIndicator.style.display = 'block';

    // Heutiges Datum im Datepicker setzen
    activityDateInput.valueAsDate = new Date();

    // Event Listener für Datumsauswahl
    activityDateInput.addEventListener('change', () => {
        loadDailyActivity(activityDateInput.value);
    });

    // Initiale Daten laden
    await loadAdminOverallStats();
    await loadDailyActivity(activityDateInput.value); // Lade für heute

    adminLoadingIndicator.style.display = 'none';
    adminContent.style.display = 'block';

});

// --- Datenladefunktionen ---

async function loadAdminOverallStats() {
    try {
        console.log("Lade globale Statistiken...");
        const { data: stats, error } = await supabase.rpc('get_all_users_stats');

        if (error) throw error;
        if (!stats) throw new Error("Keine Statistikdaten erhalten.");

        console.log("Globale Statistikdaten:", stats);

        let totalEntries = 0;
        const statusCounts = {};

        // Zusätzliche Stat-Items im Grid leeren (außer dem Gesamt-Item)
        while (adminStatsGrid.children.length > 1) {
             adminStatsGrid.removeChild(adminStatsGrid.lastChild);
        }

        stats.forEach(item => {
            const count = item.status_count || 0;
            totalEntries += count;
            statusCounts[item.status] = count;

            // Stat-Item dynamisch hinzufügen (außer Gesamt)
            if (item.status !== 'Gesamt (berechnet)') { // Vermeide doppeltes Gesamt
                 const statItem = document.createElement('div');
                 statItem.className = 'stat-item';
                 statItem.innerHTML = `
                     <span class="stat-value">${count}</span>
                     <span class="stat-label">${escapeHtml(item.status)}</span>
                 `;
                 adminStatsGrid.appendChild(statItem);
            }
        });

        adminStatTotalElement.textContent = totalEntries; // Gesamtanzahl aktualisieren

        renderAdminStatusChart(statusCounts); // Chart rendern

    } catch (error) {
        console.error("Fehler beim Laden der globalen Statistiken:", error);
        showAdminError(`Fehler beim Laden der Gesamtübersicht: ${error.message}`);
    }
}

async function loadDailyActivity(dateString) {
    if (!dateString) return; // Kein Datum ausgewählt

    activityTableBody.innerHTML = ''; // Tabelle leeren
    activityErrorDisplay.style.display = 'none';
    activityLoadingIndicator.style.display = 'block';

    try {
        console.log(`Lade Aktivitäten für Datum: ${dateString}`);
        const { data: activities, error } = await supabase
            .rpc('get_daily_user_activity', { activity_date: dateString });

        if (error) throw error;
        if (!activities) throw new Error("Keine Aktivitätsdaten erhalten.");

        console.log("Tägliche Aktivitätsdaten:", activities);

        if (activities.length === 0) {
            activityTableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 15px;">Keine Aktivitäten für diesen Tag gefunden.</td></tr>';
        } else {
            activities.forEach(activity => {
                const row = document.createElement('tr');
                const firstEntryTime = activity.first_entry ? new Date(activity.first_entry).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-';
                const lastEntryTime = activity.last_entry ? new Date(activity.last_entry).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '-';

                row.innerHTML = `
                    <td>${escapeHtml(activity.display_name || 'Unbekannt')}</td>
                    <td style="text-align: right; padding-right: 20px;">${activity.entry_count || 0}</td>
                    <td style="text-align: center;">${firstEntryTime}</td>
                    <td style="text-align: center;">${lastEntryTime}</td>
                `;
                activityTableBody.appendChild(row);
            });
        }

    } catch (error) {
        console.error(`Fehler beim Laden der Aktivitäten für ${dateString}:`, error);
        activityErrorDisplay.textContent = `Fehler beim Laden der Aktivitäten: ${error.message}`;
        activityErrorDisplay.style.display = 'block';
        activityTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger-color); padding: 15px;">Laden fehlgeschlagen</td></tr>`;
    } finally {
        activityLoadingIndicator.style.display = 'none';
    }
}


// --- Renderfunktionen ---

function renderAdminStatusChart(statusCounts) {
     if (!adminStatusChartCanvas) return;
     const ctx = adminStatusChartCanvas.getContext('2d');

     if (adminStatusChartInstance) {
         adminStatusChartInstance.destroy();
     }

     const labels = Object.keys(statusCounts); // Alle Stati verwenden
     const dataValues = labels.map(label => statusCounts[label]);

     // Beispielhafte Farben (können angepasst/erweitert werden)
     const backgroundColors = [
         '#16a34a', '#2563eb', '#dc2626', '#f59e0b', '#6b7280', '#0284c7',
         '#d946ef', '#059669', '#ea580c', '#64748b', '#4f46e5', '#be185d'
     ];
     const chartColors = dataValues.map((_, index) => backgroundColors[index % backgroundColors.length]);
     const cardBgColor = '#f8fafc'; // Statischer Wert

     adminStatusChartInstance = new Chart(ctx, {
         type: 'doughnut', // Doughnut oder Pie
         data: {
             labels: labels,
             datasets: [{
                 label: 'Status Verteilung (Alle)',
                 data: dataValues,
                 backgroundColor: chartColors,
                 borderColor: cardBgColor,
                 borderWidth: 1
             }]
         },
         options: {
             responsive: true,
             maintainAspectRatio: true,
             plugins: {
                 legend: { position: 'bottom', labels: { padding: 15 } },
                 tooltip: {
                     callbacks: {
                         label: function(context) {
                             let label = context.label || '';
                             if (label) label += ': ';
                             if (context.parsed !== null) label += context.parsed;
                             return label;
                         }
                     }
                 }
             }
         }
     });
}


// --- Hilfsfunktionen ---

function showAdminError(message) {
    if (adminErrorDisplay && adminLoadingIndicator && adminContent) {
        adminErrorDisplay.textContent = message;
        adminErrorDisplay.style.display = 'block';
        adminLoadingIndicator.style.display = 'none';
        adminContent.style.display = 'none'; // Hauptinhalt ausblenden
    } else {
        alert(message); // Fallback
    }
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }