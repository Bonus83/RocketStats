const TEXT = {
  de: {
    connecting: "Verbinde mit lokaler Stats-API…", connected: "Stats-API verbunden", disconnected: "Stats-API getrennt",
    matchTag: "LIVE-MATCH", matchHeading: "Spielübersicht", rankedHeading: "Rang & Bilanz",
    historyHeading: "MMR-Verlauf", historyMode: "Modus", historyDate: "Datum", historyChange: "Änderung zum vorherigen Wert", historyEmpty: "Noch keine MMR-Werte für diesen Modus.", historyPoints: "Werte",
    statsTag: "SPIELERSTATISTIKEN", statsHeading: "Match-Statistiken", statsScopeTag: "STATISTIKEN",
    allModes: "Alle Modi", currentMode: "Aktueller Modus", switchScope: "Ansicht umschalten",
    period: "Zeitraum", periodSession: "Aktuelle Session", periodCleared: "Seit Zurücksetzen", periodAlltime: "Gesamt",
    newSession: "Neue Session", newSessionConfirm: "Neue Session starten? Die Statistik der aktuellen Session beginnt dann bei null; ältere Spiele bleiben unter \u201eSeit Zurücksetzen\u201c und \u201eGesamt\u201c erhalten.",
    sessionPrompt: (count) => `Die letzte Session enthält ${count} ${count === 1 ? "Spiel" : "Spiele"}. Fortsetzen oder neue Session starten?`,
    sessionNew: "Neue Session starten", sessionContinue: "Session fortsetzen", sessionError: "Die Session konnte nicht geändert werden.",
    reset: "Sieg/Niederlage zurücksetzen", language: "Sprache", port: "Lokaler API-Port", apply: "Übernehmen",
    setupButton: "Lokale Stats-API einrichten",
    setupConfirm: "Rocket League muss geschlossen sein. Es werden ausschließlich Port und PacketSendRate in der Stats-API-Konfiguration geändert. Eine vorhandene Datei wird vorher gesichert; falls sie fehlt, wird sie erstellt. Fortfahren?",
    setupSuccess: "Stats-API eingerichtet. Starte Rocket League neu, damit sie den Feed bereitstellt.",
    alreadyConfigured: "Stats-API war bereits eingerichtet. Starte Rocket League neu, falls der Feed noch nicht verfügbar ist.",
    resetConfirm: "Sieg/Niederlage und Streak für den ausgewählten Bereich dieses Kontos zurücksetzen? MMR und andere Rekorde bleiben erhalten.",
    resetError: "Statistiken konnten nicht zurückgesetzt werden.", scopeError: "Ansicht konnte nicht geändert werden.",
    settingsError: "Einstellung konnte nicht gespeichert werden.", setup: "Einrichtungshinweis",
    noData: "Warte auf Matchdaten…", score: "Spielstand", timer: "Spielzeit", boost: "Boost",
    banner: "Ereignis", lastGoal: "Letztes Tor", streak: "Streak", mmr: "MMR", queue: "Matchsuche",
    ban: "Sperre", speed: "Geschwindigkeit", ping: "Ping", possession: "Ballbesitz", records: "Rekorde",
    goals: "Tore", assists: "Vorlagen", saves: "Paraden", shots: "Schüsse", demos: "Demos",
    resets: "Flip Resets", touches: "Ballkontakte", playerScore: "Punkte", rank: "Rang",
    mmrWl: "MMR + S/N",
    menu: "Menü", updateTitle: "Anwendungsupdates", updateAuto: "Automatisch nach Updates suchen",
    updateShow: "Update-Status anzeigen", updateClose: "Update-Hinweis schließen",
    updateCheck: "Nach Updates suchen", updateDownload: "Herunterladen", updateInstall: "Installieren und neu starten",
    updateConfirm: "Dieses Update installieren und RocketStats neu starten? Deine Kontodaten bleiben erhalten.",
    updateMatchActive: "Ein Match läuft. Während des Neustarts von RocketStats können Matchereignisse oder das Ergebnis verloren gehen. Installiere möglichst nach dem Match.",
    updateMatchUnknown: "Der Matchstatus kann nicht ermittelt werden. Falls gerade ein Match läuft, können während des Neustarts Matchereignisse oder das Ergebnis verloren gehen.",
    updateNetwork: "Updateprüfungen kontaktieren GitHub. Es werden keine Spiel- oder Kontodaten übertragen.",
    update_starting: "Updater wird gestartet…", update_unconfigured: "Keine Updatequelle eingerichtet.",
    update_development: "Updates sind im Entwicklungsmodus deaktiviert.", update_unsupported: "Updates sind nur für die installierte Windows-Version verfügbar.",
    update_idle: "Bereit zur Updateprüfung.", update_checking: "Suche nach einer neuen Version…", update_current: "Du verwendest die aktuelle Version.",
    update_available: "Neue Version verfügbar:", update_downloading: "Update wird heruntergeladen:",
    update_downloaded: "Update heruntergeladen und bereit zur Installation:", update_installing: "Update wird installiert…",
    update_error: "Update fehlgeschlagen. Prüfe die Verbindung und versuche es erneut."
  },
  en: {
    connecting: "Connecting to local Stats API…", connected: "Stats API connected", disconnected: "Stats API disconnected",
    matchTag: "LIVE MATCH", matchHeading: "Match overview", rankedHeading: "Rank & record",
    historyHeading: "MMR history", historyMode: "Mode", historyDate: "Date", historyChange: "Change from previous", historyEmpty: "No MMR values for this mode yet.", historyPoints: "values",
    statsTag: "PLAYER STATS", statsHeading: "Match statistics", statsScopeTag: "STATISTICS",
    allModes: "All modes", currentMode: "Current mode", switchScope: "Switch scope",
    period: "Period", periodSession: "Current session", periodCleared: "Since reset", periodAlltime: "All time",
    newSession: "New session", newSessionConfirm: "Start a new session? Session stats start from zero; older matches stay in \u201cSince reset\u201d and \u201cAll time\u201d.",
    sessionPrompt: (count) => `The last session has ${count} ${count === 1 ? "match" : "matches"}. Continue it or start a new session?`,
    sessionNew: "Start new session", sessionContinue: "Continue session", sessionError: "The session could not be changed.",
    reset: "Reset W/L", language: "Language", port: "Local API port", apply: "Apply",
    setupButton: "Set up local Stats API",
    setupConfirm: "Rocket League must be closed. This changes only Port and PacketSendRate in its Stats API configuration. An existing file is backed up; if absent, it is created. Continue?",
    setupSuccess: "Stats API configured. Restart Rocket League so it starts the feed.",
    alreadyConfigured: "Stats API was already configured. Restart Rocket League if the feed is not available yet.",
    resetConfirm: "Reset wins/losses and streak for this account in the selected scope? MMR and other records are kept.",
    resetError: "Could not reset statistics.", scopeError: "Could not change scope.",
    settingsError: "Could not save setting.", setup: "Setup notice",
    noData: "Waiting for match data…", score: "Score", timer: "Match time", boost: "Boost",
    banner: "Event", lastGoal: "Last goal", streak: "Streak", mmr: "MMR", queue: "Matchmaking",
    ban: "Ban", speed: "Speed", ping: "Ping", possession: "Possession", records: "Records",
    goals: "Goals", assists: "Assists", saves: "Saves", shots: "Shots", demos: "Demos",
    resets: "Flip resets", touches: "Touches", playerScore: "Points", rank: "Rank",
    mmrWl: "MMR + W/L",
    menu: "Menu", updateTitle: "Application updates", updateAuto: "Automatically check for updates",
    updateShow: "Show update status", updateClose: "Close update notification",
    updateCheck: "Check for updates", updateDownload: "Download", updateInstall: "Install and restart",
    updateConfirm: "Install this update and restart RocketStats? Your account data will be kept.",
    updateMatchActive: "A match is in progress. Match events or the result may be missed while RocketStats restarts. Consider installing after the match.",
    updateMatchUnknown: "The match status could not be determined. If a match is in progress, its events or result may be missed while RocketStats restarts.",
    updateNetwork: "Update checks contact GitHub. No game or account data is transmitted.",
    update_starting: "Starting updater…", update_unconfigured: "No update source is configured.",
    update_development: "Updates are disabled in development mode.", update_unsupported: "Updates are available only in the installed Windows version.",
    update_idle: "Ready to check for updates.", update_checking: "Checking for a new version…", update_current: "You are using the latest version.",
    update_available: "New version available:", update_downloading: "Downloading update:",
    update_downloaded: "Update downloaded and ready to install:", update_installing: "Installing update…",
    update_error: "Update failed. Check your connection and try again."
  },
  pl: {
    connecting: "Łączenie z lokalnym Stats API…", connected: "Połączono ze Stats API", disconnected: "Rozłączono ze Stats API",
    matchTag: "MECZ NA ŻYWO", matchHeading: "Podsumowanie meczu", rankedHeading: "Ranga i bilans",
    historyHeading: "Historia MMR", historyMode: "Tryb", historyDate: "Data", historyChange: "Zmiana od poprzedniego punktu", historyEmpty: "Brak wartości MMR dla tego trybu.", historyPoints: "wartości",
    statsTag: "STATYSTYKI GRACZA", statsHeading: "Statystyki meczu", statsScopeTag: "STATYSTYKI",
    allModes: "Wszystkie tryby", currentMode: "Bieżący tryb", switchScope: "Zmień zakres",
    period: "Okres", periodSession: "Bieżąca sesja", periodCleared: "Od resetu", periodAlltime: "Cały czas",
    newSession: "Nowa sesja", newSessionConfirm: "Rozpocząć nową sesję? Statystyki sesji zaczną się od zera; starsze mecze pozostaną w \u201eOd resetu\u201d i \u201eCały czas\u201d.",
    sessionPrompt: (count) => `Ostatnia sesja zawiera meczów: ${count}. Kontynuować ją czy rozpocząć nową?`,
    sessionNew: "Nowa sesja", sessionContinue: "Kontynuuj sesję", sessionError: "Nie udało się zmienić sesji.",
    reset: "Reset W/P", language: "Język", port: "Lokalny port API", apply: "Zastosuj",
    setupButton: "Skonfiguruj lokalne Stats API",
    setupConfirm: "Rocket League musi być zamknięte. Zmienione zostaną wyłącznie Port i PacketSendRate w konfiguracji Stats API. Istniejący plik zostanie wcześniej skopiowany; jeśli go nie ma, zostanie utworzony. Kontynuować?",
    setupSuccess: "Skonfigurowano Stats API. Uruchom ponownie Rocket League, aby rozpocząć udostępnianie danych.",
    alreadyConfigured: "Stats API było już skonfigurowane. Jeśli dane nie są dostępne, uruchom ponownie Rocket League.",
    resetConfirm: "Zresetować zwycięstwa, porażki i serię dla wybranego zakresu tego konta? MMR i pozostałe rekordy pozostaną.",
    resetError: "Nie można zresetować statystyk.", scopeError: "Nie można zmienić zakresu.",
    settingsError: "Nie można zapisać ustawienia.", setup: "Informacja o konfiguracji",
    noData: "Oczekiwanie na dane meczu…", score: "Wynik", timer: "Czas meczu", boost: "Dopalacz",
    banner: "Zdarzenie", lastGoal: "Ostatni gol", streak: "Seria", mmr: "MMR", queue: "Wyszukiwanie meczu",
    ban: "Blokada", speed: "Prędkość", ping: "Ping", possession: "Posiadanie piłki", records: "Rekordy",
    goals: "Gole", assists: "Asysty", saves: "Obrony", shots: "Strzały", demos: "Demolki",
    resets: "Flip reset", touches: "Kontakty", playerScore: "Punkty", rank: "Ranga",
    mmrWl: "MMR + W/P",
    menu: "Menu", updateTitle: "Aktualizacje aplikacji", updateAuto: "Automatycznie sprawdzaj aktualizacje",
    updateShow: "Pokaż stan aktualizacji", updateClose: "Zamknij powiadomienie o aktualizacji",
    updateCheck: "Sprawdź aktualizacje", updateDownload: "Pobierz", updateInstall: "Zainstaluj i uruchom ponownie",
    updateConfirm: "Zainstalować tę aktualizację i ponownie uruchomić RocketStats? Dane kont pozostaną zachowane.",
    updateMatchActive: "Trwa mecz. Podczas ponownego uruchamiania RocketStats zdarzenia lub wynik meczu mogą nie zostać zapisane. Najlepiej zainstalować aktualizację po meczu.",
    updateMatchUnknown: "Nie można ustalić, czy trwa mecz. Jeśli tak, zdarzenia lub wynik mogą nie zostać zapisane podczas ponownego uruchamiania RocketStats.",
    updateNetwork: "Sprawdzanie aktualizacji łączy się z GitHub. Dane gry i kont nie są przesyłane.",
    update_starting: "Uruchamianie aktualizatora…", update_unconfigured: "Nie skonfigurowano źródła aktualizacji.",
    update_development: "Aktualizacje są wyłączone w trybie deweloperskim.", update_unsupported: "Aktualizacje są dostępne tylko w zainstalowanej wersji Windows.",
    update_idle: "Gotowe do sprawdzenia aktualizacji.", update_checking: "Sprawdzanie nowej wersji…", update_current: "Używasz najnowszej wersji.",
    update_available: "Dostępna nowa wersja:", update_downloading: "Pobieranie aktualizacji:",
    update_downloaded: "Aktualizacja pobrana i gotowa do instalacji:", update_installing: "Instalowanie aktualizacji…",
    update_error: "Aktualizacja nie powiodła się. Sprawdź połączenie i spróbuj ponownie."
  },
  fr: {
    connecting: "Connexion à l’API Stats locale…", connected: "API Stats connectée", disconnected: "API Stats déconnectée",
    matchTag: "MATCH EN DIRECT", matchHeading: "Aperçu du match", rankedHeading: "Rang et bilan",
    historyHeading: "Historique MMR", historyMode: "Mode", historyDate: "Date", historyChange: "Écart depuis le point précédent", historyEmpty: "Aucune valeur MMR pour ce mode.", historyPoints: "valeurs",
    statsTag: "STATS DU JOUEUR", statsHeading: "Statistiques du match", statsScopeTag: "STATISTIQUES",
    allModes: "Tous les modes", currentMode: "Mode actuel", switchScope: "Changer la portée",
    period: "Période", periodSession: "Session actuelle", periodCleared: "Depuis la réinitialisation", periodAlltime: "Depuis toujours",
    newSession: "Nouvelle session", newSessionConfirm: "Démarrer une nouvelle session ? Les stats de session repartent de zéro ; les anciens matchs restent dans « Depuis la réinitialisation » et « Depuis toujours ».",
    sessionPrompt: (count) => `La dernière session contient ${count} match${count === 1 ? "" : "s"}. La poursuivre ou en démarrer une nouvelle ?`,
    sessionNew: "Nouvelle session", sessionContinue: "Poursuivre la session", sessionError: "Impossible de modifier la session.",
    reset: "Réinitialiser V/D", language: "Langue", port: "Port API local", apply: "Appliquer",
    setupButton: "Configurer l’API Stats locale",
    setupConfirm: "Rocket League doit être fermé. Seuls Port et PacketSendRate seront modifiés dans sa configuration Stats API. Le fichier existant sera sauvegardé ; s’il n’existe pas, il sera créé. Continuer ?",
    setupSuccess: "API Stats configurée. Redémarrez Rocket League pour démarrer le flux.",
    alreadyConfigured: "L’API Stats était déjà configurée. Redémarrez Rocket League si le flux n’est pas encore disponible.",
    resetConfirm: "Réinitialiser les victoires/défaites et la série de ce compte dans la portée choisie ? Le MMR et les autres records sont conservés.",
    resetError: "Impossible de réinitialiser les statistiques.", scopeError: "Impossible de changer la portée.",
    settingsError: "Impossible d’enregistrer le paramètre.", setup: "Information de configuration",
    noData: "En attente des données du match…", score: "Score", timer: "Temps de match", boost: "Boost",
    banner: "Événement", lastGoal: "Dernier but", streak: "Série", mmr: "MMR", queue: "Recherche de match",
    ban: "Suspension", speed: "Vitesse", ping: "Ping", possession: "Possession", records: "Records",
    goals: "Buts", assists: "Passes décisives", saves: "Arrêts", shots: "Tirs", demos: "Démolitions",
    resets: "Flip resets", touches: "Touches", playerScore: "Points", rank: "Rang",
    mmrWl: "MMR + V/D",
    menu: "Menu", updateTitle: "Mises à jour", updateAuto: "Rechercher automatiquement les mises à jour",
    updateShow: "Afficher l’état des mises à jour", updateClose: "Fermer la notification de mise à jour",
    updateCheck: "Rechercher", updateDownload: "Télécharger", updateInstall: "Installer et redémarrer",
    updateConfirm: "Installer cette mise à jour et redémarrer RocketStats ? Vos données de compte seront conservées.",
    updateMatchActive: "Un match est en cours. Pendant le redémarrage de RocketStats, des événements ou le résultat du match peuvent ne pas être enregistrés. Installez de préférence la mise à jour après le match.",
    updateMatchUnknown: "Impossible de déterminer si un match est en cours. Si c’est le cas, des événements ou le résultat peuvent ne pas être enregistrés pendant le redémarrage de RocketStats.",
    updateNetwork: "Les recherches contactent GitHub. Aucune donnée de jeu ou de compte n’est transmise.",
    update_starting: "Démarrage des mises à jour…", update_unconfigured: "Aucune source de mise à jour n’est configurée.",
    update_development: "Les mises à jour sont désactivées en développement.", update_unsupported: "Les mises à jour sont réservées à la version Windows installée.",
    update_idle: "Prêt à rechercher les mises à jour.", update_checking: "Recherche d’une nouvelle version…", update_current: "Vous utilisez la dernière version.",
    update_available: "Nouvelle version disponible :", update_downloading: "Téléchargement :",
    update_downloaded: "Mise à jour téléchargée et prête à installer :", update_installing: "Installation…",
    update_error: "Échec de la mise à jour. Vérifiez la connexion et réessayez."
  },
  es: {
    connecting: "Conectando a Stats API local…", connected: "Stats API conectada", disconnected: "Stats API desconectada",
    matchTag: "PARTIDA EN VIVO", matchHeading: "Resumen de partida", rankedHeading: "Rango y registro",
    historyHeading: "Historial de MMR", historyMode: "Modo", historyDate: "Fecha", historyChange: "Cambio desde el punto anterior", historyEmpty: "Aún no hay valores de MMR para este modo.", historyPoints: "valores",
    statsTag: "ESTADÍSTICAS", statsHeading: "Estadísticas de partida", statsScopeTag: "ESTADÍSTICAS",
    allModes: "Todos los modos", currentMode: "Modo actual", switchScope: "Cambiar ámbito",
    period: "Periodo", periodSession: "Sesión actual", periodCleared: "Desde el reinicio", periodAlltime: "Todo el tiempo",
    newSession: "Nueva sesión", newSessionConfirm: "¿Iniciar una nueva sesión? Las estadísticas de la sesión empiezan de cero; las partidas anteriores siguen en «Desde el reinicio» y «Todo el tiempo».",
    sessionPrompt: (count) => `La última sesión tiene ${count} ${count === 1 ? "partida" : "partidas"}. ¿Continuarla o iniciar una nueva?`,
    sessionNew: "Nueva sesión", sessionContinue: "Continuar sesión", sessionError: "No se pudo cambiar la sesión.",
    reset: "Restablecer V/D", language: "Idioma", port: "Puerto API local", apply: "Aplicar",
    setupButton: "Configurar Stats API local",
    setupConfirm: "Rocket League debe estar cerrado. Solo se cambiarán Port y PacketSendRate en su configuración de Stats API. Se guardará una copia del archivo existente; si no existe, se creará. ¿Continuar?",
    setupSuccess: "Stats API configurada. Reinicia Rocket League para iniciar el flujo.",
    alreadyConfigured: "Stats API ya estaba configurada. Reinicia Rocket League si el flujo aún no está disponible.",
    resetConfirm: "¿Restablecer victorias/derrotas y racha de esta cuenta en el ámbito seleccionado? Se conservan el MMR y otros récords.",
    resetError: "No se pudieron restablecer las estadísticas.", scopeError: "No se pudo cambiar el ámbito.",
    settingsError: "No se pudo guardar el ajuste.", setup: "Aviso de configuración",
    noData: "Esperando datos de partida…", score: "Marcador", timer: "Tiempo", boost: "Turbo",
    banner: "Evento", lastGoal: "Último gol", streak: "Racha", mmr: "MMR", queue: "Búsqueda",
    ban: "Sanción", speed: "Velocidad", ping: "Ping", possession: "Posesión", records: "Récords",
    goals: "Goles", assists: "Asistencias", saves: "Paradas", shots: "Tiros", demos: "Derribos",
    resets: "Flip resets", touches: "Toques", playerScore: "Puntos", rank: "Rango",
    mmrWl: "MMR + V/D",
    menu: "Menú", updateTitle: "Actualizaciones", updateAuto: "Buscar actualizaciones automáticamente",
    updateShow: "Mostrar estado de actualización", updateClose: "Cerrar aviso de actualización",
    updateCheck: "Buscar actualizaciones", updateDownload: "Descargar", updateInstall: "Instalar y reiniciar",
    updateConfirm: "¿Instalar esta actualización y reiniciar RocketStats? Se conservarán los datos de las cuentas.",
    updateMatchActive: "Hay una partida en curso. Durante el reinicio de RocketStats podrían no registrarse eventos o el resultado. Es preferible instalar la actualización después de la partida.",
    updateMatchUnknown: "No se puede determinar si hay una partida en curso. Si la hay, podrían no registrarse eventos o el resultado durante el reinicio de RocketStats.",
    updateNetwork: "La búsqueda contacta con GitHub. No se transmiten datos del juego ni de las cuentas.",
    update_starting: "Iniciando actualizador…", update_unconfigured: "No hay una fuente de actualizaciones configurada.",
    update_development: "Las actualizaciones están desactivadas en desarrollo.", update_unsupported: "Las actualizaciones solo están disponibles en la versión instalada de Windows.",
    update_idle: "Listo para buscar actualizaciones.", update_checking: "Buscando una nueva versión…", update_current: "Estás usando la última versión.",
    update_available: "Nueva versión disponible:", update_downloading: "Descargando:",
    update_downloaded: "Actualización descargada y lista para instalar:", update_installing: "Instalando…",
    update_error: "Error de actualización. Comprueba la conexión e inténtalo de nuevo."
  },
  pt: {
    connecting: "Conectando à Stats API local…", connected: "Stats API conectada", disconnected: "Stats API desconectada",
    matchTag: "PARTIDA AO VIVO", matchHeading: "Visão geral", rankedHeading: "Rank e histórico",
    historyHeading: "Histórico de MMR", historyMode: "Modo", historyDate: "Data", historyChange: "Variação desde o ponto anterior", historyEmpty: "Ainda não há valores de MMR para este modo.", historyPoints: "valores",
    statsTag: "ESTATÍSTICAS", statsHeading: "Estatísticas da partida", statsScopeTag: "ESTATÍSTICAS",
    allModes: "Todos os modos", currentMode: "Modo atual", switchScope: "Alterar escopo",
    period: "Período", periodSession: "Sessão atual", periodCleared: "Desde a redefinição", periodAlltime: "Todo o período",
    newSession: "Nova sessão", newSessionConfirm: "Iniciar uma nova sessão? As estatísticas da sessão começam do zero; as partidas antigas continuam em \u201cDesde a redefinição\u201d e \u201cTodo o período\u201d.",
    sessionPrompt: (count) => `A última sessão tem ${count} ${count === 1 ? "partida" : "partidas"}. Continuar ou iniciar uma nova sessão?`,
    sessionNew: "Nova sessão", sessionContinue: "Continuar sessão", sessionError: "Não foi possível alterar a sessão.",
    reset: "Redefinir V/D", language: "Idioma", port: "Porta da API local", apply: "Aplicar",
    setupButton: "Configurar Stats API local",
    setupConfirm: "Rocket League deve estar fechado. Apenas Port e PacketSendRate serão alterados na configuração da Stats API. O arquivo existente será copiado; se não existir, será criado. Continuar?",
    setupSuccess: "Stats API configurada. Reinicie Rocket League para iniciar o fluxo.",
    alreadyConfigured: "A Stats API já estava configurada. Reinicie Rocket League se o fluxo ainda não estiver disponível.",
    resetConfirm: "Redefinir vitórias/derrotas e sequência desta conta no escopo selecionado? MMR e outros recordes serão mantidos.",
    resetError: "Não foi possível redefinir as estatísticas.", scopeError: "Não foi possível alterar o escopo.",
    settingsError: "Não foi possível salvar a configuração.", setup: "Aviso de configuração",
    noData: "Aguardando dados da partida…", score: "Placar", timer: "Tempo", boost: "Boost",
    banner: "Evento", lastGoal: "Último gol", streak: "Sequência", mmr: "MMR", queue: "Busca de partida",
    ban: "Banimento", speed: "Velocidade", ping: "Ping", possession: "Posse de bola", records: "Recordes",
    goals: "Gols", assists: "Assistências", saves: "Defesas", shots: "Chutes", demos: "Demos",
    resets: "Flip resets", touches: "Toques", playerScore: "Pontos", rank: "Rank",
    mmrWl: "MMR + V/D",
    menu: "Menu", updateTitle: "Atualizações", updateAuto: "Verificar atualizações automaticamente",
    updateShow: "Mostrar status da atualização", updateClose: "Fechar aviso de atualização",
    updateCheck: "Verificar atualizações", updateDownload: "Baixar", updateInstall: "Instalar e reiniciar",
    updateConfirm: "Instalar esta atualização e reiniciar RocketStats? Os dados das contas serão mantidos.",
    updateMatchActive: "Há uma partida em andamento. Durante a reinicialização do RocketStats, eventos ou o resultado da partida podem não ser registrados. É melhor instalar a atualização após a partida.",
    updateMatchUnknown: "Não foi possível determinar se há uma partida em andamento. Se houver, eventos ou o resultado podem não ser registrados durante a reinicialização do RocketStats.",
    updateNetwork: "As verificações acessam o GitHub. Nenhum dado do jogo ou das contas é transmitido.",
    update_starting: "Iniciando atualizador…", update_unconfigured: "Nenhuma fonte de atualização está configurada.",
    update_development: "Atualizações desativadas no modo de desenvolvimento.", update_unsupported: "Atualizações disponíveis apenas na versão Windows instalada.",
    update_idle: "Pronto para verificar atualizações.", update_checking: "Buscando nova versão…", update_current: "Você está usando a versão mais recente.",
    update_available: "Nova versão disponível:", update_downloading: "Baixando atualização:",
    update_downloaded: "Atualização baixada e pronta para instalar:", update_installing: "Instalando…",
    update_error: "Falha na atualização. Verifique a conexão e tente novamente."
  },
  ru: {
    connecting: "Подключение к локальному Stats API…", connected: "Stats API подключено", disconnected: "Stats API отключено",
    matchTag: "ТЕКУЩИЙ МАТЧ", matchHeading: "Обзор матча", rankedHeading: "Ранг и результаты",
    historyHeading: "История MMR", historyMode: "Режим", historyDate: "Дата", historyChange: "Изменение с предыдущей точки", historyEmpty: "Для этого режима пока нет значений MMR.", historyPoints: "значений",
    statsTag: "СТАТИСТИКА ИГРОКА", statsHeading: "Статистика матча", statsScopeTag: "СТАТИСТИКА",
    allModes: "Все режимы", currentMode: "Текущий режим", switchScope: "Сменить охват",
    period: "Период", periodSession: "Текущая сессия", periodCleared: "С момента сброса", periodAlltime: "За всё время",
    newSession: "Новая сессия", newSessionConfirm: "Начать новую сессию? Статистика сессии начнётся с нуля; прошлые матчи останутся в «С момента сброса» и «За всё время».",
    sessionPrompt: (count) => `В прошлой сессии матчей: ${count}. Продолжить её или начать новую?`,
    sessionNew: "Новая сессия", sessionContinue: "Продолжить сессию", sessionError: "Не удалось изменить сессию.",
    reset: "Сбросить П/П", language: "Язык", port: "Локальный порт API", apply: "Применить",
    setupButton: "Настроить локальный Stats API",
    setupConfirm: "Rocket League должна быть закрыта. В конфигурации Stats API будут изменены только Port и PacketSendRate. Существующий файл будет сохранён в резервную копию; если его нет, он будет создан. Продолжить?",
    setupSuccess: "Stats API настроен. Перезапустите Rocket League, чтобы запустить передачу данных.",
    alreadyConfigured: "Stats API уже настроен. Перезапустите Rocket League, если данные ещё недоступны.",
    resetConfirm: "Сбросить победы/поражения и серию этой учётной записи в выбранном охвате? MMR и другие рекорды сохраняются.",
    resetError: "Не удалось сбросить статистику.", scopeError: "Не удалось изменить охват.",
    settingsError: "Не удалось сохранить настройку.", setup: "Настройка",
    noData: "Ожидание данных матча…", score: "Счёт", timer: "Время матча", boost: "Ускорение",
    banner: "Событие", lastGoal: "Последний гол", streak: "Серия", mmr: "MMR", queue: "Поиск матча",
    ban: "Блокировка", speed: "Скорость", ping: "Пинг", possession: "Владение", records: "Рекорды",
    goals: "Голы", assists: "Передачи", saves: "Сейвы", shots: "Удары", demos: "Демо",
    resets: "Flip reset", touches: "Касания", playerScore: "Очки", rank: "Ранг",
    mmrWl: "MMR + П/П",
    menu: "Меню", updateTitle: "Обновления приложения", updateAuto: "Автоматически проверять обновления",
    updateShow: "Показать состояние обновлений", updateClose: "Закрыть уведомление об обновлении",
    updateCheck: "Проверить обновления", updateDownload: "Скачать", updateInstall: "Установить и перезапустить",
    updateConfirm: "Установить это обновление и перезапустить RocketStats? Данные учётных записей сохранятся.",
    updateMatchActive: "Матч продолжается. Во время перезапуска RocketStats события или результат матча могут не сохраниться. Лучше установить обновление после матча.",
    updateMatchUnknown: "Не удалось определить, идёт ли матч. Если матч продолжается, его события или результат могут не сохраниться во время перезапуска RocketStats.",
    updateNetwork: "Проверки обращаются к GitHub. Данные игры и учётных записей не передаются.",
    update_starting: "Запуск обновления…", update_unconfigured: "Источник обновлений не настроен.",
    update_development: "Обновления отключены в режиме разработки.", update_unsupported: "Обновления доступны только в установленной версии для Windows.",
    update_idle: "Готово к проверке обновлений.", update_checking: "Поиск новой версии…", update_current: "Установлена последняя версия.",
    update_available: "Доступна новая версия:", update_downloading: "Загрузка обновления:",
    update_downloaded: "Обновление загружено и готово к установке:", update_installing: "Установка обновления…",
    update_error: "Не удалось обновить приложение. Проверьте соединение и повторите попытку."
  }
};

