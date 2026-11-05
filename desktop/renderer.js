const TEXT = {
  de: {
    connecting: "Verbinde mit lokaler Stats-API…", connected: "Stats-API verbunden", disconnected: "Stats-API getrennt",
    feed: "Nur lesender lokaler Datenfeed. Keine Spielsteuerung und kein In-Game-Overlay.",
    matchTag: "LIVE-MATCH", matchHeading: "Spielübersicht", rankedTag: "RANGLISTE", rankedHeading: "Rang & Bilanz",
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
    updateTitle: "Anwendungsupdates", updateAuto: "Automatisch nach Updates suchen",
    updateCheck: "Nach Updates suchen", updateDownload: "Herunterladen", updateInstall: "Installieren und neu starten",
    updateConfirm: "Rocket League muss geschlossen sein. Dieses Update installieren und RocketStats neu starten? Deine Kontodaten bleiben erhalten.",
    updateNetwork: "Updateprüfungen kontaktieren GitHub. Es werden keine Spiel- oder Kontodaten übertragen.",
    updateUnsigned: "Achtung: Eine Herausgebersignatur wird nicht geprüft. Installiere nur, wenn du dem GitHub-Release vertraust.",
    update_starting: "Updater wird gestartet…", update_unconfigured: "Keine Updatequelle eingerichtet.",
    update_development: "Updates sind im Entwicklungsmodus deaktiviert.", update_unsupported: "Updates sind nur für die installierte Windows-Version verfügbar.",
    update_idle: "Bereit zur Updateprüfung.", update_checking: "Suche nach einer neuen Version…", update_current: "Du verwendest die aktuelle Version.",
    update_available: "Neue Version verfügbar:", update_downloading: "Update wird heruntergeladen:",
    update_downloaded: "Update heruntergeladen und bereit zur Installation:", update_installing: "Update wird installiert…",
    update_error: "Update fehlgeschlagen. Prüfe die Verbindung und versuche es erneut."
  },
  en: {
    connecting: "Connecting to local Stats API…", connected: "Stats API connected", disconnected: "Stats API disconnected",
    feed: "Read-only local feed. No game controls or in-game overlay.",
    matchTag: "LIVE MATCH", matchHeading: "Match overview", rankedTag: "RANKED", rankedHeading: "Rank & record",
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
    updateTitle: "Application updates", updateAuto: "Automatically check for updates",
    updateCheck: "Check for updates", updateDownload: "Download", updateInstall: "Install and restart",
    updateConfirm: "Rocket League must be closed. Install this update and restart RocketStats? Your account data will be kept.",
    updateNetwork: "Update checks contact GitHub. No game or account data is transmitted.",
    updateUnsigned: "Warning: Publisher signatures are not checked. Install only if you trust this GitHub release.",
    update_starting: "Starting updater…", update_unconfigured: "No update source is configured.",
    update_development: "Updates are disabled in development mode.", update_unsupported: "Updates are available only in the installed Windows version.",
    update_idle: "Ready to check for updates.", update_checking: "Checking for a new version…", update_current: "You are using the latest version.",
    update_available: "New version available:", update_downloading: "Downloading update:",
    update_downloaded: "Update downloaded and ready to install:", update_installing: "Installing update…",
    update_error: "Update failed. Check your connection and try again."
  },
  pl: {
    connecting: "Łączenie z lokalnym Stats API…", connected: "Połączono ze Stats API", disconnected: "Rozłączono ze Stats API",
    feed: "Tylko do odczytu lokalny strumień. Bez sterowania grą i nakładki w grze.",
    matchTag: "MECZ NA ŻYWO", matchHeading: "Podsumowanie meczu", rankedTag: "RANKING", rankedHeading: "Ranga i bilans",
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
    updateTitle: "Aktualizacje aplikacji", updateAuto: "Automatycznie sprawdzaj aktualizacje",
    updateCheck: "Sprawdź aktualizacje", updateDownload: "Pobierz", updateInstall: "Zainstaluj i uruchom ponownie",
    updateConfirm: "Rocket League musi być zamknięte. Zainstalować tę aktualizację i ponownie uruchomić RocketStats? Dane kont pozostaną.",
    updateNetwork: "Sprawdzanie aktualizacji łączy się z GitHub. Dane gry i kont nie są przesyłane.",
    updateUnsigned: "Uwaga: Podpis wydawcy nie jest sprawdzany. Instaluj tylko, jeśli ufasz temu wydaniu w GitHub.",
    update_starting: "Uruchamianie aktualizatora…", update_unconfigured: "Nie skonfigurowano źródła aktualizacji.",
    update_development: "Aktualizacje są wyłączone w trybie deweloperskim.", update_unsupported: "Aktualizacje są dostępne tylko w zainstalowanej wersji Windows.",
    update_idle: "Gotowe do sprawdzenia aktualizacji.", update_checking: "Sprawdzanie nowej wersji…", update_current: "Używasz najnowszej wersji.",
    update_available: "Dostępna nowa wersja:", update_downloading: "Pobieranie aktualizacji:",
    update_downloaded: "Aktualizacja pobrana i gotowa do instalacji:", update_installing: "Instalowanie aktualizacji…",
    update_error: "Aktualizacja nie powiodła się. Sprawdź połączenie i spróbuj ponownie."
  },
  fr: {
    connecting: "Connexion à l’API Stats locale…", connected: "API Stats connectée", disconnected: "API Stats déconnectée",
    feed: "Flux local en lecture seule. Pas de contrôle du jeu ni de superposition en jeu.",
    matchTag: "MATCH EN DIRECT", matchHeading: "Aperçu du match", rankedTag: "CLASSÉ", rankedHeading: "Rang et bilan",
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
    updateTitle: "Mises à jour", updateAuto: "Rechercher automatiquement les mises à jour",
    updateCheck: "Rechercher", updateDownload: "Télécharger", updateInstall: "Installer et redémarrer",
    updateConfirm: "Rocket League doit être fermé. Installer cette mise à jour et redémarrer RocketStats ? Vos données de compte seront conservées.",
    updateNetwork: "Les recherches contactent GitHub. Aucune donnée de jeu ou de compte n’est transmise.",
    updateUnsigned: "Attention : la signature de l’éditeur n’est pas vérifiée. Installez uniquement si vous faites confiance à cette version GitHub.",
    update_starting: "Démarrage des mises à jour…", update_unconfigured: "Aucune source de mise à jour n’est configurée.",
    update_development: "Les mises à jour sont désactivées en développement.", update_unsupported: "Les mises à jour sont réservées à la version Windows installée.",
    update_idle: "Prêt à rechercher les mises à jour.", update_checking: "Recherche d’une nouvelle version…", update_current: "Vous utilisez la dernière version.",
    update_available: "Nouvelle version disponible :", update_downloading: "Téléchargement :",
    update_downloaded: "Mise à jour téléchargée et prête à installer :", update_installing: "Installation…",
    update_error: "Échec de la mise à jour. Vérifiez la connexion et réessayez."
  },
  es: {
    connecting: "Conectando a Stats API local…", connected: "Stats API conectada", disconnected: "Stats API desconectada",
    feed: "Flujo local de solo lectura. Sin controles del juego ni superposición en partida.",
    matchTag: "PARTIDA EN VIVO", matchHeading: "Resumen de partida", rankedTag: "CLASIFICATORIA", rankedHeading: "Rango y registro",
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
    updateTitle: "Actualizaciones", updateAuto: "Buscar actualizaciones automáticamente",
    updateCheck: "Buscar actualizaciones", updateDownload: "Descargar", updateInstall: "Instalar y reiniciar",
    updateConfirm: "Rocket League debe estar cerrado. ¿Instalar esta actualización y reiniciar RocketStats? Se conservarán los datos de las cuentas.",
    updateNetwork: "La búsqueda contacta con GitHub. No se transmiten datos del juego ni de las cuentas.",
    updateUnsigned: "Aviso: No se comprueba la firma del editor. Instala solo si confías en esta versión de GitHub.",
    update_starting: "Iniciando actualizador…", update_unconfigured: "No hay una fuente de actualizaciones configurada.",
    update_development: "Las actualizaciones están desactivadas en desarrollo.", update_unsupported: "Las actualizaciones solo están disponibles en la versión instalada de Windows.",
    update_idle: "Listo para buscar actualizaciones.", update_checking: "Buscando una nueva versión…", update_current: "Estás usando la última versión.",
    update_available: "Nueva versión disponible:", update_downloading: "Descargando:",
    update_downloaded: "Actualización descargada y lista para instalar:", update_installing: "Instalando…",
    update_error: "Error de actualización. Comprueba la conexión e inténtalo de nuevo."
  },
  pt: {
    connecting: "Conectando à Stats API local…", connected: "Stats API conectada", disconnected: "Stats API desconectada",
    feed: "Fluxo local somente leitura. Sem controles do jogo nem sobreposição durante a partida.",
    matchTag: "PARTIDA AO VIVO", matchHeading: "Visão geral", rankedTag: "RANQUEADA", rankedHeading: "Rank e histórico",
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
    updateTitle: "Atualizações", updateAuto: "Verificar atualizações automaticamente",
    updateCheck: "Verificar atualizações", updateDownload: "Baixar", updateInstall: "Instalar e reiniciar",
    updateConfirm: "Rocket League deve estar fechado. Instalar esta atualização e reiniciar RocketStats? Os dados das contas serão mantidos.",
    updateNetwork: "As verificações acessam o GitHub. Nenhum dado do jogo ou das contas é transmitido.",
    updateUnsigned: "Atenção: A assinatura do editor não é verificada. Instale apenas se confiar nesta versão do GitHub.",
    update_starting: "Iniciando atualizador…", update_unconfigured: "Nenhuma fonte de atualização está configurada.",
    update_development: "Atualizações desativadas no modo de desenvolvimento.", update_unsupported: "Atualizações disponíveis apenas na versão Windows instalada.",
    update_idle: "Pronto para verificar atualizações.", update_checking: "Buscando nova versão…", update_current: "Você está usando a versão mais recente.",
    update_available: "Nova versão disponível:", update_downloading: "Baixando atualização:",
    update_downloaded: "Atualização baixada e pronta para instalar:", update_installing: "Instalando…",
    update_error: "Falha na atualização. Verifique a conexão e tente novamente."
  },
  ru: {
    connecting: "Подключение к локальному Stats API…", connected: "Stats API подключено", disconnected: "Stats API отключено",
    feed: "Локальный канал только для чтения. Без управления игрой и внутриигрового оверлея.",
    matchTag: "ТЕКУЩИЙ МАТЧ", matchHeading: "Обзор матча", rankedTag: "РЕЙТИНГ", rankedHeading: "Ранг и результаты",
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
    updateTitle: "Обновления приложения", updateAuto: "Автоматически проверять обновления",
    updateCheck: "Проверить обновления", updateDownload: "Скачать", updateInstall: "Установить и перезапустить",
    updateConfirm: "Rocket League должна быть закрыта. Установить это обновление и перезапустить RocketStats? Данные учётных записей сохранятся.",
    updateNetwork: "Проверки обращаются к GitHub. Данные игры и учётных записей не передаются.",
    updateUnsigned: "Внимание: подпись издателя не проверяется. Устанавливайте обновление, только если доверяете этому выпуску GitHub.",
    update_starting: "Запуск обновления…", update_unconfigured: "Источник обновлений не настроен.",
    update_development: "Обновления отключены в режиме разработки.", update_unsupported: "Обновления доступны только в установленной версии для Windows.",
    update_idle: "Готово к проверке обновлений.", update_checking: "Поиск новой версии…", update_current: "Установлена последняя версия.",
    update_available: "Доступна новая версия:", update_downloading: "Загрузка обновления:",
    update_downloaded: "Обновление загружено и готово к установке:", update_installing: "Установка обновления…",
    update_error: "Не удалось обновить приложение. Проверьте соединение и повторите попытку."
  }
};

