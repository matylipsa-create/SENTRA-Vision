import { AppProvider } from './context/AppContext';
import AccessibleMinimalUI from './components/AccessibleMinimalUI';

export default function App() {
  return (
    <AppProvider>
      <AccessibleMinimalUI />
    </AppProvider>
  );
}
