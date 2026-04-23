import { useState } from "react";
import { Sidebar, Page } from "./components/Sidebar";
import { Dashboard }  from "./pages/Dashboard";
import { Customers }  from "./pages/Customers";
import { Companies }  from "./pages/Companies";
import { Packages }   from "./pages/Packages";
import { Promotions } from "./pages/Promotions";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="flex h-full bg-slate-50">
      <Sidebar current={page} onChange={setPage} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6">
          {page === "dashboard"  && <Dashboard  />}
          {page === "customers"  && <Customers  />}
          {page === "companies"  && <Companies  />}
          {page === "packages"   && <Packages   />}
          {page === "promotions" && <Promotions />}
        </div>
      </main>
    </div>
  );
}