const GROUPS = {
  match: ["score", "timer", "boost", "event-banner", "last-goal", "queue-status", "ban-countdown", "speed", "ping", "possession"],
  ranked: ["mmr", "rank", "mmr-wl", "streak", "records"],
  stats: ["goals", "assists", "saves", "shots", "demos", "flip-resets", "touches", "player-score"]
};
const LABELS = {
  score: "score", timer: "timer", boost: "boost", "event-banner": "banner", "last-goal": "lastGoal",
  "queue-status": "queue", "ban-countdown": "ban", speed: "speed", ping: "ping", possession: "possession",
  mmr: "mmr", rank: "rank", "mmr-wl": "mmrWl", streak: "streak", records: "records", goals: "goals",
  assists: "assists", saves: "saves", shots: "shots", demos: "demos", "flip-resets": "resets",
  touches: "touches", "player-score": "playerScore"
};
const state = {
  locale: "en", models: new Map(), status: "connecting",
  update: { phase: "starting", version: "" }, autoCheckUpdates: true
};

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
  statusText.textContent = tr(state.status);
  dot.className = `status-dot ${state.status}`;
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
  document.getElementById("updates-heading").textContent = tr("updateTitle");
  document.getElementById("update-version").textContent = `v${update.version}`;
  document.getElementById("update-status").textContent = [
    tr(`update_${update.phase}`),
    update.availableVersion ? `v${update.availableVersion}` : "",
    update.phase === "downloading" ? `${Math.floor(update.percent || 0)}%` : ""
  ].filter(Boolean).join(" ");
  document.getElementById("update-source").textContent = update.source ? `GitHub Releases · ${update.source}` : "";
  document.getElementById("update-network").textContent = tr("updateNetwork");
  const security = document.getElementById("update-security");
  security.hidden = !update.source || update.publisherVerification === true;
  security.textContent = security.hidden ? "" : tr("updateUnsigned");
  document.getElementById("update-auto-label").textContent = tr("updateAuto");
  const automatic = document.getElementById("update-auto");
  automatic.checked = state.autoCheckUpdates;
  automatic.disabled = disabled;
  const check = document.getElementById("update-check");
  check.textContent = tr("updateCheck");
  check.disabled = !["idle", "current", "available", "error"].includes(update.phase);
  const download = document.getElementById("update-download");
  download.textContent = tr("updateDownload");
  download.hidden = !["available", "downloading"].includes(update.phase);
  download.disabled = update.phase !== "available";
  const install = document.getElementById("update-install");
  install.textContent = tr("updateInstall");
  install.hidden = !["downloaded", "installing"].includes(update.phase);
  install.disabled = update.phase !== "downloaded";
  const progress = document.getElementById("update-progress");
  progress.hidden = !["downloading", "downloaded"].includes(update.phase);
  progress.value = update.percent || 0;
  const error = document.getElementById("update-error");
  error.textContent = update.error || "";
  error.hidden = !update.error;
}

