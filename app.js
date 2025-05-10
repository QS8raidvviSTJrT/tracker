        const supabaseUrl = 'https://cnhtbonckcbhqisvcnye.supabase.co'
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuaHRib25ja2NiaHFpc3ZjbnllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5NDkxNDIsImV4cCI6MjA1MTUyNTE0Mn0.0pDchqR5hD-NIoqlgeGYDCmQW2yCRwME_S0tjo8nd88'
        const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

        let deferredPrompt;

        function isIos() {
            // Überprüfung auf iOS-Geräte ohne navigator.platform
            const userAgent = navigator.userAgent
            return /iPhone|iPad|iPod/.test(userAgent) || 
                   (userAgent.includes("Mac") && "ontouchend" in document);
        }
        
        function isInStandaloneMode() {
            // Prüft, ob die App im Standalone-Modus läuft
            return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
        }

        window.addEventListener('load', () => {
            const installPopup = document.getElementById('installPopup');
            const installMessage = document.getElementById('installMessage');
            const installButton = document.getElementById('installButton');
            const isAppInstalled = isInStandaloneMode();

        if (isAppInstalled) {
            installPopup.style.display = 'none';
            return; // Popup nicht anzeigen, wenn die App installiert ist
        }

        if (isIos()) {
            installPopup.style.display = 'flex';
            installMessage.innerHTML = 'Um diese App zu installieren, tippe auf <span class="material-icons" style="vertical-align: 1%; font-size: 1.2rem;">ios_share</span> und suche nach "Zum Home-Bildschirm <span class="material-symbols-outlined" style="vertical-align: top; font-size: 1.2rem;">add_box</span>"';
            installButton.style.display = 'none'; // Verberge den Install-Button für iOS
        } else {
            console.log("Kein iOS-Gerät oder nicht Safari erkannt.");
            console.log(navigator.userAgent)
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                installPopup.style.display = 'flex';
            });

            installButton.addEventListener('click', () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') {
                            console.log('Benutzer hat das Installations-Popup akzeptiert.');
                        }
                        deferredPrompt = null;
                        installPopup.style.display = 'none';
                    });
                }
            });
        }
    });

        // document.getElementById('closePopupButton').addEventListener('click', () => {
        //    document.getElementById('installPopup').style.display = 'none';
        // });


        const audioBase64 = `data:audio/mp3;base64,//uQRAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA AAAAAAAAAAAAAAAAAAAAAAAA//sQZAAP8AAAaQAAAAgAAA0gAAABAAAB/hQAACAAADSCgAAE/5hb aqZg2IP+gPCAHIRAMkkc/xgAggDDCOaz32Pf8xCBIEgGa2E+ZKhL/++1Ru40BZiGCphQNn//rXGg KLkmC4CmTA3/+9BkIgALJ4TJBnegAAAADSDAAAAPMV9P/aQACAAANIOAAAQGEgtGPZumHxif//4Q J5fEwXAcoEYwCA8zrLwx8JswxHoxpM4xjc////8w7BswhAOGS+YODAuWZzlQcglgbjBca+n6ZAkm Y7Dt////8aSQZXA8MPCwcxLE0wtBsw6BQwnA8VAgwGB0wRAL/////9v5a48D2Kd+44/BhaCxgwBI sDRcZCegkXKHBELBJ///////zcBMEqvUtSHWZIDFCFgjCgHTDUGDEAAjEoEzEUBAgbDDYHzCkKDA gJzEgZTEscP/////////wcBi9G6KWQOyBklmDHEimqTvmMwEmWQilZTmRQfCxEBBFmGABGEgCmD4 BEwYA4NQ4EgwFBIAFj////////////////////fzw///////////////2sUEvciz+SLGAAYpQCZm ofA4szFMVhpc1eABAIOLwZknMyow4gODHNFKXMuCEmWBscSP9SRUPTYKFlhtSRUVFRa5qG/ZryQ5 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 8P49TnmgFygAAA0gAAABBCxFNeCBpKAAADSAAAAEAA44AAA+gid//oDACxCR+w8h6/AIgGoB//YS sVn/Xkp9TEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xBk+oDw7xBO+CBouAAA DSAAAAEDhEE94IFCwAAANIAAAARVVVUAUC8AcYAAAU/QYr/+oYgfYEi/T0hAASn//OAACVJMQU1F My45OS41qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7EGT3CfD0EU54DWLIAAANIAAAAQKEQT3g KYsgAAA0gAAABKqqqqqqAgAFAFAAAAHqJjf/oBoBAjaZBB//1AnCF/1ak0xBTUUzLjk5LjVVVVVV VVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZPUB8NUQzXgNeVgAAA0gAAABAohDNcCBpKAAADSAAAAE VVVVVVVVAAICIAAO//qE0K6fiuRHoTBf/zgJAPN+GVXoTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVV VVVVVVVVVVVVVVX/+xBk8wnw3BDNaA1heAAADSAAAAEB5EM34DVKYAAANIAAAARVVVVVVVVVAAMD MAAf/+gTgY39/UQEYGf/1CWEXfhI5pVMQU1FMy45OS41VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV Vf/7EGTqjfB/EE1wClrKAAANIAAAAQEsQTZgNYzoAAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVXI AA6hJBvEfI9PQJg7FUxBTUUzLjk5LjVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQZPCB8JIQ TPgCUooAAA0gAAABAlxBK6UBrmAAADSAAAAEVVVVVVVVVVVVVVVVVYAl9ACg5/yX////57/////r 8FVVTEFNRTMuOTkuNVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xBk8AnwuBDM+CBROAAADSAA AAEBuEEnQAmqYAAANIAAAARVVVVVACAFM7wGI/////qb+n///1aqBMn////7/////lVMQU1FMy45 OS41VVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/7EGTsifClEMxoCmF4AAANIAAAAQEgQyaAHWzw AAA0gAAABFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/8SkxBTUUzLjk5LjWqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqq//sQZOuJ8I4RSuggUToAAA0gAAABAURBJKAFTDAAADSAAAAEqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqr/+xBk6wnweRDKyApjPAAADSAAAAEBfEMiwAVMIAAANIAAAASqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy45OS41qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7 EGTqifBrEMnICks4AAANIAAAAQGEQyMgKWzgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqkxBTUUzLjk5LjWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sQZOSN8E0QyJAK TIgAAA0gAAABAHRDIgAo0jAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq TEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+xBk543wiBDGiCA48AAADSAAAAEA SEEkAADj8AAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqpMQU1FMy45OS41 qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7EGTsD/CFEEaoAGD0AAANIAAAAQGEQRwAAUPQAAA0 gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqkxBTUUzLjk5LjWqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqq//sQZN8P8BcAxoAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqTEFNRTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqr/+xBk3Y/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqpMQU1FMy45OS41qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7EGTd j/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqkxBTUUzLjk5LjWqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sQZN2P8AAAaQAAAAgA AA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqTEFN RTMuOTkuNaqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+xBk3Y/wAABpAAAACAAADSAAAAEAAAGk AAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7EGTdj/AAAGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAA BKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqq//sQZN2P8AAAaQAAAAgAAA0gAAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqr/+xBk3Y/wAABpAAAACAAADSAAAAEAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqv/7EGTdj/AA AGkAAAAIAAANIAAAAQAAAaQAAAAgAAA0gAAABKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq//sQZN2P8AAAaQAAAAgAAA0g AAABAAABpAAAACAAADSAAAAEqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqr/+xBk3Y/wAABpAAAACAAADSAAAAEAAAGkAAAA IAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq qqqqqqqqqqqqqqqqqqqqqqqqqg==`;
        const audioApplePay = new Audio(audioBase64);

        let currentUser = null;
        let currentMonthData = {
                income: 0,
                requiredDonation: 0,
                actualDonation: 0
        };
        
        const amountInput = document.getElementById('amount');

        function addNumber(num) {
            amountInput.value = amountInput.value + num;
        }

        function clearAmount() {
            amountInput.value = '';
        }

        function removeLast() {
            amountInput.value = amountInput.value.slice(0, -1);
        }

        // Session-Check-Funktion
        async function checkSession() {
            const { data: { session }, error } = await supabaseClient.auth.getSession();
            
            if (error) {
                console.error('Error checking session:', error.message);
                return;
            }
            
            if (session) {
                currentUser = session.user;
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'block';
                loadData();
            }
        }

        // Auth State Change Listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                currentUser = session.user;
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('appContainer').style.display = 'block';
                loadData();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                document.getElementById('loginContainer').style.display = 'block';
                document.getElementById('appContainer').style.display = 'none';
            }
        });

        // Login Funktion
        window.login = async function() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                alert('Fehler beim Login: ' + error.message);
                return;
            }
        };

        // Register Funktion
        window.register = async function() {
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password
            });

            if (error) {
                alert('Registrierung fehlgeschlagen: ' + error.message);
                return;
            }

                alert('Registrierung erfolgreich! Bitte E-Mail-Adresse bestätigen.');
        };

        // Logout Funktion
        window.logout = async function() {
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                alert('Fehler beim Logout: ' + error.message);
                return;
            }
        };

        // Load Data Funktion
        async function loadData() {
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            
            const { data, error } = await supabaseClient
                .from('entries')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('month', currentMonth);

            if (error) {
                alert('Fehler beim Laden der Daten: ' + error.message);
                return;
            }

            updateCurrentMonthData(data);
            await loadHistory();
        }

        // Update Current Month Data Funktion
        async function updateCurrentMonthData(entries) {
        const decimalPlaces = 2; // Anzahl der gewünschten Nachkommastellen
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Alle vorherigen Monate laden
        const { data: historicalData } = await supabaseClient
            .from('entries')
            .select('*')
            .eq('user_id', currentUser.id)
            .lt('month', currentMonth);
    
        // Fehlende Spenden aus der Vergangenheit berechnen
        const missingDonations = historicalData.reduce((acc, entry) => {
            if (!acc[entry.month]) {
                acc[entry.month] = { income: 0, donations: 0 };
            }
            if (entry.type === 'income') {
                acc[entry.month].income = (acc[entry.month].income || 0) + entry.amount;
            } else if (entry.type === 'donation') {
                acc[entry.month].donations = (acc[entry.month].donations || 0) + entry.amount;
            }
            return acc;
        }, {});
    
        let totalMissingDonations = 0;
        Object.values(missingDonations).forEach(month => {
            const required = parseFloat((month.income * 0.1).toFixed(decimalPlaces));
            if (month.donations < required) {
                totalMissingDonations += parseFloat((required - month.donations).toFixed(decimalPlaces));
            }
        });
                
        currentMonthData.income = parseFloat(
            entries
                .filter(entry => entry.type === 'income')
                .reduce((sum, entry) => sum + entry.amount, 0)
                .toFixed(decimalPlaces)
        );
    
        const totalRequiredDonation = parseFloat(
            (currentMonthData.income * 0.1).toFixed(decimalPlaces)
        );
    
        const totalActualDonation = parseFloat(
            entries
                .filter(entry => entry.type === 'donation')
                .reduce((sum, entry) => sum + entry.amount, 0)
                .toFixed(decimalPlaces)
        );
    
        // requiredDonation berücksichtigt jetzt die bisherigen Spenden
        currentMonthData.requiredDonation = parseFloat(
            Math.max(totalRequiredDonation - totalActualDonation + totalMissingDonations).toFixed(decimalPlaces)
        );
    
        currentMonthData.actualDonation = totalActualDonation;
    
        updateUI();
        }
            

        // Load History Funktion
        async function loadHistory() {
            const { data, error } = await supabaseClient
                .from('entries')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('month', { ascending: false });

            if (error) {
                alert('Fehler beim Laden der Historie: ' + error.message);
                return;
            }

            const monthlyData = data.reduce((acc, entry) => {
                if (!acc[entry.month]) {
                    acc[entry.month] = { income: 0, donations: 0 };
                }
                if (entry.type === 'income') {
                    acc[entry.month].income += entry.amount;
                } else {
                    acc[entry.month].donations += entry.amount;
                }
                return acc;
            }, {});

            updateHistoryUI(monthlyData);
        }

        // Update History UI Funktion
        function updateHistoryUI(monthlyData) {
            const historyList = document.getElementById('historyList');
            historyList.innerHTML = '';

            Object.entries(monthlyData).forEach(([month, data]) => {
                const requiredDonation = data.income * 0.1;
                const className = data.donations >= requiredDonation ? 'success' : 'danger';
                
                const item = document.createElement('div');
                item.className = `history-item ${className}`;
                item.innerHTML = `
                    <div>${month}</div>
                    <div>
                    💶${data.income} € | ⛪${data.donations} €
                    <span class="edit-icon" onclick="showEditModal('${month}')">✏️</span>
                    </div>
                `;
                historyList.appendChild(item);
            });
        }

        async function showEditModal(month) {
            const { data, error } = await supabaseClient
                .from('entries')
                .select('*')
                .eq('user_id', currentUser.id)
                .eq('month', month);
        
            if (error) {
                alert('Fehler beim Laden der Einträge: ' + error.message);
                return;
            }
        
            const entriesList = document.getElementById('entriesList');
            entriesList.innerHTML = '';
            
            data.forEach(entry => {
                const div = document.createElement('div');
                div.className = 'entry-item';
                div.innerHTML = `
                    <span>${entry.type === 'income' ? 'Einnahme' : 'Spende'}: ${entry.amount} €</span>
                    <div>
                        <span onclick="editEntry('${entry.id}', ${entry.amount})">✏️ Ändern</span>
                        <span onclick="deleteEntry('${entry.id}')">❌</span>
                    </div>
                `;
                entriesList.appendChild(div);
            });
        
            document.getElementById('editModal').style.display = 'flex';
        }
        
        function closeEditModal() {
            document.getElementById('editModal').style.display = 'none';
        }
        
        async function deleteEntry(id) {
            if (!confirm('Möchtest du diesen Eintrag wirklich löschen?')) return;
        
            const { error } = await supabaseClient
                .from('entries')
                .delete()
                .match({ id });
        
            if (error) {
                alert('Fehler beim Löschen: ' + error.message);
                return;
            }
        
            loadData();
            closeEditModal();
        }
        
        async function editEntry(id, currentAmount) {
            const newAmount = prompt('Neuer Betrag:', currentAmount);
            if (!newAmount) return;
        
            const { error } = await supabaseClient
                .from('entries')
                .update({ amount: parseFloat(newAmount) })
                .match({ id });
        
            if (error) {
                alert('Fehler beim Aktualisieren: ' + error.message);
                return;
            }
        
            loadData();
            closeEditModal();
        }
        
        // Update UI Funktion
        function updateUI() {
            document.querySelector('.current-amount').textContent = `${currentMonthData.income} €`;
            document.querySelector('.required-donation').textContent = `${currentMonthData.requiredDonation} €`;
            document.querySelector('.actual-donation').textContent = `${currentMonthData.actualDonation} €`;
            
            
            const requiredElement = document.querySelector('.required-donation');
            if (currentMonthData.requiredDonation <= 0) {
                requiredElement.style.color = 'var(--success-color)';
            } else {
                requiredElement.style.color = 'var(--danger-color)';
            }
        }

        function showModal() {
            document.getElementById('entryDate').valueAsDate = new Date();
            document.getElementById('entryModal').style.display = 'flex';
        }

        function closeModal() {
            document.getElementById('entryModal').style.display = 'none';
        }

        async function saveEntry() {
            const amount = parseFloat(document.getElementById('amount').value);
            const type = document.querySelector('input[name="entryType"]:checked').value;
            const date = document.getElementById('entryDate').value;
            const [year, month] = date.split('-');
            const entryMonth = `${year}-${month}`;

            const { error } = await supabaseClient
                .from('entries')
                .insert([
                    {
                        user_id: currentUser.id,
                        type,
                        amount,
                        month: entryMonth
                    }
                ]);

            if (error) {
                alert('Fehler beim Speichern: ' + error.message);
                return;
            }
            
            if (type == 'donation') {
                audioApplePay.currentTime = 0; // Reset time to play from the start
                audioApplePay.play(); // Play the sound
            } else {
                audioApplePay.currentTime = 0; // Reset time to play from the start
                audioApplePay.play(); // Play the sound
            }
            
            closeModal();
            loadData();
        }

        // Event-Listener für ESC-Taste zum Schließen des Modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        });

        
        function registerNow() {
            document.getElementById('register').classList.remove('hidden');
            document.getElementById('login').classList.add('hidden');
            document.getElementById('registerText').style.display = 'none';
            const item2 = document.createElement('div');
            item2.innerHTML = `
            <div>
            <a href="/" style="text-decoration: none; color: white;">Du hast bereits ein Konto? <u>Anmelden</u></a>
            </div>
            `;
            document.getElementById('loginContainer').appendChild(item2);
        }
        

        // Initial session check
        checkSession();