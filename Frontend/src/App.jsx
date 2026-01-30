import { PlaybackPage } from './components/PlaybackPage';
import { PlaybackDataProvider } from './context/PlaybackDataContext';

function App() {
  return (
    <PlaybackDataProvider useMock={false} jsonUrl="/data/frontend.json">
      <PlaybackPage />
    </PlaybackDataProvider>
  );
}

export default App;