const CONFIG_TEXT = {
  de: { open: "Konfiguration öffnen", heading: "Konfiguration", close: "Schließen" },
  en: { open: "Open settings", heading: "Settings", close: "Close" },
  pl: { open: "Otwórz konfigurację", heading: "Konfiguracja", close: "Zamknij" },
  fr: { open: "Ouvrir la configuration", heading: "Configuration", close: "Fermer" },
  es: { open: "Abrir configuración", heading: "Configuración", close: "Cerrar" },
  pt: { open: "Abrir configurações", heading: "Configuração", close: "Fechar" },
  ru: { open: "Открыть настройки", heading: "Настройки", close: "Закрыть" }
};

const ACCOUNT_TEXT = {
  de: {
    accountHeading: "Konten und Kandidaten",
    accountPending: "Mehrere mögliche Konten – bitte dein Konto auswählen.",
    accountWaiting: "Noch kein Konto ausgewählt.", accountVerified: "Spielkonto bestätigt",
    accountManual: "Manuell ausgewählt", accountInferred: "Automatisch vermutet (nicht bestätigt)",
    accountHint: "Kandidaten und Matchdaten bleiben lokal. Wiederkehrende Spieler können auch Mitspieler oder Gegner sein. Das bestätigte Spielkonto hat Vorrang.",
    accountSelect: "Beobachtete Konten", accountUse: "Konto verwenden", accountRemove: "Entfernen",
    accountCorrect: "Automatische Zuordnung korrigieren",
    accountCorrectConfirm: "Automatisch zugeordnete Matches auf dieses Konto korrigieren? Matches ohne diese ID bleiben vorerst ungeklärt.",
    accountAddLabel: "Plattform-ID hinzufügen", accountAdd: "Hinzufügen",
    accountSuggested: "Kandidat", accountManaged: "gespeichert", accountMatches: "Matches",
    accountError: "Konto konnte nicht geändert werden",
    accountRemoveConfirm: "Diese ID aus der Kontoliste entfernen? Gespeicherte Matchdaten bleiben erhalten."
  },
  en: {
    accountHeading: "Accounts and candidates",
    accountPending: "Several accounts are possible — select your account.",
    accountWaiting: "No account selected yet.", accountVerified: "Game account verified",
    accountManual: "Manually selected", accountInferred: "Automatically suggested (not verified)",
    accountHint: "Candidates and match data stay on this PC. Recurring players may also be teammates or opponents. A verified game account takes priority.",
    accountSelect: "Observed accounts", accountUse: "Use account", accountRemove: "Remove",
    accountCorrect: "Correct automatic attribution",
    accountCorrectConfirm: "Reassign automatically attributed matches to this account? Matches without this ID will remain unresolved.",
    accountAddLabel: "Add platform ID", accountAdd: "Add",
    accountSuggested: "Candidate", accountManaged: "saved", accountMatches: "matches",
    accountError: "Could not change account",
    accountRemoveConfirm: "Remove this ID from your account list? Saved match data will be kept."
  },
  pl: {
    accountHeading: "Konta i kandydaci",
    accountPending: "Możliwych jest kilka kont — wybierz swoje konto.",
    accountWaiting: "Nie wybrano jeszcze konta.", accountVerified: "Konto gry zweryfikowane",
    accountManual: "Wybrane ręcznie", accountInferred: "Wykryte automatycznie (niezweryfikowane)",
    accountHint: "Kandydaci i dane meczów pozostają na tym komputerze. Powracający gracze mogą być również sojusznikami lub przeciwnikami. Zweryfikowane konto gry ma pierwszeństwo.",
    accountSelect: "Zaobserwowane konta", accountUse: "Użyj konta", accountRemove: "Usuń",
    accountCorrect: "Popraw automatyczne przypisanie",
    accountCorrectConfirm: "Przypisać automatycznie rozpoznane mecze do tego konta? Mecze bez tego ID pozostaną nierozstrzygnięte.",
    accountAddLabel: "Dodaj ID platformy", accountAdd: "Dodaj",
    accountSuggested: "Kandydat", accountManaged: "zapisane", accountMatches: "mecze",
    accountError: "Nie można zmienić konta",
    accountRemoveConfirm: "Usunąć ten ID z listy kont? Zapisane dane meczów zostaną zachowane."
  },
  fr: {
    accountHeading: "Comptes et candidats",
    accountPending: "Plusieurs comptes sont possibles : choisissez votre compte.",
    accountWaiting: "Aucun compte sélectionné.", accountVerified: "Compte du jeu vérifié",
    accountManual: "Sélection manuelle", accountInferred: "Suggestion automatique (non vérifiée)",
    accountHint: "Les candidats et les données de match restent sur ce PC. Les joueurs récurrents peuvent être des coéquipiers ou des adversaires. Le compte vérifié du jeu est prioritaire.",
    accountSelect: "Comptes observés", accountUse: "Utiliser ce compte", accountRemove: "Retirer",
    accountCorrect: "Corriger l’attribution automatique",
    accountCorrectConfirm: "Réattribuer les matchs détectés automatiquement à ce compte ? Les matchs sans cet ID resteront non attribués.",
    accountAddLabel: "Ajouter un ID de plateforme", accountAdd: "Ajouter",
    accountSuggested: "Candidat", accountManaged: "enregistré", accountMatches: "matchs",
    accountError: "Impossible de modifier le compte",
    accountRemoveConfirm: "Retirer cet ID de la liste ? Les données de match enregistrées seront conservées."
  },
  es: {
    accountHeading: "Cuentas y candidatos",
    accountPending: "Hay varias cuentas posibles; selecciona la tuya.",
    accountWaiting: "Aún no hay una cuenta seleccionada.", accountVerified: "Cuenta del juego verificada",
    accountManual: "Selección manual", accountInferred: "Sugerencia automática (sin verificar)",
    accountHint: "Los candidatos y los datos de las partidas permanecen en este PC. Los jugadores recurrentes también pueden ser compañeros o rivales. La cuenta verificada del juego tiene prioridad.",
    accountSelect: "Cuentas observadas", accountUse: "Usar cuenta", accountRemove: "Quitar",
    accountCorrect: "Corregir asignación automática",
    accountCorrectConfirm: "¿Asignar a esta cuenta las partidas detectadas automáticamente? Las partidas sin este ID quedarán sin resolver.",
    accountAddLabel: "Añadir ID de plataforma", accountAdd: "Añadir",
    accountSuggested: "Candidato", accountManaged: "guardada", accountMatches: "partidas",
    accountError: "No se pudo cambiar la cuenta",
    accountRemoveConfirm: "¿Quitar este ID de la lista? Se conservarán los datos de las partidas."
  },
  pt: {
    accountHeading: "Contas e candidatos",
    accountPending: "Há várias contas possíveis; selecione a sua.",
    accountWaiting: "Nenhuma conta selecionada.", accountVerified: "Conta do jogo verificada",
    accountManual: "Selecionada manualmente", accountInferred: "Sugestão automática (não verificada)",
    accountHint: "Candidatos e dados das partidas permanecem neste PC. Jogadores recorrentes também podem ser colegas ou adversários. A conta verificada do jogo tem prioridade.",
    accountSelect: "Contas observadas", accountUse: "Usar conta", accountRemove: "Remover",
    accountCorrect: "Corrigir atribuição automática",
    accountCorrectConfirm: "Atribuir as partidas detectadas automaticamente a esta conta? Partidas sem este ID permanecerão indefinidas.",
    accountAddLabel: "Adicionar ID de plataforma", accountAdd: "Adicionar",
    accountSuggested: "Candidato", accountManaged: "salva", accountMatches: "partidas",
    accountError: "Não foi possível alterar a conta",
    accountRemoveConfirm: "Remover este ID da lista? Os dados das partidas serão mantidos."
  },
  ru: {
    accountHeading: "Учётные записи и кандидаты",
    accountPending: "Возможно несколько учётных записей — выберите свою.",
    accountWaiting: "Учётная запись ещё не выбрана.", accountVerified: "Игровая учётная запись подтверждена",
    accountManual: "Выбрана вручную", accountInferred: "Определена автоматически (не подтверждена)",
    accountHint: "Кандидаты и данные матчей хранятся на этом ПК. Повторяющиеся игроки могут быть союзниками или соперниками. Подтверждённая игровая запись имеет приоритет.",
    accountSelect: "Обнаруженные записи", accountUse: "Использовать", accountRemove: "Убрать",
    accountCorrect: "Исправить автоматическое назначение",
    accountCorrectConfirm: "Назначить этой записи автоматически определённые матчи? Матчи без этого ID останутся неопределёнными.",
    accountAddLabel: "Добавить ID платформы", accountAdd: "Добавить",
    accountSuggested: "Кандидат", accountManaged: "сохранена", accountMatches: "матчей",
    accountError: "Не удалось изменить учётную запись",
    accountRemoveConfirm: "Убрать этот ID из списка? Сохранённые данные матчей останутся."
  }
};

