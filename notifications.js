/**
 * Benachrichtigungssystem für Arbeitszeiterfassung
 * Unterstützt gesetzliche Vorgaben nach ArbZG
 */

class WorkTimeNotifications {
    constructor(options = {}) {
        this.config = {
            // Arbeitszeit-Limits (in Millisekunden)
            maxDailyHours: options.maxDailyHours || 8,
            extendedMaxHours: options.extendedMaxHours || 10,
            mandatoryBreakAfter: options.mandatoryBreakAfter || 6,
            suggestedBreakAfter: options.suggestedBreakAfter || 4,
            minBreakDuration: options.minBreakDuration || 30,
            
            // Benachrichtigungseinstellungen
            enableSound: options.enableSound !== false,
            enablePopup: options.enablePopup !== false,
            enableBrowser: options.enableBrowser !== false,
        };
        
        this.timers = new Map();
        this.workSession = null;
        this.callbacks = new Map();
        
        this.init();
    }
    
    init() {
        // Browser-Benachrichtigungen anfordern
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    /**
     * Arbeitszeit starten
     */
    startWorkTime() {
        this.workSession = {
            startTime: new Date(),
            breaks: [],
            lastBreakReminder: null,
            overtimeWarned: false
        };
        
        this.scheduleNotifications();
        this.notifyCallback('workStarted', this.workSession);
    }
    
    /**
     * Arbeitszeit beenden
     */
    endWorkTime() {
        if (!this.workSession) return;
        
        const endTime = new Date();
        const totalWorkTime = this.calculateWorkTime(this.workSession.startTime, endTime);
        
        this.clearAllTimers();
        
        const sessionData = {
            ...this.workSession,
            endTime,
            totalHours: totalWorkTime.hours,
            totalMinutes: totalWorkTime.minutes
        };
        
        this.workSession = null;
        this.notifyCallback('workEnded', sessionData);
        
        return sessionData;
    }
    
    /**
     * Pause starten
     */
    startBreak() {
        if (!this.workSession) return;
        
        const breakStart = new Date();
        this.workSession.breaks.push({ start: breakStart, end: null });
        this.notifyCallback('breakStarted', { time: breakStart });
    }
    
    /**
     * Pause beenden
     */
    endBreak() {
        if (!this.workSession || this.workSession.breaks.length === 0) return;
        
        const currentBreak = this.workSession.breaks[this.workSession.breaks.length - 1];
        if (currentBreak.end) return; // Pause bereits beendet
        
        currentBreak.end = new Date();
        this.notifyCallback('breakEnded', { break: currentBreak });
        
        // Neue Timer nach Pausenende setzen
        this.scheduleNotifications();
    }
    
    /**
     * Benachrichtigungen planen
     */
    scheduleNotifications() {
        if (!this.workSession) return;
        
        this.clearAllTimers();
        
        const now = new Date();
        const workTime = this.calculateActiveWorkTime();
        
        // Pausenerinnerung nach 4-5 Stunden (Vorschlag)
        if (workTime.totalMinutes >= this.config.suggestedBreakAfter * 60 - 30) {
            this.scheduleBreakSuggestion();
        }
        
        // Pausenerinnerung nach 6 Stunden (Pflicht)
        if (workTime.totalMinutes >= this.config.mandatoryBreakAfter * 60 - 30) {
            this.scheduleMandatoryBreakReminder();
        }
        
        // Arbeitszeitende nach 8 Stunden
        const timeUntilMaxHours = (this.config.maxDailyHours * 60) - workTime.totalMinutes;
        if (timeUntilMaxHours > 0 && timeUntilMaxHours <= 30) {
            this.scheduleWorkEndReminder(timeUntilMaxHours);
        }
        
        // Überstunden-Warnung nach 10 Stunden
        const timeUntilExtendedMax = (this.config.extendedMaxHours * 60) - workTime.totalMinutes;
        if (timeUntilExtendedMax > 0 && timeUntilExtendedMax <= 30) {
            this.scheduleOvertimeWarning(timeUntilExtendedMax);
        }
    }
    
    /**
     * Pausenvorschlag (nach 4-5 Stunden)
     */
    scheduleBreakSuggestion() {
        const timerId = setTimeout(() => {
            this.sendNotification(
                'Pausenvorschlag',
                'Sie arbeiten bereits seit einigen Stunden. Eine kurze Pause würde Ihre Produktivität fördern.',
                'suggestion'
            );
        }, 30 * 60 * 1000); // 30 Minuten Vorlauf
        
        this.timers.set('breakSuggestion', timerId);
    }
    
    /**
     * Pflichtpause-Erinnerung (nach 6 Stunden)
     */
    scheduleMandatoryBreakReminder() {
        const timerId = setTimeout(() => {
            this.sendNotification(
                'Pflichtpause erforderlich',
                `Sie arbeiten seit 6 Stunden. Bitte legen Sie jetzt eine Pause von mindestens ${this.config.minBreakDuration} Minuten ein.`,
                'mandatory'
            );
            this.workSession.lastBreakReminder = new Date();
        }, 30 * 60 * 1000);
        
        this.timers.set('mandatoryBreak', timerId);
    }
    
    /**
     * Arbeitszeitende-Erinnerung
     */
    scheduleWorkEndReminder(minutesUntil) {
        const timerId = setTimeout(() => {
            this.sendNotification(
                'Arbeitszeit beenden',
                `Sie haben ${this.config.maxDailyHours} Stunden erreicht. Bitte beenden Sie Ihre Arbeitszeit oder prüfen Sie einen Überstundenausgleich.`,
                'workEnd'
            );
        }, minutesUntil * 60 * 1000);
        
        this.timers.set('workEnd', timerId);
    }
    
    /**
     * Überstunden-Warnung
     */
    scheduleOvertimeWarning(minutesUntil) {
        const timerId = setTimeout(() => {
            if (!this.workSession.overtimeWarned) {
                this.sendNotification(
                    'Maximale Arbeitszeit erreicht',
                    `Sie haben ${this.config.extendedMaxHours} Stunden erreicht. Dies ist die gesetzliche Höchstarbeitszeit. Bitte beenden Sie Ihre Arbeitszeit umgehend.`,
                    'critical'
                );
                this.workSession.overtimeWarned = true;
            }
        }, minutesUntil * 60 * 1000);
        
        this.timers.set('overtime', timerId);
    }
    
    /**
     * Benachrichtigung senden
     */
    sendNotification(title, message, type = 'info') {
        const notification = {
            title,
            message,
            type,
            timestamp: new Date()
        };
        
        // Browser-Benachrichtigung
        if (this.config.enableBrowser && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: this.getIconForType(type),
                tag: type
            });
        }
        
