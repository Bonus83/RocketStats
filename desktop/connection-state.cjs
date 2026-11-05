function createConnectionState(onChange, {
  isGameRunning,
  onProcessCheckError = (error) => console.error("Could not check whether Rocket League is running:", error)
} = {}) {
  let state = { status: "connecting", error: null, revision: 0 };
  let errorGeneration = 0;

  function publish(status, error) {
    state = { status, error, revision: state.revision + 1 };
    onChange({ ...state });
  }

  async function setError(error, code) {
    const generation = ++errorGeneration;
    if (code !== "ECONNREFUSED" || typeof isGameRunning !== "function") {
      publish(state.status, error);
      return;
    }

    let running;
    try {
      running = await isGameRunning();
      if (typeof running !== "boolean") {
        throw new TypeError("The Rocket League process check returned an invalid result.");
      }
    } catch (checkError) {
      onProcessCheckError(checkError);
      if (generation === errorGeneration) publish(state.status, error);
      return;
    }
    if (generation === errorGeneration) publish(state.status, running ? error : null);
  }

  return {
    getState: () => ({ ...state }),
    setStatus: (status) => {
      if (status === "connecting" || status === "connected") errorGeneration += 1;
      publish(status, status === "connected" ? null : state.error);
    },
    setError
  };
}

module.exports = { createConnectionState };
