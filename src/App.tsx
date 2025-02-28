
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import Index from "@/pages/Index";
import History from "@/pages/History";
import NotFound from "@/pages/NotFound";
import { createClient } from "@supabase/supabase-js";
import { AuthProvider } from "@/contexts/AuthContext";

// Initialize Supabase client
const supabaseUrl = "https://evghwzipbhnwhwkshumt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2Z2h3emlwYmhud2h3a3NodW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1NTI4NzQsImV4cCI6MjA1NjEyODg3NH0.J4vA31adP_RaOy-3K2yQzI2V31-DrzPN4StfFQgSXyo";
export const supabase = createClient(supabaseUrl, supabaseKey);

const router = createBrowserRouter([
  {
    path: "/",
    element: <Index />,
    errorElement: <NotFound />,
  },
  {
    path: "/history",
    element: <History />,
  },
]);

function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster />
    </AuthProvider>
  );
}

export default App;