const RANKED_ACTIONS = ["rank", "mmr-wl", "streak", "records", "ban-countdown"];
const DASHBOARD_ACTIONS = new Set([...RANKED_ACTIONS, "stats-scope"]);
const LABELS = {
  mmr: "mmr", rank: "rank", "mmr-wl": "mmrWl", streak: "streak", records: "records", "ban-countdown": "ban"
};
const BUILD_LABELS = {
  de: { build: "Build", development: "Entwicklungsbuild", locale: "de-DE" },
  en: { build: "Build", development: "Development build", locale: "en-US" },
  pl: { build: "Kompilacja", development: "Wersja deweloperska", locale: "pl-PL" },
  fr: { build: "Build", development: "Version de développement", locale: "fr-FR" },
  es: { build: "Compilación", development: "Versión de desarrollo", locale: "es-ES" },
  pt: { build: "Build", development: "Versão de desenvolvimento", locale: "pt-PT" },
  ru: { build: "Сборка", development: "Версия для разработки", locale: "ru-RU" }
};
const state = {
  locale: "en", models: new Map(),
  connection: { status: "connecting", error: null, revision: -1 }, error: null,
  update: { phase: "starting", version: "" }, autoCheckUpdates: true,
  session: null, accounts: null, version: "", buildDate: null
};
let errorChanged = false;
let updateStateRevision = 0;
let autoUpdateChanged = false;
let autoUpdateSaving = false;
let updateInstallPending = false;
let updateHideTimer;
let accountChoice = "";
let accountsBusy = false;
let accountsRenderSignature = "";
let accountsPanelInitialized = false;
let lastAccountIdentity = "";