function renderAll() {
  document.documentElement.lang = state.locale;
  document.getElementById("feed-note").textContent = tr("feed");
  document.getElementById("match-eyebrow").textContent = tr("matchTag");
  document.getElementById("match-heading").textContent = tr("matchHeading");
  document.getElementById("ranked-eyebrow").textContent = tr("rankedTag");
  document.getElementById("ranked-heading").textContent = tr("rankedHeading");
  document.getElementById("stats-eyebrow").textContent = tr("statsTag");
  document.getElementById("stats-heading").textContent = tr("statsHeading");
  document.getElementById("scope-eyebrow").textContent = tr("scopeTag");
  document.getElementById("scope-button").textContent = tr("switchScope");
  document.getElementById("reset-button").textContent = tr("reset");
  document.getElementById("setup-api-button").textContent = tr("setupButton");
  document.getElementById("language-label").textContent = tr("language");
  document.getElementById("port-label").textContent = tr("port");
  document.getElementById("port-save").textContent = tr("apply");
  renderStatus();
  renderScope();
  renderUpdate();
  renderGroup("match-grid", GROUPS.match);
  renderGroup("ranked-grid", GROUPS.ranked);
  renderGroup("stats-grid", GROUPS.stats);
}

function showError(message) {
  document.getElementById("error-title").textContent = tr("setup");
  document.getElementById("error-text").textContent = message;
  document.getElementById("error-panel").hidden = false;
}