        // Sound abspielen
        if (this.config.enableSound) {
            this.playNotificationSound(type);
        }
        
        // Callback aufrufen
        this.notifyCallback('notification', notification);
        
        return notification;
    }
    
    /**
     * Aktive Arbeitszeit berechnen (ohne Pausen)
     */
    calculateActiveWorkTime() {
        if (!this.workSession) return { hours: 0, minutes: 0, totalMinutes: 0 };
        
        const now = new Date();
        let totalWorkMinutes = Math.floor((now - this.workSession.startTime) / (1000 * 60));
        
        // Pausen abziehen
        for (const breakItem of this.workSession.breaks) {
            if (breakItem.end) {
                const breakDuration = Math.floor((breakItem.end - breakItem.start) / (1000 * 60));
                totalWorkMinutes -= breakDuration;
            } else {
                // Aktuelle Pause
                const breakDuration = Math.floor((now - breakItem.start) / (1000 * 60));
                totalWorkMinutes -= breakDuration;
            }
        }
        
        const hours = Math.floor(totalWorkMinutes / 60);
        const minutes = totalWorkMinutes % 60;
        
        return { hours, minutes, totalMinutes: totalWorkMinutes };
    }
    
    /**
     * Gesamtarbeitszeit berechnen
     */
    calculateWorkTime(start, end) {
        const totalMinutes = Math.floor((end - start) / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        
        return { hours, minutes, totalMinutes };
    }
    
    /**
     * Wöchentlichen Bericht generieren
     */
    generateWeeklyReport(sessions = []) {
        const totalHours = sessions.reduce((sum, session) => sum + (session.totalHours || 0), 0);
        const totalMinutes = sessions.reduce((sum, session) => sum + (session.totalMinutes || 0), 0);
        
        const finalHours = Math.floor(totalHours + totalMinutes / 60);
        const finalMinutes = totalMinutes % 60;
        
        const message = `Ihre wöchentliche Arbeitszeit: ${finalHours}:${finalMinutes.toString().padStart(2, '0')} Stunden. Bitte überprüfen und senden Sie Ihren Stundenzettel.`;
        
        this.sendNotification('Wochenbericht', message, 'report');
        
        return {
            totalHours: finalHours,
            totalMinutes: finalMinutes,
            sessions: sessions.length,
            message
        };
    }
    
    /**
     * Alle Timer löschen
     */
    clearAllTimers() {
        for (const [name, timerId] of this.timers) {
            clearTimeout(timerId);
        }
        this.timers.clear();
    }
    
    /**
     * Event-Listener registrieren
     */
    on(event, callback) {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event).push(callback);
    }
    
    /**
     * Callback aufrufen
     */
    notifyCallback(event, data) {
        if (this.callbacks.has(event)) {
            this.callbacks.get(event).forEach(callback => callback(data));
        }
    }
    
    /**
     * Icon für Benachrichtigungstyp
     */
    getIconForType(type) {
        const icons = {
            suggestion: '💡',
            mandatory: '⏰',
            workEnd: '🕘',
            critical: '⚠️',
            report: '📊'
        };
        return icons[type] || '📋';
    }
    
    /**
     * Sound für Benachrichtigung
     */
    playNotificationSound(type) {
        // Hier können verschiedene Sounds für verschiedene Typen implementiert werden
        const audio = new Audio();
        switch(type) {
            case 'critical':
                audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj'; // Warnsound
                break;
            default:
                audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj'; // Standard-Sound
        }
        audio.play().catch(() => {}); // Ignoriere Fehler wenn Sound nicht abgespielt werden kann
    }
    
    /**
     * Aktuellen Status abrufen
     */
    getStatus() {
        if (!this.workSession) {
            return { working: false };
        }
        
        const activeTime = this.calculateActiveWorkTime();
        const isOnBreak = this.workSession.breaks.some(b => b.start && !b.end);
        
        return {
            working: true,
            onBreak: isOnBreak,
            startTime: this.workSession.startTime,
            activeHours: activeTime.hours,
            activeMinutes: activeTime.minutes,
            totalBreaks: this.workSession.breaks.filter(b => b.end).length,
            overtimeWarned: this.workSession.overtimeWarned
        };
    }
}

// Export für verschiedene Module-Systeme
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkTimeNotifications;
} else if (typeof window !== 'undefined') {
    window.WorkTimeNotifications = WorkTimeNotifications;
}
