import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Provider } from 'react-redux'
import { store } from './redux/store.ts'

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  import.meta.env.DEV ? (
    <Provider store={store}>
      <App />
    </Provider>
  ) : (
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>
  )
);