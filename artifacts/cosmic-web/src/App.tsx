import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CosmicPage } from "./pages/CosmicPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CosmicPage />
    </QueryClientProvider>
  );
}

export default App;
