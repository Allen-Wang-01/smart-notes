import { Toaster } from "react-hot-toast";
import AppContent from './components/AppContent';
import { BrowserRouter as Router } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import Modal from "react-modal"
Modal.setAppElement("#root");
function App() {
  return (
    <Router>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
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
    </Router>
  );
}

export default App;