const UPDATE_BALLOON_MS = 8000;
const UPDATE_NOTIFICATION_PHASES = new Set([
  "checking", "current", "available", "downloading", "downloaded", "installing", "error"
]);

function tr(key) {
  return ACCOUNT_TEXT[state.locale]?.[key] ?? TEXT[state.locale]?.[key] ??
    ACCOUNT_TEXT.en[key] ?? TEXT.en[key] ?? key;
}

function renderAccounts() {
  const signature = JSON.stringify([state.locale, state.accounts, accountChoice, accountsBusy]);
  if (signature === accountsRenderSignature) return;
  accountsRenderSignature = signature;
  document.getElementById("accounts-heading").textContent = tr("accountHeading");
  document.getElementById("accounts-hint").textContent = tr("accountHint");
  document.getElementById("accounts-select-label").textContent = tr("accountSelect");
  document.getElementById("accounts-use").textContent = tr("accountUse");
  document.getElementById("accounts-correct").textContent = tr("accountCorrect");
  document.getElementById("accounts-remove").textContent = tr("accountRemove");
  document.getElementById("accounts-add-label").textContent = tr("accountAddLabel");
  document.getElementById("accounts-add").textContent = tr("accountAdd");

  const accounts = state.accounts;
  const accountPanel = document.getElementById("accounts-panel");
  const accountIdentity = accounts?.verifiedAccountId ?? accounts?.selectedAccountId ?? "";
  if (!accountsPanelInitialized) {
    accountPanel.open = !accountIdentity;
    accountsPanelInitialized = true;
  } else if (accountIdentity !== lastAccountIdentity) {
    accountPanel.open = !accountIdentity;
  }
  lastAccountIdentity = accountIdentity;
  const entries = accounts?.accounts ?? [];
  if (!entries.some((entry) => entry.accountId === accountChoice)) {
    accountChoice = accounts?.activeAccountId ?? accounts?.selectedAccountId ?? entries[0]?.accountId ?? "";
    if (!entries.some((entry) => entry.accountId === accountChoice)) accountChoice = entries[0]?.accountId ?? "";
  }
  const select = document.getElementById("accounts-select");
  select.replaceChildren(...entries.map((entry) => {
    const option = document.createElement("option");
    option.value = entry.accountId;
    const labels = [
      ...(entry.suggested ? [tr("accountSuggested")] : []),
      ...(entry.name ? [entry.name] : []),
      entry.accountId,
      `${entry.matchesSeen} ${tr("accountMatches")}`,
      ...(entry.managed ? [tr("accountManaged")] : [])
    ];
    option.textContent = labels.join(" · ");
    return option;
  }));
  select.value = accountChoice;
  const selected = entries.find((entry) => entry.accountId === accountChoice);
  select.disabled = !accounts || accountsBusy || entries.length === 0;
  document.getElementById("accounts-use").disabled = !accounts || accountsBusy || !selected;
  const correct = document.getElementById("accounts-correct");
  correct.hidden = accounts?.selectionSource !== "inferred" ||
    !selected || selected.accountId === accounts.selectedAccountId;
  correct.disabled = accountsBusy || !selected || Boolean(accounts?.verifiedAccountId);
  document.getElementById("accounts-remove").disabled =
    !accounts || accountsBusy || !selected?.managed || selected.accountId === accounts.verifiedAccountId;
  document.getElementById("accounts-add").disabled = !accounts || accountsBusy;
  const active = entries.find((entry) => entry.accountId === accounts?.activeAccountId);
  let status = tr("accountWaiting");
  if (accounts?.selectionRequired && !accountIdentity) {
    status = tr("accountPending");
  } else if (accounts?.activeAccountId) {
    const kind = accounts.verifiedAccountId ? "accountVerified" :
      accounts.selectionSource === "inferred" ? "accountInferred" : "accountManual";
    status = `${tr(kind)}: ${active?.name || accounts.activeAccountId}`;
  }
  document.getElementById("accounts-status").textContent = status;
}

