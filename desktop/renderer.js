const TEXT = {
  de: {
    connecting: "Verbinde mit lokaler Stats-API…", connected: "Stats-API verbunden", disconnected: "Stats-API getrennt",
    matchTag: "LIVE-MATCH", matchHeading: "Spielübersicht", rankedTag: "RANGLISTE", rankedHeading: "Rang & Bilanz",
    historyTag: "VERLAUF", historyHeading: "MMR-Verlauf", historyMode: "Modus", historyEmpty: "Noch keine MMR-Werte für diesen Modus.", historyPoints: "Werte",
    statsTag: "SPIELERSTATISTIKEN", statsHeading: "Match-Statistiken", scopeTag: "SIEG / NIEDERLAGE",
    allModes: "Alle Modi", currentMode: "Aktueller Modus", switchScope: "Ansicht umschalten",
    reset: "S/N zurücksetzen", language: "Sprache", port: "Lokaler API-Port", apply: "Übernehmen",
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
    matchTag: "LIVE MATCH", matchHeading: "Match overview", rankedTag: "RANKED", rankedHeading: "Rank & record",
    historyTag: "HISTORY", historyHeading: "MMR history", historyMode: "Mode", historyEmpty: "No MMR values for this mode yet.", historyPoints: "values",
    statsTag: "PLAYER STATS", statsHeading: "Match statistics", scopeTag: "WIN / LOSS SCOPE",
    allModes: "All modes", currentMode: "Current mode", switchScope: "Switch scope",
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
    matchTag: "MECZ NA ŻYWO", matchHeading: "Podsumowanie meczu", rankedTag: "RANKING", rankedHeading: "Ranga i bilans",
    historyTag: "HISTORIA", historyHeading: "Historia MMR", historyMode: "Tryb", historyEmpty: "Brak wartości MMR dla tego trybu.", historyPoints: "wartości",
    statsTag: "STATYSTYKI GRACZA", statsHeading: "Statystyki meczu", scopeTag: "ZAKRES ZWYCIĘSTW / PORAŻEK",
    allModes: "Wszystkie tryby", currentMode: "Bieżący tryb", switchScope: "Zmień zakres",
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
    matchTag: "MATCH EN DIRECT", matchHeading: "Aperçu du match", rankedTag: "CLASSÉ", rankedHeading: "Rang et bilan",
    historyTag: "HISTORIQUE", historyHeading: "Historique MMR", historyMode: "Mode", historyEmpty: "Aucune valeur MMR pour ce mode.", historyPoints: "valeurs",
    statsTag: "STATS DU JOUEUR", statsHeading: "Statistiques du match", scopeTag: "PORTÉE VICTOIRES / DÉFAITES",
    allModes: "Tous les modes", currentMode: "Mode actuel", switchScope: "Changer la portée",
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
    matchTag: "PARTIDA EN VIVO", matchHeading: "Resumen de partida", rankedTag: "CLASIFICATORIA", rankedHeading: "Rango y registro",
    historyTag: "HISTORIAL", historyHeading: "Historial de MMR", historyMode: "Modo", historyEmpty: "Aún no hay valores de MMR para este modo.", historyPoints: "valores",
    statsTag: "ESTADÍSTICAS", statsHeading: "Estadísticas de partida", scopeTag: "ÁMBITO DE VICTORIAS / DERROTAS",
    allModes: "Todos los modos", currentMode: "Modo actual", switchScope: "Cambiar ámbito",
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
    matchTag: "PARTIDA AO VIVO", matchHeading: "Visão geral", rankedTag: "RANQUEADA", rankedHeading: "Rank e histórico",
    historyTag: "HISTÓRICO", historyHeading: "Histórico de MMR", historyMode: "Modo", historyEmpty: "Ainda não há valores de MMR para este modo.", historyPoints: "valores",
    statsTag: "ESTATÍSTICAS", statsHeading: "Estatísticas da partida", scopeTag: "ESCOPO DE VITÓRIAS / DERROTAS",
    allModes: "Todos os modos", currentMode: "Modo atual", switchScope: "Alterar escopo",
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
    matchTag: "ТЕКУЩИЙ МАТЧ", matchHeading: "Обзор матча", rankedTag: "РЕЙТИНГ", rankedHeading: "Ранг и результаты",
    historyTag: "ИСТОРИЯ", historyHeading: "История MMR", historyMode: "Режим", historyEmpty: "Для этого режима пока нет значений MMR.", historyPoints: "значений",
    statsTag: "СТАТИСТИКА ИГРОКА", statsHeading: "Статистика матча", scopeTag: "УЧЁТ ПОБЕД / ПОРАЖЕНИЙ",
    allModes: "Все режимы", currentMode: "Текущий режим", switchScope: "Сменить охват",
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

const RANKED_ACTIONS = ["rank", "mmr-wl", "streak", "records", "ban-countdown"];
const DASHBOARD_ACTIONS = new Set([...RANKED_ACTIONS, "stats-scope"]);
const LABELS = {
  mmr: "mmr", rank: "rank", "mmr-wl": "mmrWl", streak: "streak", records: "records", "ban-countdown": "ban"
};
const state = {
  locale: "en", models: new Map(),
  connection: { status: "connecting", error: null, revision: -1 }, error: null,
  update: { phase: "starting", version: "" }, autoCheckUpdates: true
};
let errorChanged = false;
let updateStateRevision = 0;
let autoUpdateChanged = false;
let autoUpdateSaving = false;
let updateInstallPending = false;
let updateHideTimer;

const UPDATE_BALLOON_MS = 8000;
const UPDATE_NOTIFICATION_PHASES = new Set([
  "checking", "current", "available", "downloading", "downloaded", "installing", "error"
]);

function tr(key) {
  return TEXT[state.locale]?.[key] ?? TEXT.en[key] ?? key;
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
const CHART = { width: 640, height: 200, padX: 8, padY: 16 };
let mmrHistory = {};
let historyPlaylist;
let historyTimer;
let historyRequest = 0;

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

function chartPoints(points) {
  const values = points.map((point) => point.mmr);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const innerWidth = CHART.width - CHART.padX * 2;
  const innerHeight = CHART.height - CHART.padY * 2;
  return points.map((point, index) => ({
    x: CHART.padX + (points.length === 1 ? innerWidth / 2 : (innerWidth * index) / (points.length - 1)),
    y: CHART.padY + innerHeight - ((point.mmr - min) / span) * innerHeight
  }));
}

function renderMmrHistory() {
  document.getElementById("history-eyebrow").textContent = tr("historyTag");
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
  const summary = document.getElementById("history-summary");
  const empty = document.getElementById("history-empty");
  const points = historyPlaylist ? mmrHistory[historyPlaylist] : [];
  chart.replaceChildren();
  chart.hidden = points.length === 0;
  summary.hidden = points.length === 0;
  empty.hidden = points.length > 0;
  empty.textContent = tr("historyEmpty");
  if (!points.length) {
    summary.textContent = "";
    return;
  }

  const coords = chartPoints(points);
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const bottom = CHART.height - CHART.padY;
  chart.append(
    svgElement("polygon", {
      class: "history-area",
      points: `${coords[0].x.toFixed(1)},${bottom} ${line} ${coords.at(-1).x.toFixed(1)},${bottom}`
    }),
    svgElement("polyline", { class: "history-line", points: line })
  );
  for (const [index, point] of coords.entries()) {
    const dot = svgElement("circle", { class: "history-dot", cx: point.x.toFixed(1), cy: point.y.toFixed(1), r: 3 });
    const title = svgElement("title", {});
    title.textContent = `${points[index].mmr} · ${new Date(points[index].at).toLocaleString(state.locale)}`;
    dot.append(title);
    chart.append(dot);
  }
  chart.setAttribute("aria-label", `${tr("historyHeading")} ${PLAYLIST_LABELS[historyPlaylist] || historyPlaylist}`);

  const values = points.map((point) => point.mmr);
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
  document.getElementById("ranked-eyebrow").textContent = tr("rankedTag");
  document.getElementById("ranked-heading").textContent = tr("rankedHeading");
  document.getElementById("scope-eyebrow").textContent = tr("scopeTag");
  document.getElementById("scope-button").textContent = tr("switchScope");
  document.getElementById("reset-button").textContent = tr("reset");
  document.getElementById("setup-api-button").textContent = tr("setupButton");
  document.getElementById("language-label").textContent = tr("language");
  document.getElementById("port-label").textContent = tr("port");
  document.getElementById("port-save").textContent = tr("apply");
  renderStatus();
  renderError();
  renderScope();
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
document.getElementById("history-select").addEventListener("change", (event) => {
  historyPlaylist = event.target.value;
  renderMmrHistory();
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
document.getElementById("reset-button").addEventListener("click", async () => {
  if (!window.confirm(tr("resetConfirm"))) return;
  try { await bridge.resetStats(); } catch { showError(tr("resetError")); }
});
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
  } catch (error) {
    showError(error instanceof Error ? error.message : tr("settingsError"));
  } finally {
    button.disabled = false;
  }
});
document.getElementById("locale-select").addEventListener("change", async (event) => {
  try {
    const result = await bridge.setLocale(event.target.value);
    state.locale = result.locale;
    renderAll();
  } catch { showError(tr("settingsError")); }
});
document.getElementById("port-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("port-input");
  const value = Number(input.value);
  try {
    const result = await bridge.setPort(value);
    input.value = String(result.port);
    clearError();
  } catch (error) { showError(error instanceof Error ? error.message : tr("settingsError")); }
});

const initialUpdateRevision = updateStateRevision;
bridge.getState().then((initial) => {
  state.locale = initial.locale;
  if (updateStateRevision === initialUpdateRevision) applyUpdate(initial.update);
  if (!autoUpdateChanged) state.autoCheckUpdates = initial.autoCheckUpdates;
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