const bridge = window.rocketStatsDesktop;
bridge.onModel((model) => {
  state.models.set(model.action, model);
  renderAll();
});
bridge.onStatus((status) => {
  state.status = status;
  renderStatus();
});
bridge.onError(showError);
bridge.onUpdate((update) => {
  state.update = update;
  renderUpdate();
});

for (const [id, action] of [
  ["update-check", () => bridge.checkUpdate()],
  ["update-download", () => bridge.downloadUpdate()],
  ["update-install", () => {
    const warning = state.update.publisherVerification === true ? "" : `\n\n${tr("updateUnsigned")}`;
    return window.confirm(`${tr("updateConfirm")}${warning}`) ? bridge.installUpdate() : null;
  }]
]) {
  document.getElementById(id).addEventListener("click", async () => {
    try {
      const update = await action();
      if (update) {
        state.update = update;
        renderUpdate();
      }
    } catch (error) {
      state.update = { ...state.update, error: error instanceof Error ? error.message : String(error) };
      renderUpdate();
    }
  });
}
document.getElementById("update-auto").addEventListener("change", async (event) => {
  try {
    const result = await bridge.setAutoUpdates(event.target.checked);
    state.autoCheckUpdates = result.autoCheckUpdates;
  } catch (error) {
    state.update = { ...state.update, error: error instanceof Error ? error.message : String(error) };
  }
  renderUpdate();
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
  document.getElementById("error-panel").hidden = true;
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
    document.getElementById("error-panel").hidden = true;
  } catch (error) { showError(error instanceof Error ? error.message : tr("settingsError")); }
});

bridge.getState().then((initial) => {
  state.locale = initial.locale;
  state.status = initial.status;
  state.update = initial.update;
  state.autoCheckUpdates = initial.autoCheckUpdates;
  state.models = new Map(initial.models.map((model) => [model.action, model]));
  document.getElementById("locale-select").value = initial.locale;
  document.getElementById("port-input").value = String(initial.port);
  renderAll();
  if (initial.startupError) showError(initial.startupError);
}).catch((error) => showError(error instanceof Error ? error.message : "Could not load application state."));