function applyAccounts(accounts) {
  if (!accounts) return;
  const previous = state.accounts?.activeAccountId;
  state.accounts = accounts;
  if (previous !== undefined && previous !== accounts.activeAccountId) {
    historyRequest += 1;
    mmrHistory = {};
    historyPlaylist = undefined;
    renderMmrHistory();
    refreshMmrHistory(0);
  }
  renderAccounts();
}

function renderCard(action, model) {
  const card = document.createElement("article");
  card.className = "stat-card";
  card.style.borderTopColor = model.accent || "#26374d";

  const heading = document.createElement("h3");
  heading.className = "card-title";
  heading.textContent = model.title || tr(LABELS[action]);
  card.append(heading);

  if (model.image) {
    card.classList.add("image-card");
    const image = document.createElement("img");
    image.alt = model.title || tr(LABELS[action]);
    image.src = model.image;
    card.append(image);
  } else {
    const value = document.createElement("p");
    value.className = "card-value";
    value.textContent = model.value || "—";
    if (model.pingMs !== undefined) value.style.color = model.accent;
    card.append(value);
    const footer = document.createElement("p");
    footer.className = "card-footer";
    footer.textContent = model.footer || "";
    card.append(footer);
  }
  return card;
}

const PLAYLIST_LABELS = {
  ranked_1v1: "Ranked 1v1", ranked_2v2: "Ranked 2v2", ranked_3v3: "Ranked 3v3", ranked_4v4: "Ranked 4v4",
  ranked_hoops: "Hoops", ranked_rumble: "Rumble", ranked_dropshot: "Dropshot",
  ranked_snow_day: "Snow Day", ranked_heatseeker: "Heatseeker", casual: "Casual", tournament: "Tournament"
};
const SVG_NS = "http://www.w3.org/2000/svg";
const CHART = { width: 640, height: 240, padLeft: 68, padRight: 12, padTop: 16, padBottom: 50 };
let mmrHistory = {};
let historyPlaylist;
let historyTimer;
let historyRequest = 0;

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function formatHistoryDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

