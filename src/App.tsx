import { BrowserRouter, Route, Routes } from "react-router-dom";
import { DefaultProviders } from "./components/providers/default.tsx";
import { Footer } from "./components/Footer.tsx";
import AuthCallback from "./pages/auth/Callback.tsx";
import Index from "./pages/Index.tsx";
import MapPage from "./pages/map/page.tsx";
import CountryPage from "./pages/country/page.tsx";
import SurveyPage from "./pages/survey/page.tsx";
import DepressionTestPage from "./pages/depression-test/page.tsx";
import FrailtyTestPage from "./pages/frailty-test/page.tsx";
import NotFound from "./pages/NotFound.tsx";

export default function App() {
  return (
    <DefaultProviders>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col">
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/country/:country" element={<CountryPage />} />
              <Route path="/survey" element={<SurveyPage />} />
              <Route path="/depression-test" element={<DepressionTestPage />} />
              <Route path="/frailty-test" element={<FrailtyTestPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <Footer />
        </div>
      </BrowserRouter>
    </DefaultProviders>
  );
}
