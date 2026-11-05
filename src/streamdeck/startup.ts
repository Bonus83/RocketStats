export interface StreamDeckStartup {
  initialize: () => Promise<void>;
  registerActions: () => void;
  connect: () => Promise<void>;
  loadSettings: () => Promise<void>;
  startRuntime: () => void;
}

export async function startStreamDeckRuntime(startup: StreamDeckStartup): Promise<void> {
  await startup.initialize();
  startup.registerActions();
  await startup.connect();
  await startup.loadSettings();
  startup.startRuntime();
}