function chartPoints(points) {
  const values = points.map((point) => point.mmr);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const span = max - min;
  const innerWidth = CHART.width - CHART.padLeft - CHART.padRight;
  const innerHeight = CHART.height - CHART.padTop - CHART.padBottom;
  return points.map((point, index) => ({
    x: CHART.padLeft + (points.length === 1 ? innerWidth / 2 : (innerWidth * index) / (points.length - 1)),
    y: CHART.padTop + innerHeight - ((point.mmr - min) / span) * innerHeight
  }));
}

function renderMmrHistory() {
  document.getElementById("history-heading").textContent = tr("historyHeading");
  document.getElementById("history-mode-label").textContent = tr("historyMode");

  const playlists = Object.keys(mmrHistory).filter((key) => mmrHistory[key].length);
  if (!playlists.includes(historyPlaylist)) {
    historyPlaylist = [...playlists].sort((a, b) => mmrHistory[b].at(-1).at - mmrHistory[a].at(-1).at)[0];
  }
  const select = document.getElementById("history-select");
  select.replaceChildren(...playlists.map((key) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = PLAYLIST_LABELS[key] || key;
    return option;
  }));
  select.value = historyPlaylist || "";
  select.disabled = playlists.length === 0;

  const chart = document.getElementById("history-chart");
  const legend = document.getElementById("history-legend");
  const legendLabel = document.getElementById("history-legend-label");
  const tooltip = document.getElementById("history-tooltip");
  const summary = document.getElementById("history-summary");
  const empty = document.getElementById("history-empty");
  const points = historyPlaylist ? mmrHistory[historyPlaylist] : [];
  chart.replaceChildren();
  tooltip.hidden = true;
  tooltip.className = "history-tooltip";
  chart.hidden = points.length === 0;
  legend.hidden = points.length === 0;
  summary.hidden = points.length === 0;
  empty.hidden = points.length > 0;
  empty.textContent = tr("historyEmpty");
  if (!points.length) {
    summary.textContent = "";
    return;
  }

  const coords = chartPoints(points);
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const bottom = CHART.height - CHART.padBottom;
  const values = points.map((point) => point.mmr);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 5;
    max += 5;
  }
  const tickYs = [CHART.padTop, (CHART.padTop + bottom) / 2, bottom];
  for (const [index, y] of tickYs.entries()) {
    const value = Math.round(max - ((max - min) * index) / (tickYs.length - 1));
    const label = svgElement("text", {
      class: "history-tick-label",
      x: CHART.padLeft - 8,
      y: (y + 4).toFixed(1),
      "text-anchor": "end"
    });
    label.textContent = String(value);
    chart.append(
      svgElement("line", {
        class: index === tickYs.length - 1 ? "history-axis" : "history-gridline",
        x1: CHART.padLeft,
        y1: y.toFixed(1),
        x2: CHART.width - CHART.padRight,
        y2: y.toFixed(1)
      }),
      label
    );
  }
  const yAxisLabel = svgElement("text", {
    class: "history-axis-label",
    x: 15,
    y: ((CHART.padTop + bottom) / 2).toFixed(1),
    transform: `rotate(-90 15 ${(CHART.padTop + bottom) / 2})`,
    "text-anchor": "middle"
  });
  yAxisLabel.textContent = tr("mmr");
  const xAxisLabel = svgElement("text", {
    class: "history-axis-label",
    x: (CHART.width / 2).toFixed(1),
    y: (CHART.height - 4).toFixed(1),
    "text-anchor": "middle"
  });
  xAxisLabel.textContent = tr("historyDate");
  chart.append(
    svgElement("line", {
      class: "history-axis",
      x1: CHART.padLeft,
      y1: CHART.padTop,
      x2: CHART.padLeft,
      y2: bottom
    }),
    yAxisLabel,
    xAxisLabel
  );
  const dateIndexes = points.length === 1 ? [0] : [0, points.length - 1];
  for (const index of dateIndexes) {
    const point = coords[index];
    const dateLabel = svgElement("text", {
      class: "history-tick-label",
      x: point.x.toFixed(1),
      y: (bottom + 17).toFixed(1),
      "text-anchor": index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"
    });
    dateLabel.textContent = formatHistoryDate(new Date(points[index].at));
    chart.append(dateLabel);
  }
  chart.append(
    svgElement("polygon", {
      class: "history-area",
      points: `${coords[0].x.toFixed(1)},${bottom} ${line} ${coords.at(-1).x.toFixed(1)},${bottom}`
    }),
    svgElement("polyline", { class: "history-line", points: line })
  );
  for (const [index, point] of coords.entries()) {
    const entry = points[index];
    const delta = index > 0 ? entry.mmr - points[index - 1].mmr : null;
    const pointDate = new Date(entry.at);
    const date = `${formatHistoryDate(pointDate)} ${pointDate.toLocaleTimeString(state.locale)}`;
    const pointLabelLines = [
      PLAYLIST_LABELS[historyPlaylist] || historyPlaylist,
      `${tr("mmr")}: ${entry.mmr}`,
      ...(delta === null ? [] : [`${tr("historyChange")}: ${delta >= 0 ? "+" : ""}${delta}`]),
      `${tr("historyDate")}: ${date}`
    ];
    const pointLabel = pointLabelLines.join("\n");
    const hitTarget = svgElement("circle", {
      class: "history-hit-target",
      cx: point.x.toFixed(1),
      cy: point.y.toFixed(1),
      r: 11,
      tabindex: 0,
      focusable: "true",
      "aria-label": pointLabel,
      "aria-describedby": "history-tooltip"
    });
    const title = svgElement("title", {});
    title.textContent = pointLabel;
    hitTarget.append(title);
    const showTooltip = (event) => {
      tooltip.replaceChildren(...pointLabelLines.map((text, lineIndex) => {
        const line = document.createElement("span");
        line.textContent = text;
        if (lineIndex === 0) line.className = "history-tooltip-mode";
        return line;
      }));
      const rect = hitTarget.getBoundingClientRect?.();
      const clientX = Number.isFinite(event.clientX)
        ? event.clientX
        : rect ? rect.left + rect.width / 2 : 640;
      const clientY = Number.isFinite(event.clientY)
        ? event.clientY
        : rect ? rect.top + rect.height / 2 : 120;
      const tooltipHeight = tooltip.offsetHeight || pointLabelLines.length * 20;
      const tooltipWidth = tooltip.offsetWidth || 200;
      tooltip.className = clientY < tooltipHeight + 20
        ? "history-tooltip below"
        : "history-tooltip";
      tooltip.style.left = `${Math.max(tooltipWidth / 2 + 8,
        Math.min(clientX, (window.innerWidth || 1280) - tooltipWidth / 2 - 8))}px`;
      tooltip.style.top = `${clientY}px`;
      tooltip.hidden = false;
    };
    const hideTooltip = () => { tooltip.hidden = true; };
    hitTarget.addEventListener("pointerenter", showTooltip);
    hitTarget.addEventListener("pointermove", (event) => {
      if (!tooltip.hidden) showTooltip(event);
    });
    hitTarget.addEventListener("pointerleave", () => {
      if (document.activeElement !== hitTarget) hideTooltip();
    });
    hitTarget.addEventListener("focus", showTooltip);
    hitTarget.addEventListener("blur", hideTooltip);
    chart.append(
      hitTarget,
      svgElement("circle", {
        class: "history-dot",
        cx: point.x.toFixed(1),
        cy: point.y.toFixed(1),
        r: 4
      })
    );
  }
  chart.setAttribute("aria-label", `${tr("historyHeading")} ${PLAYLIST_LABELS[historyPlaylist] || historyPlaylist}`);
  legendLabel.textContent = `${tr("mmr")} · ${PLAYLIST_LABELS[historyPlaylist] || historyPlaylist}`;

  const change = values.at(-1) - values[0];
  summary.textContent = `${values.at(-1)} (${change >= 0 ? "+" : ""}${change}) · ` +
    `Min ${Math.min(...values)} · Max ${Math.max(...values)} · ${points.length} ${tr("historyPoints")}`;
}

