function createConnectionState(onChange) {
  let state = { status: "connecting", error: null, revision: 0 };

  function publish(status, error) {
    state = { status, error, revision: state.revision + 1 };
    onChange({ ...state });
  }

  return {
    getState: () => ({ ...state }),
    setStatus: (status) => publish(status, status === "connected" ? null : state.error),
    setError: (error) => publish(state.status, error)
  };
}

module.exports = { createConnectionState };
