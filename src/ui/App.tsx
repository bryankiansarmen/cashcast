import { useEffect, useReducer } from "react";
import { loadAssumptions, saveAssumptions } from "../state/persistence";
import { initialState, reducer } from "../state/store";
import AppShell from "./components/AppShell";
import BudgetPage from "./pages/BudgetPage";
import ForecastPage from "./pages/ForecastPage";
import { useHashRoute } from "./use-hash-route";

export default function App() {
  const route = useHashRoute();
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const saved = loadAssumptions();
    return {
      ...initialState(),
      assumptions: saved.assumptions,
      storageUnavailable: saved.storageUnavailable,
    };
  });
  useEffect(() => {
    if (!saveAssumptions(state.assumptions)) dispatch({ type: "storageFailed" });
  }, [state.assumptions]);
  return (
    <AppShell route={route}>
      {route === "budget" ? <BudgetPage /> : <ForecastPage state={state} dispatch={dispatch} />}
    </AppShell>
  );
}
