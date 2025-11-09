import { Route, Outlet, Routes } from "react-router-dom";
import "./App.css";
import Dashboard from "./pages/Dashboard";
import About from "./pages/About";

function Layout() {
  return <Outlet />;
}

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="about" element={<About />} />
      </Route>
    </Routes>
  );
}

export default App;
