import { NoteProvider } from './context/NoteContext';
import { Toaster } from "react-hot-toast";
import AppContent from './components/AppContent';
import { BrowserRouter as Router } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
function App() {
  return (
    <Router>
      <NoteProvider>
        <Toaster
          position="top-center" // 右上角显示
          toastOptions={{
            duration: 4000, // 默认 4 秒
            style: {
              background: "#fff",
              color: "#333",
              borderRadius: "8px",
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
            },
            success: {
              style: {
                border: "1px solid #28a745",
              },
            },
            error: {
              style: {
                border: "1px solid #dc3545",
              },
            },
          }}
        />
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </NoteProvider>
    </Router>
  );
}

export default App;
