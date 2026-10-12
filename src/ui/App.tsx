import { useReducer } from "react";
import { initialState, reducer } from "../state/store";
import AppShell from "./components/AppShell";
import BudgetPage from "./pages/BudgetPage";
import ForecastPage from "./pages/ForecastPage";
import { useHashRoute } from "./use-hash-route";

export default function App() {
  const route = useHashRoute();
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  return (
    <AppShell route={route}>
      {route === "budget" ? <BudgetPage /> : <ForecastPage state={state} dispatch={dispatch} />}
    </AppShell>
  );
}