function refreshMmrHistory(delay = 300) {
  if (typeof bridge.getMmrHistory !== "function") return;
  clearTimeout(historyTimer);
  historyTimer = setTimeout(async () => {
    const request = ++historyRequest;
    try {
      const history = await bridge.getMmrHistory();
      if (request !== historyRequest) return;
      mmrHistory = history && typeof history === "object" ? history : {};
      renderMmrHistory();
    } catch {
      // History is optional; the cards keep working without it.
    }
  }, delay);
}

function renderGroup(groupId, actions) {
  const grid = document.getElementById(groupId);
  grid.replaceChildren();
  let count = 0;
  for (const action of actions) {
    const model = state.models.get(action);
    if (!model) continue;
    grid.append(renderCard(action, model));
    count += 1;
  }
  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = tr("noData");
    grid.append(empty);
  }
}

function renderStatus() {
  const statusText = document.getElementById("connection-label");
  const dot = document.getElementById("status-dot");
  statusText.textContent = tr(state.connection.status);
  dot.className = `status-dot ${state.connection.status}`;
}

function renderScope() {
  const model = state.models.get("stats-scope");
  const isMode = model?.footerKey === "scopeMode";
  document.getElementById("scope-value").textContent = isMode
    ? `${tr("currentMode")}${model.value && model.value !== tr("currentMode") ? ` · ${model.value}` : ""}`
    : tr("allModes");
}

function renderSession() {
  const session = state.session;
  const select = document.getElementById("period-select");
  document.getElementById("period-label").textContent = tr("period");
  select.replaceChildren(...["session", "cleared", "alltime"].map((period) => {
    const option = document.createElement("option");
    option.value = period;
    option.textContent = tr(`period${period[0].toUpperCase()}${period.slice(1)}`);
    return option;
  }));
  select.disabled = !session;
  if (session) select.value = session.period;
  const newButton = document.getElementById("new-session-button");
  newButton.textContent = tr("newSession");
  newButton.disabled = !session;
  const panel = document.getElementById("session-panel");
  panel.hidden = !session?.promptPending;
  document.getElementById("session-text").textContent = tr("sessionPrompt")(session?.matchCount ?? 0);
  document.getElementById("session-new").textContent = tr("sessionNew");
  document.getElementById("session-continue").textContent = tr("sessionContinue");
}

function applySession(session) {
  state.session = session;
  renderSession();
}

async function decideSession(startNew) {
  try { applySession(await bridge.decideSession(startNew)); } catch { showError(tr("sessionError")); }
}

function renderUpdate() {
  const update = state.update;
  const disabled = ["starting", "unconfigured", "development", "unsupported"].includes(update.phase);
  const version = update.version ? `v${update.version}` : "";
  document.getElementById("menu-toggle").setAttribute("aria-label", tr("menu"));
  document.getElementById("menu-updates-heading").textContent = tr("updateTitle");
  document.getElementById("menu-update-version").textContent = version;
  document.getElementById("updates-heading").textContent = tr("updateTitle");
  document.getElementById("update-version").textContent = version;
  document.getElementById("update-close").setAttribute("aria-label", tr("updateClose"));
  document.getElementById("update-status").textContent = [
    tr(`update_${update.phase}`),
    update.availableVersion ? `v${update.availableVersion}` : "",
    update.phase === "downloading" ? `${Math.floor(update.percent || 0)}%` : ""
  ].filter(Boolean).join(" ");
  document.getElementById("update-source").textContent = update.source ? `GitHub Releases · ${update.source}` : "";
  document.getElementById("update-network").textContent = tr("updateNetwork");
  document.getElementById("update-auto-label").textContent = tr("updateAuto");
  const automatic = document.getElementById("update-auto");
  automatic.checked = state.autoCheckUpdates;
  automatic.disabled = disabled || autoUpdateSaving;
  const check = document.getElementById("update-check");
  check.textContent = tr("updateCheck");
  check.disabled = !["idle", "current", "available", "error"].includes(update.phase);
  document.getElementById("update-show").textContent = tr("updateShow");
  const download = document.getElementById("update-download");
  download.textContent = tr("updateDownload");
  download.hidden = !["available", "downloading"].includes(update.phase);
  download.disabled = update.phase !== "available";
  const install = document.getElementById("update-install");
  install.textContent = tr("updateInstall");
  install.hidden = !["downloaded", "installing"].includes(update.phase);
  install.disabled = update.phase !== "downloaded" || updateInstallPending;
  const progress = document.getElementById("update-progress");
  progress.hidden = !["downloading", "downloaded"].includes(update.phase);
  progress.value = update.percent || 0;
  progress.setAttribute("aria-label", tr("updateDownload"));
  const error = document.getElementById("update-error");
  error.textContent = update.error || "";
  error.hidden = !update.error;
}

function hideUpdateBalloon() {
  if (updateHideTimer !== undefined) clearTimeout(updateHideTimer);
  updateHideTimer = undefined;
  const balloon = document.getElementById("update-balloon");
  const hadFocus = balloon.contains(document.activeElement);
  balloon.hidden = true;
  if (hadFocus) document.getElementById("menu-toggle").focus();
}

function showUpdateBalloon(autoDismiss = false) {
  if (updateHideTimer !== undefined) clearTimeout(updateHideTimer);
  updateHideTimer = undefined;
  const balloon = document.getElementById("update-balloon");
  balloon.hidden = false;
  if (autoDismiss) {
    updateHideTimer = setTimeout(() => {
      updateHideTimer = undefined;
      if (!balloon.matches(":hover") && !balloon.contains(document.activeElement)) {
        balloon.hidden = true;
      }
    }, UPDATE_BALLOON_MS);
  }
}

function applyUpdate(update) {
  const previous = state.update;
  updateStateRevision += 1;
  state.update = update;
  if (
    UPDATE_NOTIFICATION_PHASES.has(update.phase) &&
    (update.phase !== previous.phase || (update.error && update.error !== previous.error))
  ) {
    showUpdateBalloon(update.phase === "current" && !update.error);
  }
  renderUpdate();
}

function showUpdateError(error) {
  updateStateRevision += 1;
  state.update = { ...state.update, error: error instanceof Error ? error.message : String(error) };
  showUpdateBalloon();
  renderUpdate();
}

function renderAll() {
  document.documentElement.lang = state.locale;
  const configText = CONFIG_TEXT[state.locale] ?? CONFIG_TEXT.en;
  document.getElementById("config-open").setAttribute("aria-label", configText.open);
  document.getElementById("config-open").title = configText.open;
  document.getElementById("config-heading").textContent = configText.heading;
  document.getElementById("config-close").textContent = configText.close;
  const buildInfo = BUILD_LABELS[state.locale] ?? BUILD_LABELS.en;
  const hasBuildDate = typeof state.buildDate === "string" &&
    !Number.isNaN(Date.parse(state.buildDate));
  const buildDate = hasBuildDate
    ? new Intl.DateTimeFormat(buildInfo.locale, {
      dateStyle: "medium", timeZone: "UTC"
    }).format(new Date(state.buildDate))
    : buildInfo.development;
  document.getElementById("build-info").textContent =
    `v${state.version || "—"} · ${hasBuildDate ? `${buildInfo.build} ${buildDate}` : buildDate}`;
  document.getElementById("ranked-heading").textContent = tr("rankedHeading");
  document.getElementById("scope-eyebrow").textContent = tr("statsScopeTag");
  document.getElementById("scope-button").textContent = tr("switchScope");
  document.getElementById("reset-button").textContent = tr("reset");
  document.getElementById("setup-api-button").textContent = tr("setupButton");
  document.getElementById("language-label").textContent = tr("language");
  document.getElementById("port-label").textContent = tr("port");
  document.getElementById("port-save").textContent = tr("apply");
  renderStatus();
  renderError();
  renderScope();
  renderSession();
  renderAccounts();
  renderUpdate();
  renderGroup("ranked-grid", RANKED_ACTIONS);
  renderMmrHistory();
}

function renderError() {
  const message = state.error || state.connection.error;
  document.getElementById("error-title").textContent = tr("setup");
  document.getElementById("error-text").textContent = message || "";
  document.getElementById("error-panel").hidden = !message;
}

