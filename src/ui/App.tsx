import AppShell from "./components/AppShell";
import BudgetPage from "./pages/BudgetPage";
import ForecastPage from "./pages/ForecastPage";
import { useHashRoute } from "./use-hash-route";

export default function App() {
  const route = useHashRoute();
  return (
    <AppShell route={route}>{route === "budget" ? <BudgetPage /> : <ForecastPage />}</AppShell>
  );
}