function showError(message) {
  errorChanged = true;
  state.error = message;
  renderError();
}

function clearError() {
  errorChanged = true;
  state.error = null;
  state.connection = { ...state.connection, error: null };
  renderError();
}

function applyConnection(connection) {
  if (connection.revision <= state.connection.revision) return;
  state.connection = connection;
  renderStatus();
  renderError();
}

const bridge = window.rocketStatsDesktop;
bridge.onModel((model) => {
  if (!DASHBOARD_ACTIONS.has(model.action)) return;
  state.models.set(model.action, model);
  renderAll();
  if (model.action === "rank" || model.action === "mmr-wl") refreshMmrHistory();
});
bridge.onStatus(applyConnection);
bridge.onError(showError);
bridge.onUpdate(applyUpdate);
bridge.onSession?.(applySession);
bridge.onPlatformAccounts?.(applyAccounts);
document.getElementById("history-select").addEventListener("change", (event) => {
  historyPlaylist = event.target.value;
  renderMmrHistory();
});

async function changeAccount(action) {
  accountsBusy = true;
  renderAccounts();
  try {
    const accounts = await action();
    if (!accounts || !Array.isArray(accounts.accounts)) {
      throw new Error("The account service returned an invalid response.");
    }
    applyAccounts(accounts);
    clearError();
    return true;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    showError(`${tr("accountError")}: ${detail}`);
    return false;
  } finally {
    accountsBusy = false;
    renderAccounts();
  }
}

document.getElementById("accounts-select").addEventListener("change", (event) => {
  accountChoice = event.target.value;
  renderAccounts();
});
document.getElementById("accounts-use").addEventListener("click", async () => {
  if (accountChoice) await changeAccount(() => bridge.selectPlatformAccount(accountChoice));
});
document.getElementById("accounts-correct").addEventListener("click", async () => {
  if (!accountChoice || !window.confirm(tr("accountCorrectConfirm"))) return;
  await changeAccount(() => bridge.selectPlatformAccount(accountChoice, true));
});
document.getElementById("accounts-remove").addEventListener("click", async () => {
  if (!accountChoice || !window.confirm(tr("accountRemoveConfirm"))) return;
  await changeAccount(() => bridge.removePlatformAccount(accountChoice));
});
document.getElementById("accounts-add-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("accounts-add-input");
  const accountId = input.value.trim();
  if (await changeAccount(() => bridge.addPlatformAccount(accountId))) {
    accountChoice = accountId;
    input.value = "";
    renderAccounts();
  }
});

const menu = document.getElementById("app-menu");
document.getElementById("update-close").addEventListener("click", hideUpdateBalloon);
document.getElementById("update-show").addEventListener("click", () => {
  menu.open = false;
  renderUpdate();
  showUpdateBalloon(state.update.phase === "current" && !state.update.error);
});
document.addEventListener("click", (event) => {
  if (menu.open && !menu.contains(event.target)) menu.open = false;
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (menu.open) {
    menu.open = false;
    document.getElementById("menu-toggle").focus();
  } else if (!document.getElementById("update-balloon").hidden) {
    hideUpdateBalloon();
  }
});

function updateInstallConfirmation(matchStatus) {
  let warning;
  switch (matchStatus) {
    case "in-match":
      warning = tr("updateMatchActive");
      break;
    case "unknown":
      warning = tr("updateMatchUnknown");
      break;
    case "not-in-match":
      return tr("updateConfirm");
    default:
      throw new Error("Invalid match status returned by the updater.");
  }
  return `${warning}\n\n${tr("updateConfirm")}`;
}

async function requestUpdateInstall() {
  if (updateInstallPending) return null;
  updateInstallPending = true;
  renderUpdate();
  try {
    let matchStatus = await bridge.getUpdateMatchStatus();
    while (true) {
      if (!window.confirm(updateInstallConfirmation(matchStatus))) return null;
      const result = await bridge.installUpdate(matchStatus);
      if (!result || typeof result !== "object") {
        throw new Error("The updater returned an invalid installation result.");
      }
      if (result.needsConfirmation === true) {
        matchStatus = result.matchStatus;
        continue;
      }
      if (typeof result.phase !== "string") {
        throw new Error("The updater returned an invalid installation state.");
      }
      return result;
    }
  } finally {
    updateInstallPending = false;
    renderUpdate();
  }
}

for (const [id, action] of [
  ["update-check", () => bridge.checkUpdate()],
  ["update-download", () => bridge.downloadUpdate()],
  ["update-install", requestUpdateInstall]
]) {
  document.getElementById(id).addEventListener("click", async () => {
    if (id === "update-check") {
      menu.open = false;
      showUpdateBalloon();
    }
    const revisionBeforeAction = updateStateRevision;
    try {
      const update = await action();
      if (update && revisionBeforeAction === updateStateRevision) {
        applyUpdate(update);
      }
    } catch (error) {
      showUpdateError(error);
    }
  });
}
document.getElementById("update-auto").addEventListener("change", async (event) => {
  const previous = state.autoCheckUpdates;
  autoUpdateChanged = true;
  autoUpdateSaving = true;
  state.autoCheckUpdates = event.target.checked;
  renderUpdate();
  try {
    const result = await bridge.setAutoUpdates(event.target.checked);
    state.autoCheckUpdates = result.autoCheckUpdates;
  } catch (error) {
    state.autoCheckUpdates = previous;
    showUpdateError(error);
  } finally {
    autoUpdateSaving = false;
    renderUpdate();
  }
});

document.getElementById("scope-button").addEventListener("click", async () => {
  try { await bridge.toggleScope(); } catch { showError(tr("scopeError")); }
});
const configurationDialog = document.getElementById("config-dialog");
document.getElementById("config-open").addEventListener("click", () => {
  document.getElementById("config-status").textContent = "";
  configurationDialog.showModal();
});
document.getElementById("config-close").addEventListener("click", () => configurationDialog.close());
configurationDialog.addEventListener("click", (event) => {
  if (event.target === configurationDialog) configurationDialog.close();
});
document.getElementById("reset-button").addEventListener("click", async () => {
  if (!window.confirm(tr("resetConfirm"))) return;
  try { await bridge.resetStats(); } catch { showError(tr("resetError")); }
});
document.getElementById("period-select").addEventListener("change", async (event) => {
  try { applySession(await bridge.setStatsPeriod(event.target.value)); } catch {
    showError(tr("sessionError"));
    renderSession();
  }
});
document.getElementById("new-session-button").addEventListener("click", async () => {
  if (!window.confirm(tr("newSessionConfirm"))) return;
  await decideSession(true);
});
document.getElementById("session-new").addEventListener("click", () => decideSession(true));
document.getElementById("session-continue").addEventListener("click", () => decideSession(false));
document.getElementById("setup-api-button").addEventListener("click", async (event) => {
  if (!window.confirm(tr("setupConfirm"))) return;
  const button = event.currentTarget;
  button.disabled = true;
  clearError();
  document.getElementById("success-panel").hidden = true;
  try {
    const result = await bridge.configureApi();
    document.getElementById("port-input").value = String(result.port);
    document.getElementById("success-panel").textContent = result.alreadyConfigured
      ? tr("alreadyConfigured")
      : tr("setupSuccess");
    document.getElementById("success-panel").hidden = false;
    configurationDialog.close();
  } catch (error) {
    const message = error instanceof Error ? error.message : tr("settingsError");
    document.getElementById("config-status").textContent = message;
    showError(message);
  } finally {
    button.disabled = false;
  }
});
document.getElementById("locale-select").addEventListener("change", async (event) => {
  try {
    const result = await bridge.setLocale(event.target.value);
    state.locale = result.locale;
    document.getElementById("config-status").textContent = "";
    renderAll();
  } catch {
    const message = tr("settingsError");
    document.getElementById("config-status").textContent = message;
    showError(message);
  }
});
document.getElementById("port-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("port-input");
  const value = Number(input.value);
  try {
    const result = await bridge.setPort(value);
    input.value = String(result.port);
    document.getElementById("config-status").textContent = "";
    clearError();
  } catch (error) {
    const message = error instanceof Error ? error.message : tr("settingsError");
    document.getElementById("config-status").textContent = message;
    showError(message);
  }
});

const initialUpdateRevision = updateStateRevision;
bridge.getState().then((initial) => {
  state.locale = initial.locale;
  state.version = initial.version;
  state.buildDate = initial.buildDate;
  if (updateStateRevision === initialUpdateRevision) applyUpdate(initial.update);
  if (!autoUpdateChanged) state.autoCheckUpdates = initial.autoCheckUpdates;
  if (initial.session && !state.session) state.session = initial.session;
  if (initial.accounts && !state.accounts) applyAccounts(initial.accounts);
  state.models = new Map(initial.models
    .filter((model) => DASHBOARD_ACTIONS.has(model.action))
    .map((model) => [model.action, model]));
  document.getElementById("locale-select").value = initial.locale;
  document.getElementById("port-input").value = String(initial.port);
  applyConnection(initial.connection);
  renderAll();
  refreshMmrHistory(0);
  if (initial.startupError && !errorChanged) showError(initial.startupError);
}).catch((error) => showError(error instanceof Error ? error.message : "Could not load application state."));
